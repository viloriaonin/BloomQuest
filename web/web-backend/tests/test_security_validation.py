import asyncio
import io
import json
import os
import sys
import time
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import HTTPException, UploadFile
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app, normalize_email, read_upload_bytes
from routers import assessment as assessment_router
from routers.assessment import group_questions_by_type
from routers.questions import (
    MAX_QUESTIONS_PER_GENERATION,
    TOSGenerationPayload,
    reserve_ai_generation,
    finish_ai_usage,
    start_ai_usage,
)
from routers.tos_utils import generate_tos_from_excel_template
from ai_service import GeminiUsageTracker
import ai_service
import models
from database import get_db
from routers import questions as questions_router
from security import get_current_user


def test_normalize_email_trims_and_lowercases():
    assert normalize_email("  User@Example.com ") == "user@example.com"


def test_normalize_email_handles_common_domain_typos():
    assert normalize_email("user@example,com") == "user@example.com"
    assert normalize_email("user@example;com") == "user@example.com"


def test_convert_docx_to_pdf_uses_libreoffice_on_linux(tmp_path, monkeypatch):
    docx_path = tmp_path / "assessment.docx"
    pdf_path = tmp_path / "assessment.pdf"
    docx_path.write_bytes(b"docx")
    monkeypatch.setattr(assessment_router.platform, "system", lambda: "Linux")
    monkeypatch.setattr(assessment_router.shutil, "which", lambda name: "/usr/bin/libreoffice")

    def fake_run(command, **kwargs):
        pdf_path.write_bytes(b"%PDF-test")
        return type("CompletedProcess", (), {"returncode": 0, "stdout": "", "stderr": ""})()

    monkeypatch.setattr(assessment_router.subprocess, "run", fake_run)

    assessment_router.convert_docx_to_pdf(str(docx_path), str(pdf_path))

    assert pdf_path.read_bytes() == b"%PDF-test"


def test_read_upload_bytes_rejects_image_content_even_with_allowed_extension():
    png_bytes = b"\x89PNG\r\n\x1a\n" + b"fake-image-data"
    file = UploadFile(filename="report.pdf", file=io.BytesIO(png_bytes))

    with pytest.raises(Exception):
        asyncio.run(read_upload_bytes(file, "module_file"))


def test_tos_generation_payload_accepts_frontend_question_types():
    payload = TOSGenerationPayload(
        upload_id="demo-upload",
        total_items=10,
        whole_total_points=50,
        question_types=["MCQ", "True or False", "Identification", "Matching Type", "Enumeration", "Essay", "Situational"],
        selected_topic_indices=[0, 1],
        subcolumn_a_hours={"0": "3.0", "1": "2.0"},
    )

    assert payload.question_types == ["MCQ", "True or False", "Identification", "Matching Type", "Enumeration", "Essay", "Situational"]


def test_tos_generation_payload_accepts_new_assessment_metadata():
    payload = TOSGenerationPayload(
        upload_id="demo-upload",
        total_items=10,
        whole_total_points=50,
        question_types=["MCQ"],
        question_type_points={"MCQ": 2},
        exam_type="Preliminary Exam",
        semester="Midterm Class",
        academic_year="2026-2027",
    )

    assert payload.question_type_points == {"MCQ": 2}
    assert payload.academic_year == "2026-2027"


def test_tos_generation_payload_enforces_max_questions_per_generation():
    assert MAX_QUESTIONS_PER_GENERATION == 100
    payload = TOSGenerationPayload(
        upload_id="demo-upload",
        total_items=MAX_QUESTIONS_PER_GENERATION,
        whole_total_points=50,
        question_type_items={"MCQ": MAX_QUESTIONS_PER_GENERATION},
    )
    assert payload.total_items == MAX_QUESTIONS_PER_GENERATION

    with pytest.raises(ValueError):
        TOSGenerationPayload(
            upload_id="demo-upload",
            total_items=101,
            whole_total_points=50,
        )

    with pytest.raises(ValueError):
        TOSGenerationPayload(
            upload_id="demo-upload",
            total_items=100,
            whole_total_points=50,
            question_type_items={"MCQ": 101},
        )


