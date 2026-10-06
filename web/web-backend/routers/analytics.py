"""Progress and recommendations for authenticated users' Table of Specifications."""

from fastapi import APIRouter, Depends, HTTPException
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy.orm import Session

from database import get_db
import models
from routers.questions import _assert_upload_access
from routers.tos_utils import BLOOM_LEVELS
from security import get_current_user

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

# Below this similarity score, a candidate question isn't a real topical
# match -- it's just TF-IDF noise -- so it gets dropped rather than shown
# as a false "similar" suggestion.
MIN_SIMILARITY = 0.08
MAX_SUGGESTIONS_PER_GAP = 3


def _empty_bloom_counts():
    return {level: 0 for level in BLOOM_LEVELS}


def _get_authorized_tos(tos_id: int, db: Session, current_user):
    tos = db.query(models.TableOfSpecification).filter(
        models.TableOfSpecification.id == tos_id
    ).first()
    if not tos or not tos.upload_id:
        raise HTTPException(status_code=404, detail="Table of Specification not found")
    _assert_upload_access(str(tos.upload_id), current_user, db)
    return tos


def _get_accessible_tos_records(db: Session, current_user):
    records = db.query(models.TableOfSpecification).order_by(
        models.TableOfSpecification.id.desc()
    ).all()
    accessible = []
    for tos in records:
        if not tos.upload_id:
            continue
        try:
            _assert_upload_access(str(tos.upload_id), current_user, db)
        except HTTPException as exc:
            if exc.status_code in {403, 404}:
                continue
            raise
        accessible.append(tos)
    return accessible


