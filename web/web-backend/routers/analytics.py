"""
Predictive + prescriptive analytics for Table of Specification (TOS) completion.

Predictive: compares the TOS's TARGET Bloom-level distribution (already
computed by compute_tos() in tos_utils.py and stored on
TableOfSpecification.tos_data) against the ACTUAL distribution of
GeneratedQuestion rows written so far for that TOS, to forecast whether the
exam will be Bloom-balanced by the time it's finished.

Prescriptive: turns any gap found above into a concrete, ranked list of
"add N more <bloom level> question(s) on <topic>" recommendations, and a
separate ML-powered endpoint recommends reusing existing Question Bank
content instead of writing new questions from scratch.
"""

from fastapi import APIRouter, Depends, HTTPException
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy.orm import Session

from database import get_db
import models
from routers.tos_utils import BLOOM_LEVELS

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

# Below this similarity score, a candidate question isn't a real topical
# match -- it's just TF-IDF noise -- so it gets dropped rather than shown
# as a false "similar" suggestion.
MIN_SIMILARITY = 0.08
MAX_SUGGESTIONS_PER_GAP = 3


def _empty_bloom_counts():
    return {level: 0 for level in BLOOM_LEVELS}


@router.get("/data-health-check")
def data_health_check(db: Session = Depends(get_db)):
    """Diagnostic only -- NOT part of the final feature.

    Shows the real distribution of lifecycle_status / review_status /
    edit-history across every question in the actual database, so we
    confirm with real numbers whether these fields carry any usable
    signal before building anything on top of them.
    """
    from sqlalchemy import func as sa_func

    total_questions = db.query(models.GeneratedQuestion).filter(
        models.GeneratedQuestion.archived.is_(False)
    ).count()

    lifecycle_counts = dict(
        db.query(models.GeneratedQuestion.lifecycle_status, sa_func.count())
        .filter(models.GeneratedQuestion.archived.is_(False))
        .group_by(models.GeneratedQuestion.lifecycle_status)
        .all()
    )
    review_counts = dict(
        db.query(models.GeneratedQuestion.review_status, sa_func.count())
        .filter(models.GeneratedQuestion.archived.is_(False))
        .group_by(models.GeneratedQuestion.review_status)
        .all()
    )
    questions_with_versions = (
        db.query(models.QuestionVersion.question_id)
        .distinct()
        .count()
    )
    total_version_rows = db.query(models.QuestionVersion).count()

    return {
        "total_active_questions": total_questions,
        "lifecycle_status_distribution": lifecycle_counts,
        "review_status_distribution": review_counts,
        "questions_with_at_least_one_edit": questions_with_versions,
        "total_version_rows_logged": total_version_rows,
    }


@router.get("/tos-list")
def list_tos_records(db: Session = Depends(get_db)):
    """Quick lookup helper: lists every TOS record's id alongside enough
    context (subject, exam type, total items, question count so far) to
    find the right tos_id to test /tos/{tos_id}/forecast with -- since the
    frontend doesn't currently surface tos_id anywhere in the UI.
    """
    records = db.query(models.TableOfSpecification).order_by(
        models.TableOfSpecification.id.desc()
    ).all()

    result = []
    for tos in records:
        question_count = db.query(models.GeneratedQuestion).filter(
            models.GeneratedQuestion.tos_id == tos.id,
            models.GeneratedQuestion.archived.is_(False),
        ).count()
        result.append({
            "tos_id": tos.id,
            "upload_id": tos.upload_id,
            "exam_type": tos.exam_type,
            "department": tos.department,
            "total_items_target": tos.total_items,
            "questions_written_so_far": question_count,
            "created_at": tos.created_at,
        })
    return result


@router.get("/tos/{tos_id}/forecast")
def get_tos_forecast(tos_id: int, db: Session = Depends(get_db)):
    tos = db.query(models.TableOfSpecification).filter(
        models.TableOfSpecification.id == tos_id
    ).first()
    if not tos:
        raise HTTPException(status_code=404, detail="Table of Specification not found")

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
def get_reuse_suggestions(tos_id: int, db: Session = Depends(get_db)):
    """ML-powered prescriptive recommendation.

    For every Bloom-level/topic gap in this TOS, search the ENTIRE Question
    Bank (across all subjects/TOS, not just this one) for existing, active
    questions that are:
      (a) classified at the exact Bloom level the gap needs (your trained
          classifier's output -- see classify_question_ml), and
      (b) topically similar to the gap's topic, via TF-IDF + cosine
          similarity over the candidate pool.

    Recommends reusing/adapting an existing question instead of generating
    a new one from scratch. This is a content-based recommender system:
    real ML (vector-space similarity), not a lookup table, and it directly
    builds on top of the Bloom classifier's output.
    """
    tos = db.query(models.TableOfSpecification).filter(
        models.TableOfSpecification.id == tos_id
    ).first()
    if not tos:
        raise HTTPException(status_code=404, detail="Table of Specification not found")

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
    # sense). review_status / lifecycle_status are NOT used as a filter
    # here since your team confirmed those approval fields aren't actually
    # used in practice -- "archived == False" is the only status signal
    # that's real in this system today.
    candidates = db.query(models.GeneratedQuestion).filter(
        models.GeneratedQuestion.archived.is_(False),
        models.GeneratedQuestion.tos_id != tos_id,
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