def test_ai_generation_reservations_enforce_cooldown_and_daily_quota(monkeypatch):
    engine = create_engine("sqlite:///:memory:")
    models.Campus.__table__.create(engine)
    models.User.__table__.create(engine)
    models.ActivityLog.__table__.create(engine)
    models.AIUsage.__table__.create(engine)
    session = sessionmaker(bind=engine)()
    campus = models.Campus(name="Limit Test Campus", code="LTC")
    session.add(campus)
    session.commit()
    user = models.User(
        email="limit@example.com",
        password="unused",
        role="faculty",
        campus_id=campus.id,
    )
    session.add(user)
    session.commit()
    current_user = session.query(models.User).filter_by(email="limit@example.com").first()

    monkeypatch.setattr("routers.questions.MAX_GENERATED_QUESTIONS_PER_USER_PER_DAY", 10)
    monkeypatch.setattr("routers.questions.GENERATION_COOLDOWN_SECONDS", 60)
    request_started_at = time.perf_counter()
    usage_id = reserve_ai_generation(
        session, current_user, 3, "question_generation", request_started_at=request_started_at
    )
    tracker = GeminiUsageTracker(generated_question_count=3)
    tracker.begin_api_call()
    tracker.record_response(SimpleNamespace(usage_metadata=SimpleNamespace(
        prompt_token_count=120,
        candidates_token_count=44,
        total_token_count=164,
    )))
    finish_ai_usage(session, usage_id, tracker, "success", request_started_at)
    first_usage = session.query(models.AIUsage).filter_by(id=usage_id).first()
    assert first_usage.campus_id == campus.id
    assert first_usage.requested_question_count == 3
    assert first_usage.generated_question_count == 3
    assert first_usage.input_tokens == 120
    assert first_usage.output_tokens == 44
    assert first_usage.total_tokens == 164
    assert first_usage.status == "success"
    failed_usage_id = start_ai_usage(
        session, current_user, "question_generation", requested_question_count=2
    )
    failed_tracker = GeminiUsageTracker()
    failed_tracker.begin_api_call()
    failed_tracker.record_response(None)
    failed_tracker.record_failure(TimeoutError("request timed out"))
    finish_ai_usage(
        session,
        failed_usage_id,
        failed_tracker,
        "failed",
        request_started_at,
        failed_tracker.last_error_type,
    )
    failed_usage = session.query(models.AIUsage).filter_by(id=failed_usage_id).first()
    assert failed_usage.user_id == current_user.id
    assert failed_usage.campus_id == campus.id
    assert failed_usage.status == "failed"
    assert failed_usage.error_type == "TimeoutError"
    assert failed_usage.generated_question_count == 0

    with pytest.raises(HTTPException) as rate_error:
        reserve_ai_generation(session, current_user, 3, "question_generation")
    assert rate_error.value.status_code == 429
    assert "wait" in rate_error.value.detail.lower()
    assert session.query(models.AIUsage).filter_by(status="rate_limited").count() == 1

    monkeypatch.setattr("routers.questions.GENERATION_COOLDOWN_SECONDS", 1)
    session.query(models.ActivityLog).filter_by(action="AI generation reservation").update({
        models.ActivityLog.created_at: datetime.utcnow() - timedelta(seconds=120)
    })
    session.commit()
    reserve_ai_generation(session, current_user, 3, "question_generation")

    with pytest.raises(HTTPException) as daily_error:
        reserve_ai_generation(session, current_user, 3, "question_generation")
    assert daily_error.value.status_code == 429
    assert "2 question(s) remaining" in daily_error.value.detail
    assert session.query(models.AIUsage).filter_by(status="rate_limited").count() == 2

    session.close()
    engine.dispose()


def _create_quota_test_session():
    engine = create_engine("sqlite:///:memory:")
    models.Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    campus = models.Campus(name="Question Quota Campus", code="QQC")
    session.add(campus)
    session.commit()
    return engine, session, campus


def _create_quota_test_user(session, campus, email):
    user = models.User(
        email=email,
        password="test-password-hash",
        role="faculty",
        campus_id=campus.id,
    )
    session.add(user)
    session.commit()
    return user


def _record_quota_usage(session, user, campus, request_type, requested_count, generated_at=None):
    usage = models.AIUsage(
        user_id=user.id,
        campus_id=campus.id,
        generated_at=generated_at or datetime.utcnow(),
        request_type=request_type,
        requested_question_count=requested_count,
        generated_question_count=requested_count,
        gemini_model=ai_service.MODEL_NAME,
        status="success",
        gemini_api_call_count=1,
        input_tokens=120,
        output_tokens=44,
        total_tokens=164,
    )
    session.add(usage)
    session.commit()
    return usage


def test_ai_generation_quota_accepts_100_and_rejects_any_more(monkeypatch):
    engine, session, campus = _create_quota_test_session()
    user = _create_quota_test_user(session, campus, "exact-quota@example.com")
    monkeypatch.setattr(
        "routers.questions.MAX_GENERATED_QUESTIONS_PER_USER_PER_DAY", 100
    )
    monkeypatch.setattr("routers.questions.GENERATION_COOLDOWN_SECONDS", 10)

    usage_id = reserve_ai_generation(session, user, 100, "question_generation")
    usage = session.query(models.AIUsage).filter_by(id=usage_id).first()
    assert usage.requested_question_count == 100
    assert usage.status == "in_progress"

    with pytest.raises(HTTPException) as quota_error:
        reserve_ai_generation(session, user, 1, "question_generation")
    assert quota_error.value.status_code == 429
    assert "0 question(s) remaining" in quota_error.value.detail
    limited = session.query(models.AIUsage).filter_by(status="rate_limited").one()
    assert limited.error_type == "daily_question_limit"
    assert limited.requested_question_count == 1

    session.close()
    engine.dispose()


@pytest.mark.parametrize(
    ("requested_count", "accepted"),
    [(30, True), (31, False)],
)
def test_daily_question_quota_checks_remaining_amount(monkeypatch, requested_count, accepted):
    engine, session, campus = _create_quota_test_session()
    user = _create_quota_test_user(
        session, campus, f"seventy-used-{requested_count}@example.com"
    )
    monkeypatch.setattr(
        "routers.questions.MAX_GENERATED_QUESTIONS_PER_USER_PER_DAY", 100
    )
    monkeypatch.setattr("routers.questions.GENERATION_COOLDOWN_SECONDS", 10)
    _record_quota_usage(
        session, user, campus, "question_generation", 70
    )

    if accepted:
        usage_id = reserve_ai_generation(
            session, user, requested_count, "question_generation"
        )
        usage = session.query(models.AIUsage).filter_by(id=usage_id).one()
        assert usage.requested_question_count == 30
    else:
        with pytest.raises(HTTPException) as quota_error:
            reserve_ai_generation(
                session, user, requested_count, "question_generation"
            )
        assert quota_error.value.status_code == 429
        assert "30 question(s) remaining" in quota_error.value.detail
        assert "this request asks for 31" in quota_error.value.detail
        assert session.query(models.AIUsage).filter_by(
            user_id=user.id, status="in_progress"
        ).count() == 0

    session.close()
    engine.dispose()