@router.get("/tos-list")
def list_tos_records(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """List TOS records the signed-in user is authorized to analyze."""
    result = []
    for tos in _get_accessible_tos_records(db, current_user):
        question_count = db.query(models.GeneratedQuestion).filter(
            models.GeneratedQuestion.tos_id == tos.id,
            models.GeneratedQuestion.archived.is_(False),
        ).count()
        upload = db.query(models.UploadedFile).filter(
            models.UploadedFile.id == tos.upload_id
        ).first()
        subject_name = None
        if upload and upload.subject_id:
            subject_name = db.query(models.Subject.name).filter(
                models.Subject.id == upload.subject_id
            ).scalar()
        result.append({
            "tos_id": tos.id,
            "upload_id": tos.upload_id,
            "subject_name": subject_name,
            "exam_type": tos.exam_type,
            "department": tos.department,
            "total_items_target": tos.total_items,
            "questions_written_so_far": question_count,
            "created_at": tos.created_at,
        })
    return result


@router.get("/tos/{tos_id}/forecast")
def get_tos_forecast(
    tos_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    tos = _get_authorized_tos(tos_id, db, current_user)

    target_topics = tos.tos_data or []

    actual_questions = db.query(models.GeneratedQuestion).filter(
        models.GeneratedQuestion.tos_id == tos_id,
        models.GeneratedQuestion.archived.is_(False),
    ).all()

    actual_by_topic = {}
    for question in actual_questions:
        topic_name = question.topic_name or "General"
        counts = actual_by_topic.setdefault(topic_name, _empty_bloom_counts())
        level = question.bloom_level if question.bloom_level in counts else "Remember"
        counts[level] += 1

    topics_forecast = []
    overall_target = _empty_bloom_counts()
    overall_actual = _empty_bloom_counts()
    recommendations = []

    for topic in target_topics:
        topic_name = topic.get("topic_name", "Untitled Topic")
        target_counts = topic.get("bloom_counts", {}) or {}
        actual_counts = actual_by_topic.get(topic_name, _empty_bloom_counts())

        per_bloom = {}
        for level in BLOOM_LEVELS:
            target = int(target_counts.get(level, 0) or 0)
            actual = actual_counts.get(level, 0)
            gap = target - actual
            per_bloom[level] = {
                "target": target,
                "actual": actual,
                "gap": max(gap, 0),
                "surplus": max(-gap, 0),
            }
            overall_target[level] += target
            overall_actual[level] += actual

            if gap > 0:
                recommendations.append({
                    "topic_name": topic_name,
                    "bloom_level": level,
                    "needed": gap,
                    "message": (
                        f"Add {gap} more {level} question"
                        f"{'s' if gap != 1 else ''} on '{topic_name}'."
                    ),
                })

        target_total = sum(v["target"] for v in per_bloom.values())
        actual_total = sum(v["actual"] for v in per_bloom.values())
        completion_pct = round((actual_total / target_total) * 100, 1) if target_total else 0.0

        topics_forecast.append({
            "topic_name": topic_name,
            "target_total": target_total,
            "actual_total": actual_total,
            "completion_pct": completion_pct,
            "bloom_levels": per_bloom,
        })

    overall_target_total = sum(overall_target.values())
    overall_actual_total = sum(overall_actual.values())
    overall_completion_pct = (
        round((overall_actual_total / overall_target_total) * 100, 1)
        if overall_target_total else 0.0
    )

    at_risk_levels = []
    for level in BLOOM_LEVELS:
        target = overall_target[level]
        if target == 0:
            continue
        level_completion = (overall_actual[level] / target) * 100
        if level_completion < overall_completion_pct - 15:
            at_risk_levels.append({
                "bloom_level": level,
                "target": target,
                "actual": overall_actual[level],
                "completion_pct": round(level_completion, 1),
            })

    recommendations.sort(key=lambda r: r["needed"], reverse=True)

    return {
        "tos_id": tos_id,
        "predictive": {
            "overall_completion_pct": overall_completion_pct,
            "overall_target_total": overall_target_total,
            "overall_actual_total": overall_actual_total,
            "overall_bloom_levels": {
                level: {
                    "target": overall_target[level],
                    "actual": overall_actual[level],
                }
                for level in BLOOM_LEVELS
            },
            "at_risk_bloom_levels": at_risk_levels,
            "topics": topics_forecast,
        },
        "prescriptive": {
            "recommendations": recommendations,
            "top_priorities": recommendations[:5],
        },
    }


@router.get("/tos/{tos_id}/reuse-suggestions")
def get_reuse_suggestions(
    tos_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Recommend accessible questions using saved Bloom labels and TF-IDF similarity."""
    tos = _get_authorized_tos(tos_id, db, current_user)

    target_topics = tos.tos_data or []

    actual_questions = db.query(models.GeneratedQuestion).filter(
        models.GeneratedQuestion.tos_id == tos_id,
        models.GeneratedQuestion.archived.is_(False),
    ).all()
    actual_by_topic = {}
    for question in actual_questions:
        topic_name = question.topic_name or "General"
        counts = actual_by_topic.setdefault(topic_name, _empty_bloom_counts())
        level = question.bloom_level if question.bloom_level in counts else "Remember"
        counts[level] += 1

    gaps = []
    for topic in target_topics:
        topic_name = topic.get("topic_name", "Untitled Topic")
        target_counts = topic.get("bloom_counts", {}) or {}
        actual_counts = actual_by_topic.get(topic_name, _empty_bloom_counts())
        for level in BLOOM_LEVELS:
            target = int(target_counts.get(level, 0) or 0)
            actual = actual_counts.get(level, 0)
            gap = target - actual
            if gap > 0:
                gaps.append({"topic_name": topic_name, "bloom_level": level, "needed": gap})

    if not gaps:
        return {"tos_id": tos_id, "suggestions": [], "note": "No gaps to fill -- exam is complete."}

    # Candidate pool: non-archived (i.e. not deleted) questions from OTHER
    # TOS records (reusing a question already in this exam doesn't make
    # sense). Archived questions are excluded from the candidate pool.
    accessible_tos_ids = [
        record.id for record in _get_accessible_tos_records(db, current_user)
    ]
    candidates = db.query(models.GeneratedQuestion).filter(
        models.GeneratedQuestion.archived.is_(False),
        models.GeneratedQuestion.tos_id != tos_id,
        models.GeneratedQuestion.tos_id.in_(accessible_tos_ids),
    ).all()

    if not candidates:
        return {
            "tos_id": tos_id,
            "suggestions": [
                {**gap, "matches": [], "note": "No other questions in the bank yet to recommend from."}
                for gap in gaps
            ],
        }

    candidate_texts = [
        f"{c.topic_name or ''} {c.question or ''}" for c in candidates
    ]
    vectorizer = TfidfVectorizer(stop_words="english")
    candidate_matrix = vectorizer.fit_transform(candidate_texts)

    suggestions = []
    for gap in gaps:
        level_mask = [i for i, c in enumerate(candidates) if c.bloom_level == gap["bloom_level"]]
        if not level_mask:
            suggestions.append({**gap, "matches": []})
            continue

        query_vec = vectorizer.transform([gap["topic_name"]])
        level_matrix = candidate_matrix[level_mask]
        scores = cosine_similarity(query_vec, level_matrix).flatten()

        ranked = sorted(zip(level_mask, scores), key=lambda pair: pair[1], reverse=True)
        matches = []
        for idx, score in ranked:
            if score < MIN_SIMILARITY:
                break
            if len(matches) >= MAX_SUGGESTIONS_PER_GAP:
                break
            c = candidates[idx]
            matches.append({
                "question_id": c.id,
                "question": c.question,
                "topic_name": c.topic_name,
                "subject_id": c.subject_id,
                "similarity": round(float(score), 3),
            })

        suggestions.append({**gap, "matches": matches})

    return {"tos_id": tos_id, "suggestions": suggestions}