def test_question_recreation_reserves_one_daily_question(monkeypatch):
    engine, session, campus = _create_quota_test_session()
    user = _create_quota_test_user(session, campus, "recreate-quota@example.com")
    monkeypatch.setattr(
        "routers.questions.MAX_GENERATED_QUESTIONS_PER_USER_PER_DAY", 100
    )
    monkeypatch.setattr("routers.questions.GENERATION_COOLDOWN_SECONDS", 10)
    _record_quota_usage(session, user, campus, "question_generation", 99)

    usage_id = reserve_ai_generation(session, user, 1, "question_recreation")
    usage = session.query(models.AIUsage).filter_by(id=usage_id).one()
    assert usage.request_type == "question_recreation"
    assert usage.requested_question_count == 1

    with pytest.raises(HTTPException) as quota_error:
        reserve_ai_generation(session, user, 1, "question_recreation")
    assert quota_error.value.status_code == 429
    assert "0 question(s) remaining" in quota_error.value.detail

    session.close()
    engine.dispose()


def test_non_generation_actions_do_not_consume_question_quota(monkeypatch):
    engine, session, campus = _create_quota_test_session()
    user = _create_quota_test_user(session, campus, "non-generation@example.com")
    monkeypatch.setattr(
        "routers.questions.MAX_GENERATED_QUESTIONS_PER_USER_PER_DAY", 100
    )
    monkeypatch.setattr("routers.questions.GENERATION_COOLDOWN_SECONDS", 10)
    for request_type in (
        "bloom_classification",
        "question_bank_reuse",
        "assessment_builder",
        "assessment_download",
    ):
        _record_quota_usage(session, user, campus, request_type, 100)

    usage_id = reserve_ai_generation(session, user, 100, "question_generation")
    usage = session.query(models.AIUsage).filter_by(id=usage_id).one()
    assert usage.requested_question_count == 100
    assert session.query(models.AIUsage).filter_by(status="rate_limited").count() == 0

    session.close()
    engine.dispose()


def test_daily_question_quota_resets_at_utc_midnight(monkeypatch):
    engine, session, campus = _create_quota_test_session()
    user = _create_quota_test_user(session, campus, "utc-quota@example.com")
    monkeypatch.setattr(
        "routers.questions.MAX_GENERATED_QUESTIONS_PER_USER_PER_DAY", 100
    )
    monkeypatch.setattr("routers.questions.GENERATION_COOLDOWN_SECONDS", 10)
    yesterday = datetime.utcnow().replace(
        hour=0, minute=0, second=0, microsecond=0
    ) - timedelta(seconds=1)
    _record_quota_usage(
        session, user, campus, "question_generation", 100, yesterday
    )

    usage_id = reserve_ai_generation(session, user, 100, "question_generation")
    usage = session.query(models.AIUsage).filter_by(id=usage_id).one()
    assert usage.generated_at.date() == datetime.utcnow().date()
    assert usage.requested_question_count == 100

    session.close()
    engine.dispose()


def test_generation_cooldown_still_records_rate_limited_attempt(monkeypatch):
    engine, session, campus = _create_quota_test_session()
    user = _create_quota_test_user(session, campus, "cooldown-quota@example.com")
    monkeypatch.setattr(
        "routers.questions.MAX_GENERATED_QUESTIONS_PER_USER_PER_DAY", 100
    )
    monkeypatch.setattr("routers.questions.GENERATION_COOLDOWN_SECONDS", 10)
    reserve_ai_generation(session, user, 5, "question_generation")

    with pytest.raises(HTTPException) as cooldown_error:
        reserve_ai_generation(session, user, 1, "question_generation")
    assert cooldown_error.value.status_code == 429
    assert cooldown_error.value.headers["Retry-After"]
    limited = session.query(models.AIUsage).filter_by(status="rate_limited").one()
    assert limited.error_type == "generation_cooldown"

    session.close()
    engine.dispose()


def test_quota_reservation_keeps_per_user_row_lock(monkeypatch):
    from sqlalchemy.orm import Query

    engine, session, campus = _create_quota_test_session()
    user = _create_quota_test_user(session, campus, "locked-quota@example.com")
    monkeypatch.setattr(
        "routers.questions.MAX_GENERATED_QUESTIONS_PER_USER_PER_DAY", 100
    )
    monkeypatch.setattr("routers.questions.GENERATION_COOLDOWN_SECONDS", 10)
    _record_quota_usage(session, user, campus, "question_generation", 20)
    original_with_for_update = Query.with_for_update
    lock_calls = []

    def record_row_lock(query, *args, **kwargs):
        lock_calls.append(query.column_descriptions[0]["entity"])
        return original_with_for_update(query, *args, **kwargs)

    monkeypatch.setattr(Query, "with_for_update", record_row_lock)
    accepted = reserve_ai_generation(session, user, 50, "question_generation")
    assert session.query(models.AIUsage).filter_by(id=accepted).one().requested_question_count == 50
    with pytest.raises(HTTPException) as competing_request:
        reserve_ai_generation(session, user, 50, "question_generation")
    assert competing_request.value.status_code == 429
    assert "30 question(s) remaining" in competing_request.value.detail
    assert lock_calls == [models.User, models.User]

    session.close()
    engine.dispose()


def test_direct_generation_api_enforces_maximum_and_daily_limit(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    models.Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    session = session_factory()
    campus = models.Campus(name="Direct API Campus", code="DIRECT-API")
    session.add(campus)
    session.flush()
    current_user = models.User(
        email="direct_api@example.com",
        password="unused",
        role="faculty",
        campus_id=campus.id,
    )
    session.add(current_user)
    session.commit()

    monkeypatch.setattr("routers.questions.MAX_GENERATED_QUESTIONS_PER_USER_PER_DAY", 100)
    monkeypatch.setattr("routers.questions.GENERATION_COOLDOWN_SECONDS", 1)
    reserve_ai_generation(session, current_user, 1, "question_generation")

    upload_id = "direct-api-limit-upload"
    questions_router.FILE_CACHE[f"{upload_id}_metadata"] = {
        "user_id": current_user.id,
        "subject": {"name": "Biology", "code": "BIO"},
        "topics": [{"name": "Cell Structure", "ilo": "Describe cell components."}],
        "module_text": "Cell structure includes membranes that control transport.",
    }

    def override_db():
        request_session = session_factory()
        try:
            yield request_session
        finally:
            request_session.close()

    def override_user():
        return current_user

    previous_overrides = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = override_user
    try:
        with TestClient(app) as client:
            oversized = client.post(
                "/api/questions/generate-preview",
                json={
                    "upload_id": upload_id,
                    "total_items": MAX_QUESTIONS_PER_GENERATION + 1,
                    "whole_total_points": 1,
                },
            )
            assert oversized.status_code == 422

            valid_payload = {
                "upload_id": upload_id,
                "total_items": 1,
                "whole_total_points": 1,
                "question_types": ["MCQ"],
                "selected_topic_indices": [0],
                "subcolumn_a_hours": {"0": "1"},
                "question_type_items": {"MCQ": 1},
            }
            rapid_repeat = client.post(
                "/api/questions/generate-preview",
                json=valid_payload,
            )
            assert rapid_repeat.status_code == 429
            assert "wait" in rapid_repeat.json()["detail"].lower()

            with session_factory() as aging_session:
                aging_session.query(models.ActivityLog).filter_by(
                    action="AI generation reservation"
                ).update({models.ActivityLog.created_at: datetime.utcnow() - timedelta(seconds=120)})
                aging_session.query(models.AIUsage).filter_by(
                    user_id=current_user.id,
                    request_type="question_generation",
                ).delete()
                aging_session.commit()
            monkeypatch.setattr("routers.questions.MAX_GENERATED_QUESTIONS_PER_USER_PER_DAY", 1)
            with session_factory() as full_quota_session:
                full_quota_session.add(models.AIUsage(
                    user_id=current_user.id,
                    campus_id=campus.id,
                    generated_at=datetime.utcnow(),
                    request_type="question_generation",
                    requested_question_count=1,
                    generated_question_count=1,
                    status="success",
                ))
                full_quota_session.commit()
            daily_limit = client.post("/api/questions/generate-preview", json=valid_payload)
            assert daily_limit.status_code == 429
            assert "0 question(s) remaining" in daily_limit.json()["detail"]
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)
        questions_router.FILE_CACHE.pop(f"{upload_id}_metadata", None)
        session.close()
        engine.dispose()


def test_gemini_usage_tracker_leaves_missing_token_metadata_null():
    tracker = GeminiUsageTracker()
    tracker.begin_api_call()
    tracker.record_response(SimpleNamespace(usage_metadata=SimpleNamespace(
        prompt_token_count=25,
        candidates_token_count=10,
        total_token_count=35,
    )))
    tracker.begin_api_call()
    tracker.record_response(SimpleNamespace(usage_metadata=None))

    assert tracker.api_call_count == 2
    assert tracker.token_totals() == (None, None, None)


@pytest.mark.parametrize("question_count", [2, MAX_QUESTIONS_PER_GENERATION])
def test_topic_generation_returns_exact_requested_batch_in_one_gemini_call(monkeypatch, question_count):
    generated = [
        {
            "bloom_level": "Remember",
            "question_type": "MCQ",
            "question": f"Which statement describes ATP, item {index}?",
            "options": ["A", "B", "C", "D"],
            "correct_answer": "A",
            "explanation": "Supported by the material.",
        }
        for index in range(question_count)
    ]
    calls = []

    class FakeModels:
        def generate_content(self, **kwargs):
            calls.append(kwargs)
            return SimpleNamespace(
                text=json.dumps({"questions": generated}),
                usage_metadata=SimpleNamespace(
                    prompt_token_count=120,
                    candidates_token_count=80,
                    total_token_count=200,
                ),
            )

    monkeypatch.setattr(ai_service, "client", SimpleNamespace(models=FakeModels()))
    monkeypatch.setattr(ai_service, "MIN_SECONDS_BETWEEN_JOBS", 0)
    tracker = GeminiUsageTracker()

    questions = ai_service.generate_questions_for_topic(
        "BIO 101",
        "Cell Structure",
        "Describe cell components.",
        "Cell membranes control transport.",
        {"Remember": ["MCQ"] * question_count},
        usage_tracker=tracker,
    )

    assert len(questions) == question_count
    assert tracker.generated_question_count == question_count
    assert tracker.api_call_count == 1
    assert tracker.token_totals() == (120, 80, 200)
    assert calls[0]["model"] == ai_service.MODEL_NAME
    assert "Cell membranes control transport." in calls[0]["contents"]


def test_topic_context_prefers_matching_heading_and_omits_other_sections():
    module_text = (
        "## Cell Structure\nCell membranes control transport.\n\n"
        "## Energy Transfer\nATP stores transferable chemical energy."
    )

    cell_context = ai_service.extract_topic_section(
        module_text,
        "Cell Structure",
        ["Cell Structure", "Energy Transfer"],
    )
    energy_context = ai_service.extract_topic_section(
        module_text,
        "Energy Transfer",
        ["Cell Structure", "Energy Transfer"],
    )

    assert "Cell membranes" in cell_context
    assert "ATP" not in cell_context
    assert "ATP" in energy_context
    assert "Cell membranes" not in energy_context


def test_normal_preview_does_not_call_gemini_classifier(monkeypatch):
    import classifier

    monkeypatch.setattr(classifier, "classify_question_ml", lambda _: "Remember")
    monkeypatch.setattr(
        classifier,
        "classify_question",
        lambda *_args, **_kwargs: pytest.fail("Preview should not call Gemini classification."),
    )
    monkeypatch.setattr("builtins.open", lambda *_args, **_kwargs: io.StringIO())

    preview = ai_service.build_preview([{
        "question": "Which statement defines ATP?",
        "correct_answer": "A",
        "bloom_level": "Understand",
        "question_type": "MCQ",
        "topic_name": "Energy Transfer",
        "options": ["A", "B", "C", "D"],
        "explanation": "Supported by the material.",
    }])

    assert preview[0]["bloom_level"] == "Remember"


@pytest.mark.parametrize("failure", [TimeoutError("timed out"), RuntimeError("quota exceeded")])
def test_gemini_failures_retry_same_model_and_record_failed_attempts(monkeypatch, failure):
    models_called = []

    class FakeModels:
        def generate_content(self, **kwargs):
            models_called.append(kwargs["model"])
            raise failure

    monkeypatch.setattr(ai_service, "client", SimpleNamespace(models=FakeModels()))
    monkeypatch.setattr(ai_service.time, "sleep", lambda _: None)
    tracker = GeminiUsageTracker()

    with pytest.raises(RuntimeError):
        ai_service.generate_with_retry(
            "small test prompt",
            expected_question_count=1,
            usage_tracker=tracker,
        )

    assert models_called == [ai_service.MODEL_NAME] * ai_service.MAX_RETRIES
    assert tracker.api_call_count == ai_service.MAX_RETRIES
    assert tracker.failure_count == ai_service.MAX_RETRIES
    assert tracker.token_totals() == (None, None, None)


def test_invalid_and_empty_gemini_responses_are_retried(monkeypatch):
    response_texts = iter(["not json", "", "not json"])
    calls = []

    class FakeModels:
        def generate_content(self, **kwargs):
            calls.append(kwargs["model"])
            return SimpleNamespace(
                text=next(response_texts),
                usage_metadata=SimpleNamespace(
                    prompt_token_count=10,
                    candidates_token_count=2,
                    total_token_count=12,
                ),
            )

    monkeypatch.setattr(ai_service, "client", SimpleNamespace(models=FakeModels()))
    monkeypatch.setattr(ai_service.time, "sleep", lambda _: None)
    tracker = GeminiUsageTracker()

    with pytest.raises(RuntimeError):
        ai_service.generate_with_retry(
            "small test prompt",
            expected_question_count=1,
            usage_tracker=tracker,
        )

    assert calls == [ai_service.MODEL_NAME] * ai_service.MAX_RETRIES
    assert tracker.api_call_count == ai_service.MAX_RETRIES
    assert tracker.token_totals() == (30, 6, 36)


def test_response_validation_reports_missing_question_array():
    assert ai_service.response_validation_errors({}, expected_question_count=1) == [
        "response is missing the 'questions' array"
    ]


def test_response_validation_reports_invalid_mcq_options():
    response = {
        "questions": [{
            "bloom_level": "Remember",
            "question_type": "MCQ",
            "question": "Which option is correct?",
            "options": ["A", "B"],
            "correct_answer": "A",
            "explanation": "The module states this.",
        }]
    }

    assert ai_service.response_validation_errors(response, expected_question_count=1) == [
        "question 1 MCQ must have exactly four options"
    ]


def test_retry_prompt_includes_previous_validation_feedback(monkeypatch):
    generated_response = {
        "questions": [{
            "bloom_level": "Remember",
            "question_type": "MCQ",
            "question": "Which option is correct?",
            "options": ["A", "B", "C", "D"],
            "correct_answer": "A",
            "explanation": "The module states this.",
        }]
    }
    prompts = []
    responses = iter([
        json.dumps({"questions": []}),
        json.dumps(generated_response),
    ])

    class FakeModels:
        def generate_content(self, **kwargs):
            prompts.append(kwargs["contents"])
            return SimpleNamespace(text=next(responses))

    monkeypatch.setattr(ai_service, "client", SimpleNamespace(models=FakeModels()))
    monkeypatch.setattr(ai_service, "MAX_RETRIES", 2)
    monkeypatch.setattr(ai_service.time, "sleep", lambda _: None)

    result = ai_service.generate_with_retry(
        "Generate one MCQ.",
        expected_question_count=1,
    )

    assert result == generated_response
    assert len(prompts) == 2
    assert "'questions' array is empty" in prompts[1]


def test_generation_rejects_selected_topics_missing_from_module(monkeypatch):
    upload_id = "topic-module-mismatch"
    questions_router.FILE_CACHE[f"{upload_id}_metadata"] = {
        "subject": {"name": "Biology", "code": "BIO"},
        "topics": [
            {"topic_name": "Cell Structure"},
            {"topic_name": "Database Normalization"},
        ],
        "module_text": "## Cell Structure\nCell membranes control transport.",
    }
    monkeypatch.setattr(questions_router, "_assert_upload_access", lambda *_args: None)
    monkeypatch.setattr(
        questions_router,
        "compute_tos",
        lambda **_kwargs: [
            {"topic_name": "Cell Structure", "items": 1},
            {"topic_name": "Database Normalization", "items": 1},
        ],
    )
    monkeypatch.setattr(
        questions_router,
        "reserve_ai_generation",
        lambda *_args, **_kwargs: pytest.fail("Unsupported topics must not reserve AI usage."),
    )
    payload = TOSGenerationPayload(
        upload_id=upload_id,
        total_items=1,
        whole_total_points=1,
        selected_topic_indices=[0],
    )

    try:
        with pytest.raises(HTTPException) as error:
            asyncio.run(questions_router.generate_preview(
                payload,
                db=object(),
                current_user=SimpleNamespace(id=7),
            ))

        assert error.value.status_code == 422
        assert error.value.detail["code"] == "TOPICS_NOT_IN_MODULE"
        assert error.value.detail["topics"] == ["Database Normalization"]
    finally:
        questions_router.FILE_CACHE.pop(f"{upload_id}_metadata", None)


def test_tos_generation_never_calls_ai_for_unsupported_topic(monkeypatch):
    monkeypatch.setattr(
        ai_service,
        "generate_questions_for_topic",
        lambda *_args, **_kwargs: pytest.fail("Unsupported topic reached question generation."),
    )

    with pytest.raises(ValueError, match="does not provide identifiable content"):
        ai_service.generate_questions_from_tos(
            subject={"name": "Machine Learning", "code": "ML"},
            module_text="Supervised machine learning uses regression to predict continuous values.",
            tos_data=[{
                "topic_name": "Supervised Machine Learning Classification",
                "question_distribution": {"Remember": ["MCQ"]},
            }],
        )


def test_tos_pdf_builder_returns_pdf_document():
    from pypdf import PdfReader

    pdf_data = questions_router._build_tos_pdf(
        tos_data=[{
            "topic_name": "Cell Structure",
            "ilo": "Describe cell components",
            "hours_a": 2,
            "weight": 100,
            "items": 1,
            "bloom_counts": {
                "Remember": 1,
                "Understand": 0,
                "Apply": 0,
                "Analyze": 0,
                "Evaluate": 0,
                "Create": 0,
            },
        }],
        course_code="BIO101",
        course_title="Biology",
        total_items=1,
        exam_type="Quiz",
        semester="First Semester",
        academic_year="2026-2027",
        instructor_name="Instructor",
        department="Science",
    )

    assert pdf_data.startswith(b"%PDF-")
    pdf_text = "\n".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(pdf_data)).pages)
    assert "TABLE OF SPECIFICATIONS" in pdf_text
    assert "Cell Structure" in pdf_text


def test_over_count_gemini_response_is_retried_until_exact_count(monkeypatch):
    question = {
        "bloom_level": "Remember",
        "question_type": "MCQ",
        "question": "What is ATP?",
        "options": ["A", "B", "C", "D"],
        "correct_answer": "A",
        "explanation": "Supported by the material.",
    }
    responses = iter([
        {"questions": [question, {**question, "question": "What stores energy?"}]},
        {"questions": [question]},
    ])
    calls = []

    class FakeModels:
        def generate_content(self, **kwargs):
            calls.append(kwargs["model"])
            return SimpleNamespace(text=json.dumps(next(responses)), usage_metadata=None)

    monkeypatch.setattr(ai_service, "client", SimpleNamespace(models=FakeModels()))
    monkeypatch.setattr(ai_service.time, "sleep", lambda _: None)

    result = ai_service.generate_with_retry(
        "Generate one question.",
        expected_question_count=1,
    )

    assert len(result["questions"]) == 1
    assert calls == [ai_service.MODEL_NAME, ai_service.MODEL_NAME]


def test_syllabus_gemini_failure_keeps_existing_fallback(monkeypatch):
    monkeypatch.setattr(
        ai_service,
        "_call_syllabus_ai",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(TimeoutError("timed out")),
    )
    tracker = GeminiUsageTracker()

    course_title, course_code, topics = ai_service.parse_syllabus_text_with_ai(
        "Syllabus text that cannot be parsed.",
        usage_tracker=tracker,
    )

    assert course_title == "Fundamentals of Analytics Modeling"
    assert course_code == "BAT402"
    assert topics == []
    assert tracker.failure_count == 1
    assert tracker.last_error_type == "TimeoutError"


def test_generate_tos_uses_department_leadership_names():
    workbook = generate_tos_from_excel_template(
        selected_topics_data=[{
            "topic_name": "Database Design",
            "ilo": "Create logical models.",
            "hours_a": 3,
            "minutes_b": 0.6,
            "weight": 100,
            "items": 5,
            "bloom_counts": {"Remember": 1, "Understand": 1, "Apply": 1, "Analyze": 1, "Evaluate": 1, "Create": 0},
            "bloom_question_numbers": {"Remember": "1", "Understand": "2", "Apply": "3", "Analyze": "4", "Evaluate": "5", "Create": ""},
        }],
        course_code="CS 101",
        course_title="Database Management",
        whole_total_items=5,
        exam_type="Final Exam",
        semester="First Semester",
        academic_year="2026-2027",
        instructor_name="Prof. Maria Santos",
        department="Computer Science",
        dean_name="Dr. Alice Reyes",
        program_chair_name="Dr. Ben Cruz",
        department_code="CICS",
        program_code="BSIT",
    )

    values = {str(cell.value).strip() for row in workbook.active.iter_rows() for cell in row if cell.value is not None}
    assert "Prof. Maria Santos" in values
    assert "Dr. Ben Cruz" in values
    assert "Dr. Alice Reyes" in values
    assert "Program Chair, BSIT" in values
    assert "Dean, CICS" in values
    assert any("2026-2027" in value for value in values)
    assert any("DEPARTMENT: Computer Science".lower() in value.lower() for value in values)
    assert "College of Informatics and Computing Sciences" not in str(workbook.active["B14"].value or "")
    assert "Computer Science" in str(workbook.active["B14"].value or "")
    assert workbook.active["D23"].value == 3.0
    assert workbook.active["E23"].value == 0.6


def test_generate_tos_uses_consistent_font_styling():
    workbook = generate_tos_from_excel_template(
        selected_topics_data=[{
            "topic_name": "Database Design",
            "ilo": "Create logical models.",
            "hours_a": 3,
            "minutes_b": 0.6,
            "weight": 100,
            "items": 5,
            "bloom_counts": {"Remember": 1, "Understand": 1, "Apply": 1, "Analyze": 1, "Evaluate": 1, "Create": 0},
            "bloom_question_numbers": {"Remember": "1", "Understand": "2", "Apply": "3", "Analyze": "4", "Evaluate": "5", "Create": ""},
        }],
        course_code="CS 101",
        course_title="Database Management",
        whole_total_items=5,
        exam_type="Final Exam",
        semester="First Semester",
        academic_year="2026-2027",
        instructor_name="Prof. Maria Santos",
        department="Computer Science",
        dean_name="Dr. Alice Reyes",
        program_chair_name="Dr. Ben Cruz",
    )

    ws = workbook.active
    assert ws["B14"].font.name == "Times New Roman"
    assert ws["B14"].font.size == 11
    assert ws["D23"].font.name == "Times New Roman"
    assert ws["D23"].font.size == 11
    assert ws["G21"].font.name == "Times New Roman"
    assert ws["G21"].font.size == 11


def test_group_questions_by_type_keeps_same_question_types_together():
    questions = [
        SimpleNamespace(id=1, question_type="Essay", question="Explain the process."),
        SimpleNamespace(id=2, question_type="MCQ", question="Which is correct?"),
        SimpleNamespace(id=3, question_type="MCQ", question="Another MCQ?"),
        SimpleNamespace(id=4, question_type="Essay", question="Reflect on the result."),
        SimpleNamespace(id=5, question_type="True or False", question="This is true?"),
    ]

    grouped = group_questions_by_type(questions)

    assert [group["type"] for group in grouped] == ["Essay", "MCQ", "True or False"]
    assert [q.id for q in grouped[0]["questions"]] == [1, 4]
    assert [q.id for q in grouped[1]["questions"]] == [2, 3]
    assert [q.id for q in grouped[2]["questions"]] == [5]


def test_answer_key_uses_option_letters_for_mcq_and_matching_type():
    from routers.assessment import _format_answer_key_value

    mcq = SimpleNamespace(
        question_type="MCQ",
        options=["Alpha", "Bravo", "Charlie"],
        correct_answer="Charlie",
    )
    assert _format_answer_key_value(mcq) == "C"

    true_false = SimpleNamespace(
        question_type="True or False",
        options=["True", "False"],
        correct_answer="True",
    )
    assert _format_answer_key_value(true_false) == "True"

    saved_true_false = SimpleNamespace(
        question_type="True or False",
        options=["True", "False"],
        correct_answer='["False"]',
    )
    assert _format_answer_key_value(saved_true_false) == "False"

    matching = SimpleNamespace(
        question_type="Matching Type",
        options={
            "left_items": ["A", "B"],
            "right_items": ["Alpha", "Bravo"],
        },
        correct_answer={"A": "Alpha", "B": "Bravo"},
    )
    assert _format_answer_key_value(matching) == "A -> A; B -> B"


def test_matching_type_falls_back_to_direct_left_and_right_fields():
    from routers.assessment import _get_matching_items

    question = SimpleNamespace(
        question_type="Matching Type",
        left_items=["IT concept", "Course code"],
        right_items=["System integration", "Prerequisite"],
        correct_answer={"IT concept": "System integration", "Course code": "Prerequisite"},
    )

    left_items, right_items = _get_matching_items(question)
    assert left_items == ["IT concept", "Course code"]
    assert right_items == ["System integration", "Prerequisite"]


def test_matching_type_answer_key_uses_letters_for_raw_brace_string_answers():
    from routers.assessment import _format_answer_key_value

    question = SimpleNamespace(
        question_type="Matching Type",
        options={
            "left_items": ["A", "B"],
            "right_items": ["Alpha", "Bravo"],
        },
        correct_answer='{"A": "Alpha", "B": "Bravo"}',
    )

    assert _format_answer_key_value(question) == "A -> A; B -> B"


def test_matching_type_accepts_pair_string_answers_from_db():
    from main import matching_choices

    question = SimpleNamespace(
        question_type="Matching Type",
        options={"left_items": ["A", "B"], "right_items": ["Alpha", "Bravo"]},
        correct_answer=["A -> Alpha", "B -> Bravo"],
    )

    left_items, right_items = matching_choices(question)
    assert left_items == ["A", "B"]
    assert right_items == ["Alpha", "Bravo"]


def test_assessment_docx_includes_matching_type_table_for_options_payloads():
    from docx import Document
    from routers.questions import _build_assessment_docx

    question = {
        "question": "Match the concept to its definition.",
        "question_type": "Matching Type",
        "options": {"left_items": ["Concept A", "Concept B"], "right_items": ["Definition A", "Definition B"]},
        "correct_answer": {"Concept A": "Definition A", "Concept B": "Definition B"},
    }

    content = _build_assessment_docx([question], "Course Title", "CS 101")
    document = Document(io.BytesIO(content))
    assert len(document.tables) >= 1

    table_rows = [
        [cell.text for cell in row.cells]
        for row in document.tables[0].rows
    ]

    assert ["Column A", "Column B"] in table_rows
    assert any("Concept A" in cell for row in table_rows for cell in row)
    assert any("Definition A" in cell for row in table_rows for cell in row)
    assert any("1. Concept A" in cell for row in table_rows for cell in row)
    assert any("A. Definition A" in cell for row in table_rows for cell in row)


def test_assessment_answer_key_matches_grouped_exam_question_numbers():
    from docx import Document
    from routers.assessment import build_assessment_docx

    questions = [
        SimpleNamespace(question="Select the first answer.", question_type="MCQ", options=["Alpha", "Bravo"], correct_answer="Alpha"),
        SimpleNamespace(question="Select the second answer.", question_type="MCQ", options=["Alpha", "Bravo"], correct_answer="Bravo"),
        SimpleNamespace(question="The statement is accurate.", question_type="True or False", options=["True", "False"], correct_answer='["False"]'),
        SimpleNamespace(question="The statement is accurate.", question_type="True or False", options=["True", "False"], correct_answer='["True"]'),
    ]
    docx_path = build_assessment_docx(
        SimpleNamespace(name="Course Title", code="CS 101"),
        questions,
    )
    try:
        document = Document(docx_path)
    finally:
        assessment_router.cleanup_file(docx_path)

    paragraphs = [paragraph.text for paragraph in document.paragraphs]
    answer_key_index = paragraphs.index("Answer Key")
    answer_key = paragraphs[answer_key_index + 1:]

    assert answer_key == [
        "I. Multiple Choice",
        "1. A",
        "2. B",
        "II. True or False",
        "3. False",
        "4. True",
    ]


def test_saved_assessment_export_restores_exam_type_and_academic_year():
    from docx import Document

    upload = SimpleNamespace(
        subject=SimpleNamespace(code="CS 101", name="Course Title")
    )
    tos_record = SimpleNamespace(
        exam_type="Midterm Exam",
        semester="First Semester",
        academic_year="2026-2027",
    )

    metadata = questions_router._saved_assessment_metadata(upload, tos_record)
    content = questions_router._build_assessment_docx(
        [{"question": "What is a database?", "question_type": "Essay"}],
        metadata["subject"]["name"],
        metadata["subject"]["code"],
        exam_type=metadata["exam_type"],
        semester=metadata["semester"],
        academic_year=metadata["academic_year"],
    )
    document = Document(io.BytesIO(content))
    document_text = "\n".join(paragraph.text for paragraph in document.paragraphs)

    assert "Midterm Exam" in document_text
    assert "First Semester, Academic Year 2026-2027" in document_text


def test_preview_saved_file_renders_spreadsheet_as_pdf(monkeypatch):
    import openpyxl
    from main import preview_saved_file
    import platform
    import shutil
    import subprocess

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "TOS"
    ws["A1"] = "TABLE OF SPECIFICATIONS"
    ws.merge_cells("A1:C1")
    ws["A2"] = "Course code"
    ws["B2"] = "CS 101"

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)

    class DummyLog:
        id = 999
        user_id = 1
        type = "download"
        filename = "sample-tos.xlsx"
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        file_content = stream.getvalue()

    db = SimpleNamespace(query=lambda *args, **kwargs: DummyQuery(DummyLog()))

    class DummyQuery:
        def __init__(self, log):
            self._log = log

        def filter(self, *args, **kwargs):
            return self

        def first(self):
            return self._log

    expected_pdf = b"%PDF-preview"

    def convert_to_pdf(command, **kwargs):
        output_dir = command[command.index("--outdir") + 1]
        with open(os.path.join(output_dir, "download.pdf"), "wb") as pdf_file:
            pdf_file.write(expected_pdf)
        return SimpleNamespace(returncode=0, stderr="", stdout="")

    monkeypatch.setattr(platform, "system", lambda: "Linux")
    monkeypatch.setattr(shutil, "which", lambda _name: "soffice")
    monkeypatch.setattr(subprocess, "run", convert_to_pdf)

    result = preview_saved_file(999, user_id=1, db=db)

    assert result.media_type == "application/pdf"
    assert result.body == expected_pdf


def test_preview_generated_file_converts_downloaded_office_blob(monkeypatch):
    import main as main_module

    expected_pdf = b"%PDF-preview"
    monkeypatch.setattr(
        main_module,
        "render_download_preview_pdf",
        lambda content, media_type: expected_pdf
        if content == b"generated-xlsx" and media_type.endswith("spreadsheetml.sheet")
        else b"",
    )
    previous_overrides = app.dependency_overrides.copy()
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1)
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/downloads/preview-file",
                files={"file": (
                    "assessment.xlsx",
                    b"generated-xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )},
            )
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("application/pdf")
        assert response.content == expected_pdf
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)
