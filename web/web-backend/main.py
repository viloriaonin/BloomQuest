from typing import Optional
from contextlib import asynccontextmanager
import io
import json
import base64
import openpyxl
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, status, BackgroundTasks, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy.orm import Session
from sqlalchemy import func, text, or_, and_
from sqlalchemy.exc import IntegrityError
from dotenv import load_dotenv
from database import engine, get_db, SessionLocal
from file_extractor import extract_text
from ai_service import GeminiUsageTracker, generate_questions_from_tos, build_preview, prepare_database_rows, statistics, parse_syllabus_text_with_ai
from routers.tos_utils import compute_tos, generate_tos_from_excel_template
from classifier import classify_question
import models
from datetime import date, datetime, timedelta, timezone
import logging
from html import escape as escape_html


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)
import os
import random
import re
import hashlib
import hmac
import secrets
import time
from collections import defaultdict
from routers import assessment 
from routers import questions
from routers.questions import _resolve_department_leadership
from routers.assessment import build_assessment_docx, cleanup_file, convert_docx_to_pdf
from routers import activity
from security import get_current_user, get_optional_current_user, require_admin, require_campus_admin, require_super_admin, assert_campus_access, visible_campus_id, user_campus_id, subject_campus_id, assert_user_subject_campus_access
import smtplib
import string
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "database.env"))

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
SAFE_NAME_REGEX = re.compile(r"^[A-Za-zÀ-ÿ\u00C0-\u024F .'-]{2,100}$")
ALLOWED_UPLOAD_EXTENSIONS = {".pdf", ".docx", ".xlsx", ".xls"}
DENIED_UPLOAD_EXTENSIONS = {".exe", ".bat", ".cmd", ".scr", ".com", ".jar", ".ps1", ".php", ".jsp", ".html", ".svg", ".js", ".ts", ".py"}
DISALLOWED_MIME_SIGNATURES = {
    "image/png": b"\x89PNG\r\n\x1a\n",
    "image/jpeg": b"\xff\xd8\xff",
    "image/gif": b"GIF87a",
    "image/gif": b"GIF89a",
    "image/webp": b"RIFF",
}
MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024
RATE_LIMIT_WINDOW_SECONDS = 300
RATE_LIMIT_MAX_REQUESTS = 5
RATE_LIMIT_BUCKETS = defaultdict(list)

models.Base.metadata.create_all(bind=engine)


with engine.begin() as connection:
    connection.execute(text("ALTER TABLE subjects ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE"))
    connection.execute(text("ALTER TABLE subjects ADD COLUMN IF NOT EXISTS user_id INTEGER"))
    connection.execute(text("ALTER TABLE departments ADD COLUMN IF NOT EXISTS dean_name VARCHAR(255)"))
    connection.execute(text("ALTER TABLE departments ADD COLUMN IF NOT EXISTS chair_name VARCHAR(255)"))
    connection.execute(text("ALTER TABLE programs ADD COLUMN IF NOT EXISTS chair_name VARCHAR(255)"))
    if connection.dialect.name == "postgresql":
        connection.execute(text("DROP INDEX IF EXISTS ix_departments_name"))
        connection.execute(text("DROP INDEX IF EXISTS ix_departments_code"))
        connection.execute(text("DROP INDEX IF EXISTS departments_name_key"))
        connection.execute(text("DROP INDEX IF EXISTS departments_code_key"))
        connection.execute(text("DROP INDEX IF EXISTS uq_department_campus_name"))
        connection.execute(text("DROP INDEX IF EXISTS uq_department_campus_code"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_department_campus_name ON departments (campus_id, lower(name)) WHERE campus_id IS NOT NULL"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_department_campus_code ON departments (campus_id, lower(code)) WHERE campus_id IS NOT NULL AND code IS NOT NULL"))
        connection.execute(text("ALTER TABLE uploaded_files ALTER COLUMN user_id DROP NOT NULL"))
    binary_definition = "BYTEA" if connection.dialect.name == "postgresql" else "BLOB"
    for column, definition in (("filename", "VARCHAR(255)"), ("media_type", "VARCHAR(255)"), ("file_content", binary_definition), ("archived", "BOOLEAN NOT NULL DEFAULT FALSE"), ("actor_id", "INTEGER"), ("target_user_id", "INTEGER")):
        connection.execute(text(f"ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS {column} {definition}"))
    for column, definition in (
        ("exam_type", "VARCHAR(64)"),
        ("semester", "VARCHAR(32)"),
        ("academic_year", "VARCHAR(32)"),
        ("instructor_name", "VARCHAR(255)"),
        ("department", "VARCHAR(255)"),
    ):
        connection.execute(text(f"ALTER TABLE table_of_specification ADD COLUMN IF NOT EXISTS {column} {definition}"))


def log_activity(db: Session, action: str, details: str, type: str, status: str = "success", user_id: int = None, actor_id: int = None, target_user_id: int = None):
    actor_id = actor_id if actor_id is not None else user_id
    target_user_id = target_user_id if target_user_id is not None else user_id
    entry = models.ActivityLog(
        user_id=user_id,
        actor_id=actor_id,
        target_user_id=target_user_id,
        action=action,
        details=details,
        type=type,
        status=status
    )
    db.add(entry)
    db.commit()


def log_download(db: Session, action: str, details: str, filename: str, media_type: str, content: bytes, user_id: int = None):
    entry = models.ActivityLog(user_id=user_id, action=action, details=details, type="download", status="success", filename=filename, media_type=media_type, file_content=content)
    db.add(entry)
    db.commit()
    return entry


def detect_subject(syllabus_text: str, usage_tracker: GeminiUsageTracker | None = None):
    course_title, course_code, topics = parse_syllabus_text_with_ai(syllabus_text, usage_tracker)
    return {"name": course_title, "code": course_code, "description": ""}


def detect_topics(syllabus_text: str, module_text: str, usage_tracker: GeminiUsageTracker | None = None):
    course_title, course_code, topics = parse_syllabus_text_with_ai(syllabus_text, usage_tracker)
    return {"course_title": course_title, "course_code": course_code, "topics": topics}


def build_assessment_document(
    questions,
    subject_name,
    export_format,
    include_answer_key=True,
    answer_mode="with_key",
    subject_code="",
    exam_type="Final Examination",
    semester="",
    academic_year="",
    class_info="",
    directions=None,
):
    SubjectLike = type("SubjectLike", (), {"name": subject_name, "code": subject_code})
    docx_path = build_assessment_docx(
        SubjectLike(),
        questions,
        include_answer_key=include_answer_key,
        answer_mode=answer_mode,
        exam_type=exam_type,
        semester=semester,
        academic_year=academic_year,
        class_info=class_info,
        directions=directions,
    )
    try:
        if export_format == "docx":
            with open(docx_path, "rb") as f:
                content = f.read()
            filename = f"{subject_name.replace(' ', '_')}_Assessment.docx"
            return content, filename

        if export_format == "pdf":
            pdf_path = docx_path.replace(".docx", ".pdf")
            convert_docx_to_pdf(docx_path, pdf_path)
            with open(pdf_path, "rb") as f:
                content = f.read()
            filename = f"{subject_name.replace(' ', '_')}_Assessment.pdf"
            cleanup_file(pdf_path)
            return content, filename

        raise ValueError(f"Unsupported export format: {export_format}")
    finally:
        cleanup_file(docx_path)


def matching_choices(question):
    candidates = [getattr(question, "options", None), getattr(question, "matching_options", None), getattr(question, "choice_map", None)]
    for candidate in candidates:
        if isinstance(candidate, str):
            try:
                candidate = json.loads(candidate)
            except (TypeError, json.JSONDecodeError):
                candidate = None
        if isinstance(candidate, dict):
            for left_key, right_key in (("left_items", "right_items"), ("column_a", "column_b"), ("left", "right")):
                left_items = candidate.get(left_key) or []
                right_items = candidate.get(right_key) or []
                if left_items and right_items:
                    return list(left_items), list(right_items)

    for left_key, right_key in (("left_items", "right_items"), ("column_a", "column_b")):
        left_items = getattr(question, left_key, None)
        right_items = getattr(question, right_key, None)
        if left_items and right_items:
            return list(left_items), list(right_items)

    answer = getattr(question, "correct_answer", None)
    if isinstance(answer, str):
        try:
            answer = json.loads(answer)
        except (TypeError, json.JSONDecodeError):
            answer = None
    if isinstance(answer, dict):
        return list(answer.keys()), list(answer.values())
    if isinstance(answer, list):
        mapping = {}
        for item in answer:
            if isinstance(item, dict):
                mapping.update({str(k): str(v) for k, v in item.items()})
            elif isinstance(item, str) and "->" in item:
                left, right = item.split("->", 1)
                mapping[str(left).strip()] = str(right).strip()
        if mapping:
            return list(mapping.keys()), list(mapping.values())
    return [], []


def serialize_question(question):
    options = question.options
    if question.question_type == "Matching Type":
        left_items, right_items = matching_choices(question)
        options = {"left_items": left_items, "right_items": right_items}
    return {
        "id": question.id,
        "subject_id": question.subject_id,
        "topic_name": question.topic_name,
        "bloom_level": question.bloom_level,
        "question_type": question.question_type,
        "points": question.points,
        "question": question.question,
        "options": options,
        "correct_answer": question.correct_answer,
        "explanation": question.explanation,
        "review_status": question.review_status,
        "lifecycle_status": "archived" if question.archived else (question.lifecycle_status or "draft"),
        "difficulty": question.difficulty,
        "created_at": question.created_at,
    }


# Ensure the new archive, name, and department columns exist in the users table.
# SQLAlchemy's create_all does not alter existing tables, so we add missing columns explicitly.
with engine.begin() as conn:
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE"))
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR"))
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR"))
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS campus_id INTEGER REFERENCES campuses(id)"))
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS program_id INTEGER"))
    conn.execute(text("ALTER TABLE campuses ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE"))
    conn.execute(text("ALTER TABLE account_requests ADD COLUMN IF NOT EXISTS program_id INTEGER"))
    conn.execute(text("ALTER TABLE account_requests ADD COLUMN IF NOT EXISTS campus_id INTEGER REFERENCES campuses(id)"))
    conn.execute(text("UPDATE account_requests SET campus_id = departments.campus_id FROM programs JOIN departments ON departments.id = programs.department_id WHERE account_requests.program_id = programs.id AND account_requests.campus_id IS NULL"))
    conn.execute(text("ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_department"))
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"))
    conn.execute(text("ALTER TABLE subjects ADD COLUMN IF NOT EXISTS department_id INTEGER"))
    conn.execute(text("ALTER TABLE subjects ADD COLUMN IF NOT EXISTS program_id INTEGER"))
    conn.execute(text("ALTER TABLE departments ADD COLUMN IF NOT EXISTS campus_id INTEGER"))
    conn.execute(text("ALTER TABLE departments ADD COLUMN IF NOT EXISTS dean_id INTEGER"))
    conn.execute(text("ALTER TABLE programs ADD COLUMN IF NOT EXISTS chair_id INTEGER"))
    conn.execute(text("ALTER TABLE generated_questions ADD COLUMN IF NOT EXISTS review_status VARCHAR(32) NOT NULL DEFAULT 'needs_review'"))
    conn.execute(text("ALTER TABLE generated_questions ADD COLUMN IF NOT EXISTS difficulty VARCHAR(32) NOT NULL DEFAULT 'moderate'"))
    conn.execute(text("ALTER TABLE generated_questions ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE"))
    conn.execute(text("ALTER TABLE generated_questions ADD COLUMN IF NOT EXISTS lifecycle_status VARCHAR(32) NOT NULL DEFAULT 'draft'"))
    conn.execute(text("UPDATE generated_questions SET lifecycle_status = CASE review_status WHEN 'approved' THEN 'approved' WHEN 'in_review' THEN 'review' ELSE 'draft' END WHERE lifecycle_status IS NULL OR lifecycle_status = 'draft'"))
    conn.execute(text("ALTER TABLE generated_questions ADD COLUMN IF NOT EXISTS user_id INTEGER"))
    conn.execute(text("ALTER TABLE generated_questions ADD COLUMN IF NOT EXISTS points FLOAT"))
    conn.execute(text("ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS exam_title VARCHAR(255)"))
    conn.execute(text("ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS instructions TEXT"))
    conn.execute(text("ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS total_points INTEGER"))
    conn.execute(text("ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS time_limit VARCHAR(64)"))
    conn.execute(text("ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS instructor_name VARCHAR(255)"))
    conn.execute(text("ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS department VARCHAR(255)"))

# Seed the default academic departments so the mobile dropdown has visible choices.
with SessionLocal() as db:
    existing_departments = db.query(models.Department).count()
    if existing_departments == 0:
        default_departments = [
            ("College of Informatics and Computing Sciences", "CICS"),
            ("College of Engineering", "COE"),
            ("College of Arts and Sciences", "CAS"),
            ("College of Business Administration", "CBA"),
        ]
        for name, code in default_departments:
            db.add(models.Department(name=name, code=code))
        db.commit()

with SessionLocal() as db:
    main_campus = db.query(models.Campus).order_by(models.Campus.id.asc()).first()
    if not main_campus:
        main_campus = models.Campus(name="Main Campus", code="MAIN")
        db.add(main_campus)
        db.commit()
        db.refresh(main_campus)
    db.query(models.Department).filter(models.Department.campus_id.is_(None)).update(
        {"campus_id": main_campus.id}, synchronize_session=False
    )
    sample_department = db.query(models.Department).filter(models.Department.code == "CICS").first()
    if not sample_department:
        sample_department = models.Department(
            name="College of Informatics and Computing Sciences",
            code="CICS",
            campus_id=main_campus.id,
        )
        db.add(sample_department)
        db.flush()
    sample_programs = [
        ("Bachelor of Science in Information Technology", "BSIT", [("Introduction to Computing", "IT101"), ("Programming 1", "IT102"), ("Database Systems", "IT201")]),
        ("Bachelor of Science in Computer Science", "BSCS", [("Data Structures and Algorithms", "CS201"), ("Software Engineering", "CS301")]),
    ]
    for program_name, program_code, sample_subjects in sample_programs:
        program = db.query(models.Program).filter(
            models.Program.department_id == sample_department.id,
            models.Program.code == program_code,
        ).first()
        if not program:
            program = models.Program(name=program_name, code=program_code, department_id=sample_department.id)
            db.add(program)
            db.flush()
        for subject_name, subject_code in sample_subjects:
            if not db.query(models.Subject).filter(models.Subject.code == subject_code).first():
                db.add(models.Subject(name=subject_name, code=subject_code, description="BatStateU academic subject sample.", department_id=sample_department.id, program_id=program.id))
    db.commit()

def migrate_subject_name_scope():
    if engine.dialect.name != "postgresql":
        return
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_name_key"))
        connection.execute(text("DROP INDEX IF EXISTS ix_subjects_name"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_subjects_name ON subjects (name)"))
        connection.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_subjects_active_scope_name "
            "ON subjects (COALESCE(program_id, -department_id, 0), LOWER(name)) "
            "WHERE archived IS FALSE"
        ))


@asynccontextmanager
async def app_lifespan(_app: FastAPI):
    migrate_subject_name_scope()
    yield


app = FastAPI(lifespan=app_lifespan)


@app.post("/api/logout")
def logout(authorization: str = Header(None), db: Session = Depends(get_db)):
    if authorization and authorization.lower().startswith("bearer "):
        token_hash = hashlib.sha256(authorization.split(" ", 1)[1].strip().encode()).hexdigest()
        db.query(models.UserSession).filter(models.UserSession.token_hash == token_hash).update({"revoked_at": utc_now()})
        db.commit()
    return {"message": "Logged out"}


def question_quality_score(question):
    checks = {
        "content_complete": bool((question.question or "").strip()),
        "answer_present": bool((question.correct_answer or "").strip()) if isinstance(question.correct_answer, str) else bool(question.correct_answer),
        "explanation_present": bool((question.explanation or "").strip()),
        "bloom_classified": bool((question.bloom_level or "").strip()),
        "difficulty_set": question.difficulty in {"easy", "moderate", "hard"},
        "reviewed": (question.lifecycle_status or "draft") in {"approved", "published"},
    }
    return round(sum(checks.values()) / len(checks) * 100), checks


@app.get("/api/admin/me")
def get_admin_me(db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    return {
        "id": admin.id,
        "email": admin.email,
        "role": admin.role,
        "name": admin.name or admin.email,
    }


def admin_scoped_user_query(db: Session, admin: models.User):
    query = db.query(models.User)
    campus_id = visible_campus_id(admin)
    if campus_id is None:
        return query
    program_ids = db.query(models.Program.id).join(
        models.Department, models.Department.id == models.Program.department_id
    ).filter(models.Department.campus_id == campus_id)
    department_names = db.query(func.lower(models.Department.name)).filter(models.Department.campus_id == campus_id)
    return query.filter(or_(
        models.User.campus_id == campus_id,
        models.User.program_id.in_(program_ids),
        func.lower(models.User.department).in_(department_names),
    ))


def assert_admin_can_access_user(db: Session, admin: models.User, target: models.User) -> None:
    campus_id = visible_campus_id(admin)
    if campus_id is None:
        return
    target_campus_id = user_campus_id(db, target)
    if target_campus_id == campus_id:
        return
    if target.department and db.query(models.Department.id).filter(
        models.Department.campus_id == campus_id,
        func.lower(models.Department.name) == target.department.strip().lower(),
    ).first():
        return
    raise HTTPException(status_code=404, detail="User not found")


def assert_admin_can_access_request(db: Session, admin: models.User, request_entry: models.AccountRequest) -> None:
    campus_id = visible_campus_id(admin)
    if campus_id is None:
        return
    if request_entry.campus_id is not None:
        if request_entry.campus_id != campus_id:
            raise HTTPException(status_code=404, detail="Account request not found")
        return
    department = db.query(models.Department).join(
        models.Program, models.Program.department_id == models.Department.id
    ).filter(models.Program.id == request_entry.program_id).first() if request_entry.program_id else None
    if not department or department.campus_id != campus_id:
        raise HTTPException(status_code=404, detail="Account request not found")


def validate_account_request_scope(db: Session, campus_id: int, department_name: str, program_id: int) -> None:
    campus = db.query(models.Campus).filter(
        models.Campus.id == campus_id,
        models.Campus.is_active.is_(True),
    ).first()
    if not campus:
        raise HTTPException(status_code=422, detail="Select an active campus.")

    department = db.query(models.Department).filter(
        models.Department.campus_id == campus_id,
        func.lower(models.Department.name) == department_name.strip().lower(),
    ).first()
    if not department:
        raise HTTPException(status_code=422, detail="Select a department from the chosen campus.")

    program = db.query(models.Program).filter(
        models.Program.id == program_id,
        models.Program.department_id == department.id,
    ).first()
    if not program:
        raise HTTPException(status_code=422, detail="Select a program from the chosen department.")


def question_campus_id(db: Session, question: models.GeneratedQuestion) -> int | None:
    if question.user_id:
        owner = db.query(models.User).filter(models.User.id == question.user_id).first()
        return user_campus_id(db, owner) if owner else None
    if question.tos_id:
        upload = db.query(models.UploadedFile).join(
            models.TableOfSpecification, models.TableOfSpecification.upload_id == models.UploadedFile.id
        ).filter(models.TableOfSpecification.id == question.tos_id).first()
        if upload and upload.user_id:
            owner = db.query(models.User).filter(models.User.id == upload.user_id).first()
            return user_campus_id(db, owner) if owner else None
    subject = db.query(models.Subject).filter(models.Subject.id == question.subject_id).first() if question.subject_id else None
    return subject_campus_id(db, subject) if subject else None


def assert_question_access(db: Session, actor: models.User, question: models.GeneratedQuestion) -> None:
    role = str(actor.role).lower()
    if role == "super_admin":
        return
    if role == "campus_admin":
        campus_id = question_campus_id(db, question)
        if campus_id is None:
            raise HTTPException(status_code=404, detail="Question not found")
        assert_campus_access(actor, campus_id)
        return
    actor_campus_id = user_campus_id(db, actor)
    question_owner_campus_id = question_campus_id(db, question)
    if actor_campus_id is not None and question_owner_campus_id != actor_campus_id:
        raise HTTPException(status_code=404, detail="Question not found")
    subject_owner_id = db.query(models.Subject.user_id).filter(models.Subject.id == question.subject_id).scalar() if question.subject_id else None
    upload_owner_id = None
    if question.tos_id:
        upload_owner_id = db.query(models.UploadedFile.user_id).join(
            models.TableOfSpecification, models.TableOfSpecification.upload_id == models.UploadedFile.id
        ).filter(models.TableOfSpecification.id == question.tos_id).scalar()
    if actor.id not in {question.user_id, subject_owner_id, upload_owner_id}:
        raise HTTPException(status_code=404, detail="Question not found")


def accessible_subject_ids(db: Session, actor: models.User, include_archived: bool = False) -> list[int] | None:
    role = str(actor.role).lower()
    if role == "super_admin":
        return None
    query = db.query(models.Subject.id)
    if not include_archived:
        query = query.filter(models.Subject.archived.is_(False))
    if role == "campus_admin":
        campus_id = visible_campus_id(actor)
        department_ids = db.query(models.Department.id).filter(models.Department.campus_id == campus_id).subquery()
        program_ids = db.query(models.Program.id).filter(models.Program.department_id.in_(department_ids)).subquery()
        query = query.filter(or_(models.Subject.department_id.in_(department_ids), models.Subject.program_id.in_(program_ids)))
    else:
        query = query.outerjoin(
            models.GeneratedQuestion, models.GeneratedQuestion.subject_id == models.Subject.id
        ).outerjoin(
            models.TableOfSpecification, models.TableOfSpecification.id == models.GeneratedQuestion.tos_id
        ).outerjoin(
            models.UploadedFile, models.UploadedFile.id == models.TableOfSpecification.upload_id
        ).filter(or_(
            models.Subject.user_id == actor.id,
            models.GeneratedQuestion.user_id == actor.id,
            models.UploadedFile.user_id == actor.id,
        ))
    return [row[0] for row in query.distinct().all()]


def program_subject_scope(db: Session, program_id: int) -> tuple[list[int], list[int]]:
    program = db.query(models.Program).filter(models.Program.id == program_id).first()
    department = db.query(models.Department).filter(models.Department.id == program.department_id).first() if program else None
    if not program or not department:
        return [], []
    faculty_query = db.query(models.User.id).filter(
        models.User.program_id == program_id,
        models.User.role.ilike("faculty"),
        models.User.archived.is_(False),
    )
    if department.campus_id is not None:
        faculty_query = faculty_query.filter(or_(
            models.User.campus_id == department.campus_id,
            models.User.campus_id.is_(None),
        ))
    faculty_ids = [row[0] for row in faculty_query.all()]
    question_subject_ids = db.query(models.GeneratedQuestion.subject_id).filter(
        models.GeneratedQuestion.user_id.in_(faculty_ids),
        models.GeneratedQuestion.subject_id.isnot(None),
        models.GeneratedQuestion.archived.is_(False),
    )
    uploaded_subject_ids = db.query(models.UploadedFile.subject_id).filter(
        models.UploadedFile.user_id.in_(faculty_ids),
        models.UploadedFile.subject_id.isnot(None),
    )
    tos_upload_subject_ids = db.query(models.GeneratedQuestion.subject_id).join(
        models.TableOfSpecification,
        models.TableOfSpecification.id == models.GeneratedQuestion.tos_id,
    ).join(
        models.UploadedFile,
        models.UploadedFile.id == models.TableOfSpecification.upload_id,
    ).filter(
        models.UploadedFile.user_id.in_(faculty_ids),
        models.GeneratedQuestion.subject_id.isnot(None),
        models.GeneratedQuestion.archived.is_(False),
    )
    subject_ids = [row[0] for row in db.query(models.Subject.id).filter(or_(
        models.Subject.user_id.in_(faculty_ids),
        models.Subject.id.in_(question_subject_ids),
        models.Subject.id.in_(uploaded_subject_ids),
        models.Subject.id.in_(tos_upload_subject_ids),
    )).all()]
    return faculty_ids, subject_ids


def assert_subject_access(db: Session, actor: models.User, subject: models.Subject) -> None:
    accessible_ids = accessible_subject_ids(db, actor, include_archived=True)
    if accessible_ids is not None and subject.id not in accessible_ids:
        raise HTTPException(status_code=404, detail="Subject not found")


@app.get("/api/admin/insights")
def get_admin_insights(db: Session = Depends(get_db), _admin: models.User = Depends(require_admin)):
    campus_id = visible_campus_id(_admin)
    visible_user_ids = [row[0] for row in admin_scoped_user_query(db, _admin).with_entities(models.User.id).all()]
    faculty = db.query(models.User).filter(
        models.User.role.ilike("faculty"),
        models.User.archived.is_(False),
        models.User.id.in_(visible_user_ids),
    ).all()
    question_query = db.query(models.GeneratedQuestion)
    if campus_id is not None:
        department_ids = db.query(models.Department.id).filter(models.Department.campus_id == campus_id).subquery()
        program_ids = db.query(models.Program.id).filter(models.Program.department_id.in_(department_ids)).subquery()
        subject_ids = db.query(models.Subject.id).filter(
            or_(models.Subject.department_id.in_(department_ids), models.Subject.program_id.in_(program_ids))
        ).subquery()
        question_query = question_query.outerjoin(
            models.TableOfSpecification, models.TableOfSpecification.id == models.GeneratedQuestion.tos_id
        ).outerjoin(
            models.UploadedFile, models.UploadedFile.id == models.TableOfSpecification.upload_id
        ).filter(or_(
            models.GeneratedQuestion.subject_id.in_(subject_ids),
            models.GeneratedQuestion.user_id.in_(visible_user_ids),
            models.UploadedFile.user_id.in_(visible_user_ids),
        ))
    questions = question_query.all()
    metrics = []
    for member in faculty:
        owned = [question for question in questions if question.user_id == member.id]
        active = [question for question in owned if not question.archived]
        scores = [question_quality_score(question)[0] for question in active]
        metrics.append({
            "faculty_id": member.id,
            "faculty_name": member.name or member.email,
            "department": member.department or "Unassigned",
            "questions_contributed": len(owned),
            "active_questions": len(active),
            "archived_questions": len(owned) - len(active),
            "published_questions": sum((question.lifecycle_status or "draft") == "published" for question in active),
            "approved_questions": sum((question.lifecycle_status or "draft") == "approved" for question in active),
            "draft_questions": sum((question.lifecycle_status or "draft") in {"draft", "review"} for question in active),
            "deprecated_questions": sum((question.lifecycle_status or "draft") == "deprecated" for question in active),
            "content_quality_score": round(sum(scores) / len(scores)) if scores else 0,
        })
    all_active = [question for question in questions if not question.archived]
    all_scores = [question_quality_score(question)[0] for question in all_active]
    department_metrics = {}
    for item in metrics:
        department = item["department"]
        bucket = department_metrics.setdefault(department, {"department": department, "faculty": 0, "questions_contributed": 0, "published_questions": 0, "activity": 0, "quality_scores": []})
        bucket["faculty"] += 1
        bucket["questions_contributed"] += item["questions_contributed"]
        bucket["published_questions"] += item["published_questions"]
        bucket["quality_scores"].append(item["content_quality_score"])
        bucket["activity"] += sum(1 for entry in db.query(models.ActivityLog).filter(models.ActivityLog.user_id == item["faculty_id"]).all())
    departments = []
    for item in department_metrics.values():
        quality_scores = item.get("quality_scores", [])
        departments.append({
            **{key: value for key, value in item.items() if key != "quality_scores"},
            "quality_score": round(sum(quality_scores) / len(quality_scores)) if quality_scores else 0,
        })
    request_query = db.query(models.AccountRequest).filter(models.AccountRequest.status == "pending")
    if campus_id is not None:
        request_query = request_query.join(
            models.Program, models.Program.id == models.AccountRequest.program_id
        ).join(
            models.Department, models.Department.id == models.Program.department_id
        ).filter(models.Department.campus_id == campus_id)
    pending_count = request_query.count()
    review_count = sum(1 for question in all_active if (question.lifecycle_status or "draft") in {"draft", "review"})
    activity_query = db.query(models.ActivityLog).filter(models.ActivityLog.status == "error")
    if campus_id is not None:
        activity_query = activity_query.filter(models.ActivityLog.user_id.in_(visible_user_ids))
    failed_count = activity_query.count()
    return {
        "faculty": sorted(metrics, key=lambda item: item["questions_contributed"], reverse=True),
        "departments": sorted(departments, key=lambda item: item["questions_contributed"], reverse=True),
        "content_quality_score": round(sum(all_scores) / len(all_scores)) if all_scores else 0,
        "quality_scope": "Content completeness and governance checks; not learner performance.",
        "notifications": [
            {"type": "account", "title": "New account requests", "count": pending_count} if pending_count else None,
            {"type": "review", "title": "Questions awaiting review", "count": review_count} if review_count else None,
            {"type": "error", "title": "Failed system actions", "count": failed_count} if failed_count else None,
            {"type": "inactive", "title": "Inactive faculty", "count": sum(1 for item in metrics if item["questions_contributed"] == 0)},
        ],
    }

otp_store = {}
change_password_otp_store = {}
contact_admin_otp_store = {}
contact_admin_pending_requests = {}

# Allow React frontend to talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001,http://localhost:5173").split(","),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "same-origin"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=()"
    return response


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = normalize_email(value)
        if not EMAIL_REGEX.fullmatch(normalized):
            raise ValueError("Please provide a valid email address.")
        return normalized


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = normalize_email(value)
        if not EMAIL_REGEX.fullmatch(normalized):
            raise ValueError("Please provide a valid email address.")
        return normalized


class VerifyOtpRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    otp: str = Field(..., min_length=4, max_length=8)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = normalize_email(value)
        if not EMAIL_REGEX.fullmatch(normalized):
            raise ValueError("Please provide a valid email address.")
        return normalized


class ResetPasswordRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    otp: str = Field(..., min_length=4, max_length=8)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = normalize_email(value)
        if not EMAIL_REGEX.fullmatch(normalized):
            raise ValueError("Please provide a valid email address.")
        return normalized

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        error = validate_password_strength(value)
        if error:
            raise ValueError(error)
        return value


# Pydantic schema for account request submissions
class AccountRequestPayload(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    campus_id: int = Field(..., gt=0)
    department: str = Field(..., min_length=2, max_length=100)
    program_id: int = Field(..., gt=0)
    email: str = Field(..., min_length=5, max_length=255)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not SAFE_NAME_REGEX.fullmatch(cleaned):
            raise ValueError("Please provide a valid full name.")
        return cleaned

    @field_validator("department")
    @classmethod
    def validate_department(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned or len(cleaned) > 100:
            raise ValueError("Please provide a valid department name.")
        return cleaned

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = normalize_email(value)
        if not EMAIL_REGEX.fullmatch(normalized):
            raise ValueError("Please provide a valid email address.")
        return normalized


class ContactAdminOtpRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    campus_id: int = Field(..., gt=0)
    department: str = Field(..., min_length=2, max_length=100)
    program_id: int = Field(..., gt=0)
    email: str = Field(..., min_length=5, max_length=255)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not SAFE_NAME_REGEX.fullmatch(cleaned):
            raise ValueError("Please provide a valid full name.")
        return cleaned

    @field_validator("department")
    @classmethod
    def validate_department(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned or len(cleaned) > 100:
            raise ValueError("Please provide a valid department name.")
        return cleaned

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = normalize_email(value)
        if not EMAIL_REGEX.fullmatch(normalized):
            raise ValueError("Please provide a valid email address.")
        return normalized


class AccountActionRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = normalize_email(value)
        if not EMAIL_REGEX.fullmatch(normalized):
            raise ValueError("Please provide a valid email address.")
        return normalized

class UserChangeRequestPayload(BaseModel):
    user_id: int = Field(..., ge=1)
    request_type: str = Field(default="department", max_length=64)
    requested_value: str = Field(..., min_length=1, max_length=255)

class UserChangeReviewPayload(BaseModel):
    action: str = Field(..., pattern="^(approve|decline)$")


class UserDepartmentUpdateRequest(AccountActionRequest):
    department: str | None = Field(default=None, min_length=1, max_length=255)
    department_id: int | None = Field(default=None, ge=1)


class AdminVerifyRequest(BaseModel):
    admin_email: str = Field(..., min_length=5, max_length=255)
    admin_password: str = Field(..., min_length=8, max_length=128)
    target_email: str = Field(..., min_length=5, max_length=255)

    @field_validator("admin_email")
    @classmethod
    def validate_admin_email(cls, value: str) -> str:
        normalized = normalize_email(value)
        if not EMAIL_REGEX.fullmatch(normalized):
            raise ValueError("Please provide a valid email address.")
        return normalized

    @field_validator("target_email")
    @classmethod
    def validate_target_email(cls, value: str) -> str:
        normalized = normalize_email(value)
        if not EMAIL_REGEX.fullmatch(normalized):
            raise ValueError("Please provide a valid email address.")
        return normalized


class UpdatePasswordRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = normalize_email(value)
        if not EMAIL_REGEX.fullmatch(normalized):
            raise ValueError("Please provide a valid email address.")
        return normalized

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        error = validate_password_strength(value)
        if error:
            raise ValueError(error)
        return value


class ChangePasswordOtpRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    current_password: str = Field(..., min_length=8, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = normalize_email(value)
        if not EMAIL_REGEX.fullmatch(normalized):
            raise ValueError("Please provide a valid email address.")
        return normalized

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        error = validate_password_strength(value)
        if error:
            raise ValueError(error)
        return value


class VerifyChangePasswordOtpRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    otp: str = Field(..., min_length=4, max_length=8)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = normalize_email(value)
        if not EMAIL_REGEX.fullmatch(normalized):
            raise ValueError("Please provide a valid email address.")
        return normalized


class CompleteChangePasswordRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    current_password: str = Field(..., min_length=8, max_length=128)
    otp: str | None = None
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = normalize_email(value)
        if not EMAIL_REGEX.fullmatch(normalized):
            raise ValueError("Please provide a valid email address.")
        return normalized

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        error = validate_password_strength(value)
        if error:
            raise ValueError(error)
        return value


class BulkUserActionRequest(BaseModel):
    user_ids: list[int] = Field(..., min_length=1, max_length=100)
    action: str = Field(..., pattern="^(archive|restore|revoke_sessions)$")

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD", "")


def normalize_email(value: str) -> str:
    """Normalize and correct common typos in email addresses."""
    raw = str(value or "").strip().lower()
    if "@" not in raw:
        return raw

    local, _, domain = raw.partition("@")
    domain = domain.replace(",", ".").replace(";", ".").replace(" ", "")
    return f"{local}@{domain}"


def hash_password(password: str) -> str:
    if not password:
        return ""
    salt = secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200_000)
    return f"pbkdf2_sha256$200000${salt.hex()}${derived.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    if not password or not stored_hash:
        return False

    if stored_hash.startswith("pbkdf2_sha256$"):
        _, iterations_str, salt_hex, digest_hex = stored_hash.split("$", 3)
        try:
            iterations = int(iterations_str)
        except ValueError:
            return False
        salt = bytes.fromhex(salt_hex)
        derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
        return hmac.compare_digest(derived.hex(), digest_hex)

    return hmac.compare_digest(password, stored_hash)


def validate_password_strength(password: str) -> str | None:
    if len(password) < 8:
        return "Password must be at least 8 characters long."
    if not any(char.isupper() for char in password):
        return "Password must include at least one uppercase letter."
    if not any(char.isdigit() for char in password):
        return "Password must include at least one number."
    if not any(not char.isalnum() for char in password):
        return "Password must include at least one symbol."
    return None


async def read_upload_bytes(file: UploadFile, field_name: str, max_size: int = MAX_UPLOAD_SIZE_BYTES) -> bytes:
    filename = (file.filename or "").strip()
    if not filename:
        raise HTTPException(status_code=400, detail=f"{field_name} filename is required.")

    extension = os.path.splitext(filename)[1].lower()
    if extension in DENIED_UPLOAD_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"{field_name} type is not allowed.")
    if extension not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported {field_name} file type. Use PDF, DOCX, XLSX, or XLS.")

    contents = await file.read()
    if len(contents) > max_size:
        raise HTTPException(status_code=413, detail=f"{field_name} is too large. Maximum size is 10MB.")

    if contents.startswith(b"\x25PDF"):
        return contents

    for signature_name, signature in DISALLOWED_MIME_SIGNATURES.items():
        if contents.startswith(signature):
            raise HTTPException(status_code=400, detail=f"{field_name} must be a document file, not an image.")

    return contents


def enforce_rate_limit(scope: str, key: str) -> None:
    now = time.time()
    bucket = RATE_LIMIT_BUCKETS[f"{scope}:{key}"]
    bucket[:] = [timestamp for timestamp in bucket if now - timestamp < RATE_LIMIT_WINDOW_SECONDS]
    if len(bucket) >= RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a few minutes and try again.")
    bucket.append(now)


def generate_temporary_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def send_campus_admin_credentials_email(recipient_email: str, full_name: str, password: str, campus_name: str) -> bool:
        if not SENDER_EMAIL or not SENDER_PASSWORD:
                logger.warning("[Email] SMTP credentials are not configured; skipping Campus Admin credentials email for %s", recipient_email)
                return False

        greeting_name = full_name or recipient_email.split("@")[0]
        text_body = (
                f"Hello {greeting_name},\n\n"
                "Your BloomQuest Campus Admin account has been created.\n\n"
                f"Email: {recipient_email}\n"
                f"Initial password: {password}\n"
                f"Campus: {campus_name}\n\n"
                "For your security, change your password immediately after your first login.\n\n"
                "Best regards,\nBloomQuest Administration"
        )
        html_body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #111; line-height: 1.6;">
                <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
                    <h2 style="color: #7B1113;">Welcome to BloomQuest</h2>
                    <p>Hello {escape_html(greeting_name)},</p>
                    <p>Your Campus Admin account has been created. Use these credentials to sign in:</p>
                    <p><strong>Email:</strong> {escape_html(recipient_email)}<br />
                    <strong>Initial password:</strong> <code>{escape_html(password)}</code><br />
                    <strong>Campus:</strong> {escape_html(campus_name)}</p>
                    <p>For your security, change your password immediately after your first login.</p>
                    <p>Best regards,<br /><strong>BloomQuest Administration</strong></p>
                </div>
            </body>
        </html>
        """

        message = MIMEMultipart("alternative")
        message["From"] = SENDER_EMAIL
        message["To"] = recipient_email
        message["Subject"] = "Your BloomQuest Campus Admin Login Credentials"
        message.attach(MIMEText(text_body, "plain"))
        message.attach(MIMEText(html_body, "html"))

        try:
                with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
                        server.starttls()
                        server.login(SENDER_EMAIL, SENDER_PASSWORD)
                        server.send_message(message)
                logger.info("[Email] Campus Admin credentials email sent to %s", recipient_email)
                return True
        except Exception as exc:
                logger.error("[Email] Campus Admin credentials email failed for %s: %s", recipient_email, exc, exc_info=True)
                return False


def send_approval_email(recipient_email: str, temporary_password: str, full_name: str = None, department: str = None):
    """Render the approval email template and send it via SMTP.

    Falls back to a minimal inline message if the template cannot be read.
    """
    if not SENDER_EMAIL or not SENDER_PASSWORD:
        print(f"SMTP credentials are not configured. Approval email for {recipient_email} was not sent.")
        return

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173/")
    template_path = os.path.join(os.path.dirname(__file__), "templates", "approval_email.html")

    try:
        logger.info("[Email] Preparing approval email for recipient=%s sender=%s", recipient_email, SENDER_EMAIL)
        # Load template
        try:
            with open(template_path, "r", encoding="utf-8") as fh:
                template = fh.read()
        except Exception as exc:
            logger.warning("[Email] Approval template load failed: %s", exc)
            template = None

        if template:
            rendered = template.replace("{{fullName}}", full_name or recipient_email.split("@")[0])
            rendered = rendered.replace("{{department}}", department or "N/A")
            rendered = rendered.replace("{{email}}", recipient_email)
            rendered = rendered.replace("{{temporaryPassword}}", temporary_password)
            rendered = rendered.replace("{{frontendUrl}}", frontend_url)
        else:
            rendered = f"""
            <html>
              <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2 style="color: #B01C1C;">Welcome to BloomQuest!</h2>
                <p>Great news! Your administrator request has been approved, and your official account has been configured.</p>
                <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0 0 8px 0;"><strong>Full name:</strong> {full_name or ''}</p>
                  <p style="margin: 0 0 8px 0;"><strong>Department:</strong> {department or 'N/A'}</p>
                  <p style="margin: 0 0 8px 0;"><strong>Username / Email:</strong> {recipient_email}</p>
                  <p style="margin: 0;"><strong>Temporary Password:</strong> <code style="background: #FFF; padding: 2px 6px; border: 1px solid #DDD; font-size: 1.1em;">{temporary_password}</code></p>
                </div>
                <p style="color: #EF4444; font-size: 0.9em;"><em>Note: For your profile security, please update this password immediately upon logging in for the first time.</em></p>
                <p>Best Regards,<br/><strong>BloomQuest Admin Team</strong></p>
              </body>
            </html>
            """

        msg = MIMEMultipart()
        msg["From"] = SENDER_EMAIL
        msg["To"] = recipient_email
        msg["Subject"] = "BloomQuest Account Approved & Created"
        msg.attach(MIMEText(rendered, "html"))

        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.send_message(msg)
        logger.info("[Email] Approval email sent successfully to %s", recipient_email)
    except Exception as exc:
        logger.error("Failed to deliver account creation email: %s", exc, exc_info=True)


def send_request_submission_email(recipient_email: str, full_name: str = None, department: str = None):
    """Render the request submission email template and send it via SMTP."""
    if not SENDER_EMAIL or not SENDER_PASSWORD:
        print(f"SMTP credentials are not configured. Submission email for {recipient_email} was not sent.")
        return

    template_path = os.path.join(os.path.dirname(__file__), "templates", "request_submission_email.html")

    try:
        logger.info("[Email] Preparing request submission email for recipient=%s sender=%s", recipient_email, SENDER_EMAIL)
        # Load template
        try:
            with open(template_path, "r", encoding="utf-8") as fh:
                template = fh.read()
        except Exception as exc:
            logger.warning("[Email] Request template load failed: %s", exc)
            template = None

        if template:
            rendered = template.replace("{{fullName}}", full_name or recipient_email.split("@")[0])
            rendered = rendered.replace("{{department}}", department or "N/A")
            rendered = rendered.replace("{{email}}", recipient_email)
        else:
            rendered = f"""
            <html>
              <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2 style="color: #B01C1C;">BloomQuest Request Received</h2>
                <p>We have received your request to join BloomQuest.</p>
                <p><strong>Full name:</strong> {full_name or ''}</p>
                <p><strong>Department:</strong> {department or 'N/A'}</p>
                <p><strong>Email:</strong> {recipient_email}</p>
                <p>We will notify you once an administrator approves your account.</p>
              </body>
            </html>
            """

        msg = MIMEMultipart()
        msg["From"] = SENDER_EMAIL
        msg["To"] = recipient_email
        msg["Subject"] = "BloomQuest Account Request Received"
        msg.attach(MIMEText(rendered, "html"))

        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.send_message(msg)
        logger.info("[Email] Request submission email sent successfully to %s", recipient_email)
    except Exception as exc:
        logger.error("Failed to deliver account request submission email: %s", exc, exc_info=True)


def send_contact_admin_otp_email(recipient_email: str, otp_code: str) -> bool:
    if not SENDER_EMAIL or not SENDER_PASSWORD:
        logger.warning("[Email] SMTP credentials are not configured; skipping contact-admin OTP email for %s", recipient_email)
        return False

    subject = "Your BloomQuest account request verification code"
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #111; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #7B1113;">BloomQuest Account Request Verification</h2>
          <p>We received your request to join BloomQuest.</p>
          <div style="margin: 24px 0; padding: 16px; border-radius: 12px; background: #F9FAFB; border: 1px solid #E5E7EB; font-size: 1.1rem; letter-spacing: 0.18em; text-align: center;">
            <strong style="color: #B01C1C;">{otp_code}</strong>
          </div>
          <p>Enter this 6-digit code in the app to verify your email and complete your request.</p>
          <p style="font-size: 0.95rem; color: #555;">If you did not request an account, you can safely ignore this email.</p>
        </div>
      </body>
    </html>
    """

    msg = MIMEMultipart()
    msg["From"] = SENDER_EMAIL
    msg["To"] = recipient_email
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.send_message(msg)
        logger.info("[Email] Contact-admin OTP email sent to %s", recipient_email)
        return True
    except Exception as exc:
        logger.error("[Email] Contact-admin OTP delivery failed for %s: %s", recipient_email, exc, exc_info=True)
        return False


def send_password_reset_email(recipient_email: str, otp_code: str) -> bool:
    if not SENDER_EMAIL or not SENDER_PASSWORD:
        logger.warning("[Email] SMTP credentials are not configured; skipping password reset email for %s", recipient_email)
        return False

    subject = "Your BloomQuest password reset code"
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #111; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #7B1113;">BloomQuest Password Reset</h2>
          <p>We received a request to reset the password for your BloomQuest account.</p>
          <div style="margin: 24px 0; padding: 16px; border-radius: 12px; background: #F9FAFB; border: 1px solid #E5E7EB; font-size: 1.1rem; letter-spacing: 0.18em; text-align: center;">
            <strong style="color: #B01C1C;">{otp_code}</strong>
          </div>
          <p style="margin-bottom: 0.5rem;">Enter this 6-digit code on the password reset page to continue.</p>
          <p style="font-size: 0.95rem; color: #555;">If you did not request a password reset, you can safely ignore this email.</p>
        </div>
      </body>
    </html>
    """

    msg = MIMEMultipart()
    msg["From"] = SENDER_EMAIL
    msg["To"] = recipient_email
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.send_message(msg)
        logger.info("[Email] Password reset email sent to %s", recipient_email)
        return True
    except Exception as exc:
        logger.error("[Email] Password reset delivery failed for %s: %s", recipient_email, exc, exc_info=True)
        return False


def _cleanup_otp(email: str):
    record = otp_store.get(email)
    if record and record["expires_at"] < utc_now():
        otp_store.pop(email, None)


def _cleanup_change_password_otp(email: str):
    record = change_password_otp_store.get(email)
    if record and record["expires_at"] < utc_now():
        change_password_otp_store.pop(email, None)


@app.post("/api/forgot-password/send-otp")
def send_otp(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    enforce_rate_limit("otp", data.email)
    user = db.query(models.User).filter(func.lower(models.User.email) == data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found for this email.")

    code = f"{random.randint(0, 999999):06d}"
    otp_store[data.email] = {
        "otp": code,
        "expires_at": utc_now() + timedelta(minutes=10),
    }
    logger.info("[OTP] Generated password reset code for %s", data.email)

    sent = send_password_reset_email(data.email, code)
    if not sent:
        logger.warning("[OTP] Password reset email not sent; returning demo code for %s", data.email)
        log_activity(db, "Password Reset Code Generated", f"Generated a reset code for {data.email}.", "security")
        return {
            "message": "A password reset code has been sent to your email address.",
            "demo_code": code,
        }

    log_activity(db, "Password Reset Code Sent", f"Sent a reset code for {data.email}.", "security")
    return {
        "message": "A password reset code has been sent to your email address.",
    }

@app.post("/api/forgot-password/verify-otp")
def verify_otp(data: VerifyOtpRequest, db: Session = Depends(get_db)):
    enforce_rate_limit("otp-verify", data.email)
    _cleanup_otp(data.email)
    record = otp_store.get(data.email)
    if not record or record["otp"] != data.otp:
        raise HTTPException(status_code=400, detail="Incorrect or expired verification code.")

    log_activity(db, "Password Reset Verified", f"Verified a password reset request for {data.email}.", "security")
    return {"message": "OTP verified."}

@app.patch("/api/forgot-password/reset")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    enforce_rate_limit("password-reset", data.email)
    _cleanup_otp(data.email)
    record = otp_store.get(data.email)
    if not record or record["otp"] != data.otp:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP.")

    user = db.query(models.User).filter(func.lower(models.User.email) == data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.password = hash_password(data.new_password)
    db.commit()
    otp_store.pop(data.email, None)
    log_activity(db, "Password Reset Completed", f"Password reset completed for {data.email}.", "security")

    return {"message": "Password has been reset successfully."}


@app.post("/api/user/change-password/request-otp")
def request_user_change_password_otp(data: ChangePasswordOtpRequest, db: Session = Depends(get_db)):
    enforce_rate_limit("change-password-otp", data.email)
    normalized_email = normalize_email(data.email)
    user = db.query(models.User).filter(func.lower(models.User.email) == normalized_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if not verify_password(data.current_password, user.password):
        raise HTTPException(status_code=401, detail="The current password is incorrect.")
    if data.current_password == data.new_password:
        raise HTTPException(status_code=400, detail="Your new password must be different from the current password.")

    code = f"{random.randint(0, 999999):06d}"
    change_password_otp_store[normalized_email] = {
        "otp": code,
        "expires_at": utc_now() + timedelta(minutes=10),
    }

    sent = send_password_reset_email(normalized_email, code)
    if not sent:
        logger.warning("[OTP] User password change email not sent; returning demo code for %s", normalized_email)
        return {"message": "A verification code has been sent to your email address.", "demo_code": code}

    log_activity(db, "Password Change OTP Sent", f"Sent a password change verification code for {normalized_email}.", "security", user_id=user.id)
    return {"message": "A verification code has been sent to your email address."}


@app.post("/api/user/change-password/verify-otp")
def verify_user_change_password_otp(data: VerifyChangePasswordOtpRequest, db: Session = Depends(get_db)):
    enforce_rate_limit("change-password-verify", data.email)
    normalized_email = normalize_email(data.email)
    _cleanup_change_password_otp(normalized_email)
    record = change_password_otp_store.get(normalized_email)
    if not record or record["otp"] != data.otp:
        raise HTTPException(status_code=400, detail="Incorrect or expired verification code.")

    log_activity(db, "Password Change Verified", f"Verified password change code for {normalized_email}.", "security")
    return {"message": "OTP verified."}


@app.patch("/api/user/change-password/update")
def update_user_password_with_otp(data: CompleteChangePasswordRequest, db: Session = Depends(get_db)):
    enforce_rate_limit("change-password-update", data.email)
    normalized_email = normalize_email(data.email)

    if data.otp:
        _cleanup_change_password_otp(normalized_email)
        record = change_password_otp_store.get(normalized_email)
        if not record or record["otp"] != data.otp:
            raise HTTPException(status_code=400, detail="Invalid or expired verification code.")

    user = db.query(models.User).filter(func.lower(models.User.email) == normalized_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if not verify_password(data.current_password, user.password):
        raise HTTPException(status_code=401, detail="The current password is incorrect.")
    if data.current_password == data.new_password:
        raise HTTPException(status_code=400, detail="Your new password must be different from the current password.")

    user.password = hash_password(data.new_password)
    db.commit()
    change_password_otp_store.pop(normalized_email, None)
    log_activity(db, "Password Change Completed", f"Password changed successfully for {normalized_email}.", "security", user_id=user.id)

    return {"message": "Password updated successfully."}


@app.post("/api/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    enforce_rate_limit("login", data.email)
    user = db.query(models.User).filter(func.lower(models.User.email) == data.email).first()

    if user and not user.archived and verify_password(data.password, user.password):
        pass
    else:
        user = None

    if user and str(user.role).lower() == "campus_admin":
        campus = db.query(models.Campus).filter(models.Campus.id == user.campus_id).first()
        if not campus or not campus.is_active:
            user = None

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    now = utc_now()
    db.query(models.UserSession).filter(models.UserSession.user_id == user.id, models.UserSession.revoked_at.is_(None)).update({"revoked_at": now})
    raw_token = secrets.token_urlsafe(48)
    session = models.UserSession(user_id=user.id, token_hash=hashlib.sha256(raw_token.encode()).hexdigest(), expires_at=now + timedelta(hours=12))
    db.add(session)
    log_activity(db, "System Login", f"Logged in as {user.email}.", "login", user_id=user.id)

    # Return response (replace with JWT later)
    return {
        "token": raw_token,
        "user_id": user.id,
        "role": user.role,
        "campus_id": user.campus_id,
        "email": user.email,
        "department": user.department,
        "message": "Login successful"
    }

@app.get("/")
def root():
    return {"message": "BloomQuest API is running"}

@app.get("/api/contact-admin/check-status")
def check_request_status(email: str, db: Session = Depends(get_db)):
    normalized_email = normalize_email(email)
    request_entry = (
        db.query(models.AccountRequest)
        .filter(func.lower(models.AccountRequest.email) == normalized_email)
        .first()
    )
    if request_entry:
        return {"exists": True, "status": request_entry.status}

    user = db.query(models.User).filter(func.lower(models.User.email) == normalized_email).first()
    if user:
        return {"exists": True, "status": "approved"}

    return {"exists": False, "status": None}

@app.get("/api/contact-admin/pending")
def list_pending_account_requests(db: Session = Depends(get_db), _admin: models.User = Depends(require_admin)):
    request_query = db.query(models.AccountRequest).filter(models.AccountRequest.status == "pending")
    campus_id = visible_campus_id(_admin)
    if campus_id is not None:
        request_query = request_query.outerjoin(
            models.Program, models.Program.id == models.AccountRequest.program_id
        ).outerjoin(
            models.Department, models.Department.id == models.Program.department_id
        ).filter(or_(
            models.AccountRequest.campus_id == campus_id,
            models.AccountRequest.campus_id.is_(None) & (models.Department.campus_id == campus_id),
        ))
    requests = request_query.order_by(models.AccountRequest.created_at.desc()).all()
    campuses_by_id = {campus.id: campus.name for campus in db.query(models.Campus).all()}

    return [
        {
            "id": request.id,
            "full_name": request.full_name,
            "department": request.department,
            "campus_id": request.campus_id,
            "campus": campuses_by_id.get(request.campus_id),
            "program_id": request.program_id,
            "program": db.query(models.Program).filter(models.Program.id == request.program_id).first().name if request.program_id and db.query(models.Program).filter(models.Program.id == request.program_id).first() else None,
            "email": request.email,
            "status": request.status,
            "created_at": request.created_at.isoformat() if request.created_at else None,
            "requested_at": request.created_at.isoformat() if request.created_at else None,
        }
        for request in requests
    ]

@app.get("/api/contact-admin/users")
def list_admin_users(db: Session = Depends(get_db), _admin: models.User = Depends(require_admin)):
    roles = ("faculty", "student")
    scoped_users = admin_scoped_user_query(db, _admin).filter(func.lower(models.User.role).in_(roles))
    active_users = scoped_users.filter(models.User.archived.is_(False)).order_by(models.User.id.desc()).all()
    archived_users = scoped_users.filter(models.User.archived.is_(True)).order_by(models.User.id.desc()).all()
    programs_by_id = {program.id: program.name for program in db.query(models.Program).all()}

    activity_by_user = defaultdict(list)
    visible_user_ids = {user.id for user in active_users + archived_users}
    for entry in db.query(models.ActivityLog).filter(models.ActivityLog.user_id.in_(visible_user_ids)).all() if visible_user_ids else []:
        activity_by_user[entry.user_id].append(entry)

    def latest_activity(entries, predicate=lambda entry: True):
        matches = [entry for entry in entries if predicate(entry) and entry.created_at]
        return max(matches, key=lambda entry: entry.created_at).created_at.isoformat() if matches else None

    def format_user(user):
        entries = activity_by_user.get(user.id, [])
        return {
        "id": user.id,
        "full_name": user.name or user.email.split("@", 1)[0],
        "department": user.department or "N/A",
        "program": programs_by_id.get(user.program_id, "N/A"),
        "campus_id": user.campus_id or user_campus_id(db, user),
        "email": user.email,
        "role": user.role,
        "status": "Active" if not user.archived else "Archived",
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "joined": user.created_at.isoformat() if user.created_at else None,
        "last_active": latest_activity(entries),
        "last_export": latest_activity(entries, lambda entry: entry.type in {"download", "export"} or "export" in (entry.action or "").lower()),
        "last_generate": latest_activity(entries, lambda entry: entry.type == "generate" or "generat" in (entry.action or "").lower()),
        "activity_count": len(entries),
        "archived": user.archived,
        }

    return {
        "active": [format_user(user) for user in active_users],
        "archived": [format_user(user) for user in archived_users],
    }

@app.get("/api/admin/user-change-requests")
def list_user_change_requests(status: str | None = None, db: Session = Depends(get_db), _admin: models.User = Depends(require_admin)):
    query = db.query(models.UserChangeRequest)
    if status and status.lower() != "all":
        query = query.filter(models.UserChangeRequest.status == status.lower())
    rows = query.order_by(models.UserChangeRequest.created_at.desc()).all()
    users = {user.id: user for user in db.query(models.User).all()}
    reviewers = {user.id: user for user in db.query(models.User).all()}
    return [{
        "id": row.id,
        "user_id": row.user_id,
        "user_name": users[row.user_id].name if row.user_id in users else "Unknown user",
        "email": users[row.user_id].email if row.user_id in users else None,
        "request_type": row.request_type,
        "current_value": row.current_value,
        "requested_value": row.requested_value,
        "status": row.status,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "reviewed_at": row.reviewed_at.isoformat() if row.reviewed_at else None,
        "reviewed_by": row.reviewed_by,
        "reviewer_name": reviewers[row.reviewed_by].name if row.reviewed_by in reviewers else None,
    } for row in rows]

@app.post("/api/user-change-requests")
def create_user_change_request(payload: UserChangeRequestPayload, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if payload.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are only authorized to submit a change request for your own account.")
    user = db.query(models.User).filter(models.User.id == payload.user_id, models.User.archived == False).first()
    if not user or payload.request_type not in {"department", "program"}:
        raise HTTPException(status_code=400, detail="Invalid user change request.")

    if payload.request_type == "department":
        department = db.query(models.Department).filter(func.lower(models.Department.name) == payload.requested_value.strip().lower()).first()
        if not department:
            raise HTTPException(status_code=400, detail="Please select a valid department.")
        requested_display = department.name
        current_value = user.department
        label = "Department Change Requested"
    else:
        requested_value = payload.requested_value.strip()
        program = None
        if requested_value.isdigit():
            program = db.query(models.Program).filter(models.Program.id == int(requested_value)).first()
        else:
            program = db.query(models.Program).filter(func.lower(models.Program.name) == requested_value.lower()).first()
        if not program:
            raise HTTPException(status_code=400, detail="Please select a valid program.")
        requested_display = program.name
        current_value = db.query(models.Program).filter(models.Program.id == user.program_id).first().name if user.program_id else user.department
        label = "Program Change Requested"

    existing = db.query(models.UserChangeRequest).filter(
        models.UserChangeRequest.user_id == user.id,
        models.UserChangeRequest.request_type == payload.request_type,
        models.UserChangeRequest.status == "pending",
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"You already have a pending {payload.request_type} request.")

    row = models.UserChangeRequest(
        user_id=user.id,
        request_type=payload.request_type,
        current_value=current_value,
        requested_value=requested_display,
    )
    row.status = "pending"
    db.add(row)
    db.commit()
    db.refresh(row)
    log_activity(db, label, f"User {current_user.id} requested {payload.request_type} change to {requested_display}.", "user", user_id=user.id, actor_id=current_user.id, target_user_id=user.id)
    return {"id": row.id, "status": row.status, "requested_value": row.requested_value}

@app.patch("/api/admin/user-change-requests/{request_id}")
def review_user_change_request(request_id: int, payload: UserChangeReviewPayload, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    row = db.query(models.UserChangeRequest).filter(models.UserChangeRequest.id == request_id).first()
    if not row or row.status != "pending":
        raise HTTPException(status_code=404, detail="Pending change request not found.")

    if row.request_type == "department":
        department = db.query(models.Department).filter(func.lower(models.Department.name) == str(row.requested_value).strip().lower()).first()
        if not department:
            raise HTTPException(status_code=400, detail="The requested department no longer exists. The request cannot be approved.")
    elif row.request_type == "program":
        program = None
        requested_value = str(row.requested_value).strip()
        if requested_value.isdigit():
            program = db.query(models.Program).filter(models.Program.id == int(requested_value)).first()
        else:
            program = db.query(models.Program).filter(func.lower(models.Program.name) == requested_value.lower()).first()
        if not program:
            raise HTTPException(status_code=400, detail="The requested program no longer exists. The request cannot be approved.")

    row.status = "approved" if payload.action == "approve" else "declined"
    row.reviewed_at = utc_now()
    row.reviewed_by = admin.id
    if row.status == "approved":
        user = db.query(models.User).filter(models.User.id == row.user_id).first()
        if user:
            if row.request_type == "department":
                user.department = row.requested_value
                user.program_id = None
            elif row.request_type == "program":
                program = db.query(models.Program).filter(func.lower(models.Program.name) == str(row.requested_value).strip().lower()).first()
                if program:
                    user.program_id = program.id
                    if program.department_id:
                        department = db.query(models.Department).filter(models.Department.id == program.department_id).first()
                        if department:
                            user.department = department.name
    db.commit()
    log_activity(db, "User Change Request Reviewed", f"Admin {admin.id} {payload.action}d change request {request_id} for user {row.user_id}.", "security", actor_id=admin.id, target_user_id=row.user_id)
    return {"id": row.id, "status": row.status}


@app.get("/api/admin/users/{user_id}/activity")
def get_admin_user_activity(user_id: int, db: Session = Depends(get_db), _admin: models.User = Depends(require_admin)):
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    assert_admin_can_access_user(db, _admin, target_user)
    rows = db.query(models.ActivityLog).filter(models.ActivityLog.user_id == user_id).order_by(models.ActivityLog.created_at.desc()).limit(100).all()
    return [{
        "id": row.id,
        "action": row.action,
        "type": row.type,
        "status": row.status,
        "detail": row.details,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    } for row in rows]


@app.get("/api/admin/users/{user_id}/overview")
def get_admin_user_overview(user_id: int, db: Session = Depends(get_db), _admin: models.User = Depends(require_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    assert_admin_can_access_user(db, _admin, user)

    upload_owner_tos_ids = db.query(models.TableOfSpecification.id).join(
        models.UploadedFile,
        models.UploadedFile.id == models.TableOfSpecification.upload_id,
    ).filter(models.UploadedFile.user_id == user_id)
    question_query = db.query(models.GeneratedQuestion).filter(or_(
        models.GeneratedQuestion.user_id == user_id,
        models.GeneratedQuestion.tos_id.in_(upload_owner_tos_ids),
    ))
    question_count = question_query.count()
    subject_ids = question_query.with_entities(models.GeneratedQuestion.subject_id).filter(
        models.GeneratedQuestion.subject_id.is_not(None)
    ).distinct()
    subjects = db.query(models.Subject).filter(
        models.Subject.id.in_(subject_ids),
        models.Subject.archived.is_(False),
        models.Subject.department_id.is_not(None),
    ).order_by(models.Subject.created_at.desc()).all()
    activities = db.query(models.ActivityLog).filter(models.ActivityLog.user_id == user_id).order_by(models.ActivityLog.created_at.desc()).all()

    return {
        "user": {
            "id": user.id,
            "name": user.name or user.email.split("@", 1)[0],
            "email": user.email,
            "role": user.role,
            "department": user.department or "Unassigned",
            "joined": user.created_at.isoformat() if user.created_at else None,
            "archived": user.archived,
        },
        "subjects": [{
            "id": subject.id,
            "name": subject.name,
            "code": subject.code,
            "department": subject.department.name if subject.department else "Unassigned",
            "created_at": subject.created_at.isoformat() if subject.created_at else None,
            "archived": subject.archived,
        } for subject in subjects],
        "question_count": question_count,
        "activities": [{
            "id": activity.id,
            "action": activity.action,
            "type": activity.type,
            "status": activity.status,
            "detail": activity.details,
            "filename": activity.filename,
            "media_type": activity.media_type,
            "created_at": activity.created_at.isoformat() if activity.created_at else None,
        } for activity in activities],
    }


@app.post("/api/admin/users/bulk")
def bulk_user_action(payload: BulkUserActionRequest, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    users = db.query(models.User).filter(models.User.id.in_(payload.user_ids)).all()
    if not users:
        raise HTTPException(status_code=404, detail="No matching users found")
    for user in users:
        assert_admin_can_access_user(db, admin, user)
        if str(user.role).lower() in {"admin", "campus_admin", "super_admin"}:
            raise HTTPException(status_code=403, detail="Administrative accounts must be managed by a Super Admin.")
    now = utc_now()
    changed = []
    for user in users:
        if payload.action == "archive":
            user.archived = True
        elif payload.action == "restore":
            user.archived = False
        else:
            db.query(models.UserSession).filter(models.UserSession.user_id == user.id, models.UserSession.revoked_at.is_(None)).update({"revoked_at": now})
        changed.append(user.id)
        log_activity(
            db,
            f"Bulk User {payload.action.title()}",
            f"Admin {admin.id} applied {payload.action} to user {user.id}.",
            "security",
            actor_id=admin.id,
            target_user_id=user.id,
            user_id=admin.id,
        )
    db.commit()
    return {"updated": changed, "action": payload.action}

@app.post("/api/contact-admin/approve")
async def approve_account_request(payload: AccountActionRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), _admin: models.User = Depends(require_admin)):
    normalized_email = normalize_email(payload.email)
    request_entry = (
        db.query(models.AccountRequest)
        .filter(func.lower(models.AccountRequest.email) == normalized_email)
        .first()
    )
    if not request_entry:
        raise HTTPException(status_code=404, detail="Pending registration ticket not found.")
    assert_admin_can_access_request(db, _admin, request_entry)

    # capture details from the request before deleting the ticket
    full_name = getattr(request_entry, "full_name", None)
    campus_id = getattr(request_entry, "campus_id", None)
    department = getattr(request_entry, "department", None)
    program_id = getattr(request_entry, "program_id", None)

    temp_password = generate_temporary_password()

    existing_user = db.query(models.User).filter(func.lower(models.User.email) == normalized_email).first()
    if existing_user:
        existing_user.password = hash_password(temp_password)
        existing_user.role = "faculty"
        existing_user.archived = False
        existing_user.campus_id = campus_id
        existing_user.department = department
        existing_user.program_id = program_id
        existing_user.name = full_name or existing_user.name
    else:
        new_user = models.User(
            email=normalized_email,
            password=hash_password(temp_password),
            role="faculty",
            archived=False,
            campus_id=campus_id,
            name=full_name,
            department=department,
            program_id=program_id,
        )
        db.add(new_user)

    # remove the pending account request and commit
    db.delete(request_entry)
    db.commit()
    log_activity(db, "Password Updated", f"Password updated for {normalized_email}.", "security")

    # send the approval email in the background with templated fields
    background_tasks.add_task(send_approval_email, normalized_email, temp_password, full_name, department)

    # fetch the user row we just created/updated to return a formatted user object
    created_user = db.query(models.User).filter(func.lower(models.User.email) == normalized_email).first()

    log_activity(db, "Account Request Approved", f"Approved account request for {normalized_email}.", "user")

    formatted = None
    if created_user:
        formatted = {
            "id": created_user.id,
            "full_name": created_user.name or created_user.email.split("@", 1)[0],
            "department": created_user.department or "N/A",
            "email": created_user.email,
            "role": created_user.role,
            "status": "Active" if not created_user.archived else "Archived",
            "created_at": None,
            "joined": "Recently added",
            "archived": created_user.archived,
        }

    return {
        "status": "success",
        "message": f"Account approved successfully. Credentials dispatched to {payload.email}.",
        "created_user": formatted,
    }

@app.put("/api/users/update-password")
def update_user_password(payload: UpdatePasswordRequest, db: Session = Depends(get_db), _admin: models.User = Depends(require_admin)):
    normalized_email = normalize_email(payload.email)
    user = db.query(models.User).filter(func.lower(models.User.email) == normalized_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    assert_admin_can_access_user(db, _admin, user)
    if str(user.role).lower() in {"admin", "campus_admin", "super_admin"} and str(_admin.role).lower() != "super_admin":
        raise HTTPException(status_code=403, detail="Only a Super Admin can change an administrator password.")
    user.password = hash_password(payload.new_password)
    db.commit()
    db.query(models.UserSession).filter(models.UserSession.user_id == user.id, models.UserSession.revoked_at.is_(None)).update({"revoked_at": utc_now()}, synchronize_session=False)
    return {"message": "Password updated successfully."}

@app.put("/api/users/update-department")
def update_user_department(payload: UserDepartmentUpdateRequest, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    normalized_email = normalize_email(payload.email)
    user = db.query(models.User).filter(func.lower(models.User.email) == normalized_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    assert_admin_can_access_user(db, admin, user)

    if payload.department_id is not None:
        department = db.query(models.Department).filter(models.Department.id == payload.department_id).first()
    elif payload.department and payload.department.strip():
        department_query = db.query(models.Department).filter(
            func.lower(models.Department.name) == payload.department.strip().lower()
        )
        if str(admin.role).lower() == "campus_admin":
            department_query = department_query.filter(models.Department.campus_id == admin.campus_id)
        matches = department_query.order_by(models.Department.id.asc()).limit(2).all()
        if len(matches) > 1:
            raise HTTPException(status_code=400, detail="Select a specific department.")
        department = matches[0] if matches else None
    else:
        raise HTTPException(status_code=400, detail="Please select a department.")
    if not department:
        raise HTTPException(status_code=400, detail="Please select a valid department.")
    assert_campus_access(admin, department.campus_id)

    user.department = department.name
    user.campus_id = department.campus_id
    user.program_id = None
    db.commit()
    log_activity(db, "User Department Updated", f"Admin {admin.id} assigned {normalized_email} to {department.name}.", "user", actor_id=admin.id, target_user_id=user.id)
    return {"message": "User department updated successfully.", "department": user.department}

@app.post("/api/users/archive")
def archive_user(payload: AccountActionRequest, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    normalized_email = normalize_email(payload.email)
    user = db.query(models.User).filter(func.lower(models.User.email) == normalized_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    assert_admin_can_access_user(db, admin, user)
    if str(user.role).lower() in {"admin", "campus_admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Administrative accounts must be managed by a Super Admin.")

    user.archived = True
    db.query(models.UserSession).filter(models.UserSession.user_id == user.id, models.UserSession.revoked_at.is_(None)).update({"revoked_at": utc_now()}, synchronize_session=False)
    db.commit()
    log_activity(db, "User Archived", f"Admin {admin.id} archived user {normalized_email}.", "user", actor_id=admin.id, target_user_id=user.id)
    return {"message": "User archived successfully.", "status": "archived"}

@app.post("/api/users/restore")
def restore_user(payload: AccountActionRequest, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    normalized_email = normalize_email(payload.email)
    user = db.query(models.User).filter(func.lower(models.User.email) == normalized_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    assert_admin_can_access_user(db, admin, user)
    if str(user.role).lower() in {"admin", "campus_admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Administrative accounts must be managed by a Super Admin.")

    user.archived = False
    db.commit()
    log_activity(db, "User Restored", f"Admin {admin.id} restored user {normalized_email}.", "user", actor_id=admin.id, target_user_id=user.id)
    return {"message": "User restored successfully.", "status": "active"}

@app.post("/api/users/verify-admin-password")
def verify_admin_password(payload: AdminVerifyRequest, db: Session = Depends(get_db), _admin: models.User = Depends(require_admin)):
    normalized_admin_email = normalize_email(payload.admin_email)
    if normalized_admin_email != normalize_email(_admin.email) or not verify_password(payload.admin_password, _admin.password):
        raise HTTPException(status_code=403, detail="Invalid admin credentials.")

    normalized_target_email = normalize_email(payload.target_email)
    target_user = (
        db.query(models.User)
        .filter(func.lower(models.User.email) == normalized_target_email)
        .first()
    )
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found.")
    assert_admin_can_access_user(db, _admin, target_user)

    return {
        "email": target_user.email,
        "role": target_user.role,
        "archived": target_user.archived,
    }

@app.delete("/api/users/{email}")
def delete_user(email: str, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    normalized_email = normalize_email(email)
    user = db.query(models.User).filter(func.lower(models.User.email) == normalized_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    assert_admin_can_access_user(db, admin, user)
    if str(user.role).lower() in {"admin", "campus_admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Administrative accounts must be managed by a Super Admin.")

    # Archive the account by default so the user can be restored and the audit trail remains intact.
    user.archived = True
    db.query(models.UserSession).filter(models.UserSession.user_id == user.id, models.UserSession.revoked_at.is_(None)).update(
        {models.UserSession.revoked_at: utc_now()}, synchronize_session=False
    )
    db.query(models.Subject).filter(models.Subject.user_id == user.id).update(
        {models.Subject.user_id: None}, synchronize_session=False
    )
    db.query(models.UploadedFile).filter(models.UploadedFile.user_id == user.id).update(
        {models.UploadedFile.user_id: None}, synchronize_session=False
    )
    db.query(models.GeneratedQuestion).filter(models.GeneratedQuestion.user_id == user.id).update(
        {models.GeneratedQuestion.user_id: None}, synchronize_session=False
    )
    db.commit()
    log_activity(db, "User Archived", f"Admin {admin.id} archived and preserved user {normalized_email}.", "security", actor_id=admin.id, target_user_id=user.id)

    return {"message": "User archived successfully.", "status": "archived"}


@app.delete("/api/users/{email}/permanent")
def permanent_delete_user(email: str, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    normalized_email = normalize_email(email)
    user = db.query(models.User).filter(func.lower(models.User.email) == normalized_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    db.query(models.ActivityLog).filter(models.ActivityLog.user_id == user.id).update(
        {models.ActivityLog.user_id: None}, synchronize_session=False
    )
    db.query(models.ActivityLog).filter(models.ActivityLog.actor_id == user.id).update(
        {models.ActivityLog.actor_id: None}, synchronize_session=False
    )
    db.query(models.ActivityLog).filter(models.ActivityLog.target_user_id == user.id).update(
        {models.ActivityLog.target_user_id: None}, synchronize_session=False
    )
    db.query(models.Subject).filter(models.Subject.user_id == user.id).update(
        {models.Subject.user_id: None}, synchronize_session=False
    )
    db.query(models.UploadedFile).filter(models.UploadedFile.user_id == user.id).update(
        {models.UploadedFile.user_id: None}, synchronize_session=False
    )
    db.query(models.GeneratedQuestion).filter(models.GeneratedQuestion.user_id == user.id).update(
        {models.GeneratedQuestion.user_id: None}, synchronize_session=False
    )
    db.query(models.UserSession).filter(models.UserSession.user_id == user.id).delete(synchronize_session=False)

    db.delete(user)
    db.commit()
    log_activity(db, "User Permanently Deleted", f"Admin {admin.id} permanently deleted user {normalized_email}.", "security", actor_id=admin.id, target_user_id=user.id)
    return {"message": "User permanently deleted successfully.", "status": "deleted"}

@app.post("/api/contact-admin/decline")
def decline_account_request(payload: AccountActionRequest, db: Session = Depends(get_db), _admin: models.User = Depends(require_admin)):
    normalized_email = normalize_email(payload.email)
    request_entry = (
        db.query(models.AccountRequest)
        .filter(func.lower(models.AccountRequest.email) == normalized_email)
        .first()
    )
    if not request_entry:
        raise HTTPException(status_code=404, detail="Account request not found.")
    assert_admin_can_access_request(db, _admin, request_entry)

    request_entry.status = "declined"
    db.commit()
    log_activity(db, "Account Request Declined", f"Declined account request for {normalized_email}.", "user")

    return {"message": "Account request declined successfully.", "status": request_entry.status}

@app.post("/api/contact-admin/send-otp")
def request_contact_admin_otp(payload: ContactAdminOtpRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    normalized_email = normalize_email(payload.email)
    validate_account_request_scope(db, payload.campus_id, payload.department, payload.program_id)

    existing = (
        db.query(models.AccountRequest)
        .filter(func.lower(models.AccountRequest.email) == normalized_email)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account request already exists for this email address.",
        )

    code = f"{random.randint(0, 999999):06d}"
    contact_admin_pending_requests[normalized_email] = {
        "full_name": payload.full_name,
        "campus_id": payload.campus_id,
        "department": payload.department,
        "program_id": payload.program_id,
        "email": normalized_email,
    }
    contact_admin_otp_store[normalized_email] = {
        "otp": code,
        "expires_at": utc_now() + timedelta(minutes=10),
    }
    logger.info("[OTP] Generated contact-admin verification code for %s", normalized_email)

    sent = send_contact_admin_otp_email(normalized_email, code)

    response = {"message": "OTP sent successfully. Please verify the code to continue.", "status": "otp-sent"}
    if not sent:
        response["demo_code"] = code
    return response


@app.post("/api/contact-admin/verify-otp")
def verify_contact_admin_otp(data: VerifyOtpRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    normalized_email = normalize_email(data.email)
    record = contact_admin_otp_store.get(normalized_email)

    if record and record["expires_at"] < utc_now():
        contact_admin_otp_store.pop(normalized_email, None)
        contact_admin_pending_requests.pop(normalized_email, None)
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")

    if not record or record["otp"] != data.otp:
        raise HTTPException(status_code=400, detail="Incorrect or expired verification code.")

    pending_payload = contact_admin_pending_requests.get(normalized_email)
    if not pending_payload:
        contact_admin_otp_store.pop(normalized_email, None)
        raise HTTPException(status_code=400, detail="Request session expired. Please request a new OTP.")
    validate_account_request_scope(
        db,
        pending_payload["campus_id"],
        pending_payload["department"],
        pending_payload["program_id"],
    )

    existing = (
        db.query(models.AccountRequest)
        .filter(func.lower(models.AccountRequest.email) == normalized_email)
        .first()
    )
    if existing:
        contact_admin_otp_store.pop(normalized_email, None)
        contact_admin_pending_requests.pop(normalized_email, None)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account request already exists for this email address.",
        )

    new_request = models.AccountRequest(
        full_name=pending_payload["full_name"],
        campus_id=pending_payload["campus_id"],
        department=pending_payload["department"],
        program_id=pending_payload.get("program_id"),
        email=normalized_email,
        status="pending"
    )
    db.add(new_request)
    db.commit()
    db.refresh(new_request)

    contact_admin_otp_store.pop(normalized_email, None)
    contact_admin_pending_requests.pop(normalized_email, None)

    try:
        background_tasks.add_task(
            send_request_submission_email,
            normalized_email,
            pending_payload["full_name"],
            pending_payload["department"],
        )
    except Exception as exc:
        print(f"Failed to queue submission confirmation email: {exc}")

    return {"message": "Email verified. Request submitted successfully.", "status": "pending"}


@app.post("/api/contact-admin")
def submit_account_request(payload: AccountRequestPayload, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    normalized_email = normalize_email(payload.email)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Please request and verify an OTP before submitting the account request.",
    )


@app.get("/api/debug/users")
def debug_list_users(db: Session = Depends(get_db)):
    # Temporary debug endpoint — returns raw user rows for verification
    rows = db.query(models.User).order_by(models.User.id.asc()).all()
    return [
        {
            "id": r.id,
            "email": r.email,
            "password": r.password,
            "role": r.role,
            "archived": r.archived,
        }
        for r in rows
    ]

@app.post("/api/upload")
async def upload_files(
    request: Request,
    module_file: UploadFile = File(...),
    syllabus_file: UploadFile = File(...),
    subject_id: Optional[int] = Form(None),
    user_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    user_id = current_user.id
    request_started_at = time.perf_counter()
    usage_id = None
    usage_tracker = GeminiUsageTracker()
    try:
        enforce_rate_limit("upload", request.client.host if request.client else "unknown")
        module_bytes = await read_upload_bytes(module_file, "module_file")
        syllabus_bytes = await read_upload_bytes(syllabus_file, "syllabus_file")
        module_text = extract_text(module_bytes, module_file.filename)
        syllabus_text = extract_text(syllabus_bytes, syllabus_file.filename)

        subject = None
        subject_info = None
        topics_data = None

        if str(current_user.role).lower() == "faculty" and subject_id is None:
            raise HTTPException(status_code=422, detail="Select a subject code from your program before uploading materials.")

        if subject_id is not None:
            subject_query = db.query(models.Subject).filter(
                models.Subject.id == subject_id,
                models.Subject.archived.is_(False),
            )
            if str(current_user.role).lower() == "faculty":
                program = db.query(models.Program).filter(models.Program.id == current_user.program_id).first() if current_user.program_id else None
                department = db.query(models.Department).filter(models.Department.id == program.department_id).first() if program else None
                if not program or not department:
                    raise HTTPException(status_code=403, detail="Your account must be assigned to a program and department before selecting a subject.")
                if current_user.department and current_user.department.strip().casefold() != department.name.strip().casefold():
                    raise HTTPException(status_code=403, detail="Your program is not assigned to your department.")
                faculty_campus_id = user_campus_id(db, current_user)
                if faculty_campus_id is not None and department.campus_id != faculty_campus_id:
                    raise HTTPException(status_code=403, detail="Your program is outside your assigned campus.")
                subject_query = subject_query.filter(
                    models.Subject.program_id == program.id,
                    models.Subject.department_id == department.id,
                    models.Subject.code.is_not(None),
                    func.trim(models.Subject.code) != "",
                )
            subject = subject_query.first()
            if not subject:
                raise HTTPException(status_code=404, detail="The selected subject is not available to this account.")
            subject_info = {
                "name": subject.name,
                "code": subject.code,
                "description": subject.description,
            }
            assert_user_subject_campus_access(db, current_user, subject)
        else:
            usage_id = questions.start_ai_usage(db, current_user, "syllabus_analysis")
            topics_data = detect_topics(syllabus_text, module_text, usage_tracker)
            subject_info = {
                "name": topics_data["course_title"],
                "code": topics_data["course_code"],
                "description": "",
            }
            subject = db.query(models.Subject).filter(
                models.Subject.name == subject_info["name"]
            ).first()
            if not subject:
                subject = models.Subject(
                    name=subject_info["name"],
                    code=subject_info.get("code"),
                    description=subject_info.get("description"),
                    user_id=user_id,
                )
                db.add(subject)
                db.commit()
                db.refresh(subject)

            assert_user_subject_campus_access(db, current_user, subject)

        if topics_data is None:
            usage_id = questions.start_ai_usage(db, current_user, "syllabus_analysis")
            topics_data = detect_topics(syllabus_text, module_text, usage_tracker)

        if usage_id is not None:
            usage_record = db.query(models.AIUsage).filter(models.AIUsage.id == usage_id).first()
            if usage_record and usage_record.campus_id is None:
                usage_record.campus_id = subject_campus_id(db, subject)
            questions.finish_ai_usage(
                db,
                usage_id,
                usage_tracker,
                "failed" if usage_tracker.failure_count else "success",
                request_started_at,
                usage_tracker.last_error_type,
            )

        upload = models.UploadedFile(
            user_id=user_id,
            subject_id=subject.id,
            module_filename=module_file.filename,
            syllabus_filename=syllabus_file.filename,
            module_text=module_text,
            syllabus_text=syllabus_text
        )
        db.add(upload)
        db.commit()
        db.refresh(upload)
        questions.FILE_CACHE[f"{upload.id}_legacy_topics"] = topics_data

        log_activity(db, "Uploaded Module", f"Processed '{module_file.filename}' for Table of Specifications.", "upload")

        return {
            "upload_id": upload.id,
            "subject": subject_info,
            "topics": topics_data["topics"],
            "max_questions_per_generation": questions.MAX_QUESTIONS_PER_GENERATION,
            "message": "Files uploaded! Now enter total number of items."
        }
    except HTTPException:
        if usage_id is not None:
            questions.finish_ai_usage(db, usage_id, usage_tracker, "failed", request_started_at, "HTTPException")
        log_activity(db, "Failed Upload", f"File '{module_file.filename}' could not be processed.", "upload", status="error", user_id=current_user.id)
        raise
    except Exception as e:
        if usage_id is not None:
            questions.finish_ai_usage(db, usage_id, usage_tracker, "failed", request_started_at, type(e).__name__)
        log_activity(db, "Failed Upload", f"File '{module_file.filename}' could not be processed.", "upload", status="error")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate")
async def generate_questions(
    upload_id: int = Form(...),
    total_items: int = Form(..., ge=1, le=questions.MAX_QUESTIONS_PER_GENERATION),
    question_types: str = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    request_started_at = time.perf_counter()
    usage_id = None
    usage_tracker = GeminiUsageTracker()
    try:
        upload = db.query(models.UploadedFile).filter(
            models.UploadedFile.id == upload_id
        ).first()
        if not upload:
            raise HTTPException(status_code=404, detail="Upload not found")
        questions._assert_upload_access(str(upload_id), current_user, db)
        usage_id = questions.reserve_ai_generation(
            db,
            current_user,
            total_items,
            "legacy_question_generation",
            upload_id=str(upload_id),
            request_started_at=request_started_at,
        )

        topics_cache_key = f"{upload.id}_legacy_topics"
        topics_data = questions.FILE_CACHE.get(topics_cache_key)
        if topics_data is None:
            topics_data = detect_topics(upload.syllabus_text, upload.module_text, usage_tracker)
            questions.FILE_CACHE[topics_cache_key] = topics_data
        selected_question_types = [value.strip() for value in question_types.split(",") if value.strip()] if question_types else None

        # Default: select all detected topics and assume equal hours if caller
        # didn't provide a detailed selection. This mirrors the two-step
        # /api/questions flow which collects per-topic hour weights first.
        all_topics = topics_data.get("topics", [])
        selected_indices = list(range(len(all_topics)))
        hours_dict = {str(i): 1 for i in selected_indices}

        tos = compute_tos(
            topics=all_topics,
            selected_topic_indices=selected_indices,
            hours_dict=hours_dict,
            total_items=total_items,
            question_types=selected_question_types or ["MCQ"],
        )

        tos_record = models.TableOfSpecification(
            upload_id=upload.id,
            tos_data=tos,
            total_items=total_items
        )
        db.add(tos_record)
        db.commit()
        db.refresh(tos_record)

        subject = db.query(models.Subject).filter(
            models.Subject.id == upload.subject_id
        ).first()

        generated_questions = generate_questions_from_tos(
            subject={"name": subject.name, "code": subject.code},
            module_text=upload.module_text,
            tos_data=tos,
            usage_tracker=usage_tracker,
        )

        bloom_distribution = {}
        question_type_distribution = {}
        for q in generated_questions:
            bloom_distribution[q["bloom_level"]] = bloom_distribution.get(q["bloom_level"], 0) + 1
            question_type_distribution[q["type"]] = question_type_distribution.get(q["type"], 0) + 1

        for q in generated_questions:
            question = models.GeneratedQuestion(
                tos_id=tos_record.id,
                subject_id=upload.subject_id,
                user_id=upload.user_id,
                topic_name=q.get("topic_name", ""),
                bloom_level=q.get("bloom_level", "Understand"),
                question_type=q.get("type"),
                question=q["question"],
                options=q.get("options"),
                correct_answer=q.get("correct_answer"),
                explanation=q.get("explanation")
            )
            db.add(question)
        db.commit()

        log_activity(db, "Generated Assessment", f"Created '{subject.name}' with {len(generated_questions)} questions.", "generate")
        questions.finish_ai_usage(db, usage_id, usage_tracker, "success", request_started_at)

        return {
            "tos_id": tos_record.id,
            "tos": tos,
            "total_questions": len(generated_questions),
            "questions_preview": generated_questions,
            "bloom_distribution": bloom_distribution,
            "question_type_distribution": question_type_distribution,
            "message": f"Successfully generated and classified {len(generated_questions)} questions!"
        }
    except HTTPException:
        if usage_id is not None:
            questions.finish_ai_usage(
                db, usage_id, usage_tracker, "failed", request_started_at, "HTTPException"
            )
        log_activity(db, "Assessment Generation Failed", f"Legacy generation failed for upload {upload_id}.", "generate", status="error", user_id=current_user.id)
        raise
    except Exception as e:
        if usage_id is not None:
            questions.finish_ai_usage(
                db, usage_id, usage_tracker, "failed", request_started_at,
                usage_tracker.last_error_type or type(e).__name__,
            )
        log_activity(db, "Assessment Generation Failed", f"Legacy generation failed for upload {upload_id}.", "generate", status="error")
        raise HTTPException(status_code=500, detail=str(e))

# --- NEW SCHEMAS FOR MANUAL ENTERED OPERATIONS ---
class SubjectCreateRequest(BaseModel):
    name: str
    code: str = None
    department_id: int | None = None
    program_id: int | None = None
    user_id: int | None = None

class DepartmentCreateRequest(BaseModel):
    name: str
    code: str | None = None
    campus_id: int | None = None
    dean_name: str | None = None

class DepartmentUpdateRequest(BaseModel):
    name: str
    code: str | None = None
    campus_id: int | None = None
    dean_name: str | None = None

class CampusRequest(BaseModel):
    name: str
    code: str | None = None
    is_active: bool | None = None

class CampusAdminCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    campus_id: int = Field(..., ge=1)

class CampusAdminUpdateRequest(BaseModel):
    campus_id: int = Field(..., ge=1)
    is_active: bool
    name: str | None = Field(default=None, min_length=2, max_length=255)
    email: str | None = Field(default=None, min_length=5, max_length=255)

class CampusStatusRequest(BaseModel):
    is_active: bool

class ProgramRequest(BaseModel):
    name: str
    code: str | None = None
    department_id: int
    chair_name: str | None = None

class FacultyAssignmentRequest(BaseModel):
    program_id: int | None = None

class UserProfileUpdateRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    program_id: int = Field(..., gt=0)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not SAFE_NAME_REGEX.fullmatch(cleaned):
            raise ValueError("Please provide a valid full name.")
        return cleaned

class LeadershipAssignmentRequest(BaseModel):
    faculty_id: int | None = None
    name: str | None = None

class ManualQuestionRequest(BaseModel):
    question: str = Field(..., min_length=10)
    correct_answer: str = Field(..., min_length=1, max_length=2000)
    question_type: str = Field(..., max_length=32)
    options: list[str] | dict[str, list[str]] | None = None
    points: float = Field(..., gt=0, le=1000)
    exam_type: str = Field(default="Final Exam", max_length=64)
    semester: str = Field(default="First Semester", max_length=32)
    academic_year: str = Field(default="", max_length=32)
    subject_id: int = Field(..., ge=1)
    user_id: int | None = Field(default=None, ge=1)

    @field_validator("question")
    @classmethod
    def validate_question_structure(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if len(normalized) < 10:
            raise ValueError(
                "The question should use a proper format or structure and contain at least 10 meaningful characters."
            )
        if not any(character.isalpha() for character in normalized):
            raise ValueError(
                "The question should use a proper format or structure with meaningful words."
            )
        if any(ord(character) < 32 and character not in "\t\n\r" for character in normalized):
            raise ValueError("The question contains invalid control characters and cannot be classified or saved.")
        return normalized

    @field_validator("question_type")
    @classmethod
    def validate_question_type(cls, value: str) -> str:
        allowed_types = {
            "MCQ", "True or False", "Identification", "Matching Type",
            "Enumeration", "Essay", "Situational",
        }
        if value not in allowed_types:
            raise ValueError("Select a valid question type before classifying and saving.")
        return value

    @field_validator("exam_type")
    @classmethod
    def validate_exam_type(cls, value: str) -> str:
        if value not in {"Midterm Exam", "Preliminary Exam", "Final Exam", "Quiz", "Long Exam"}:
            raise ValueError("Select a valid exam type before classifying and saving the question.")
        return value

    @field_validator("semester")
    @classmethod
    def validate_semester(cls, value: str) -> str:
        if value not in {"First Semester", "Second Semester", "Midterm Class"}:
            raise ValueError("Select a valid semester before classifying and saving the question.")
        return value

    @field_validator("correct_answer")
    @classmethod
    def validate_answer_key(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("Enter an answer key before classifying and saving the question.")
        return normalized

    @model_validator(mode="after")
    def validate_options(self):
        if self.question_type == "MCQ":
            if not isinstance(self.options, list) or len(self.options) < 2:
                raise ValueError("Enter at least two answer choices for a multiple-choice question.")
            if any(not str(option).strip() for option in self.options):
                raise ValueError("Each multiple-choice answer choice must contain text.")
        elif self.question_type == "Matching Type":
            if not re.fullmatch(r"[A-Za-z](?:\s*,\s*[A-Za-z])*(?:\s*)", self.correct_answer):
                raise ValueError("For Matching Type, enter answer letters only, such as A, C, B, D.")
        return self

class QuestionSetCreateRequest(BaseModel):
    name: str
    subject_id: int
    exam_title: str | None = None
    instructions: str | None = None
    total_points: int | None = None
    time_limit: str | None = None
    instructor_name: str | None = None
    department: str | None = None

class QuestionSetItemsRequest(BaseModel):
    question_ids: list[int] = []

class QuestionSetUpdateRequest(BaseModel):
    name: str | None = None
    status: str | None = None
    exam_title: str | None = None
    instructions: str | None = None
    total_points: int | None = None
    time_limit: str | None = None
    instructor_name: str | None = None
    department: str | None = None

@app.get("/api/departments")
def get_departments(db: Session = Depends(get_db), current_user: models.User | None = Depends(get_optional_current_user)):
    departments_query = db.query(models.Department).order_by(models.Department.name.asc())
    if current_user and str(current_user.role).lower() == "campus_admin":
        departments_query = departments_query.filter(models.Department.campus_id == current_user.campus_id)
    departments = departments_query.all()
    programs_by_department = defaultdict(list)
    for program in db.query(models.Program).order_by(models.Program.name.asc()).all():
        programs_by_department[program.department_id].append({"id": program.id, "name": program.name, "code": program.code})
    faculty_counts = defaultdict(int)
    for faculty in db.query(models.User).filter(models.User.role.ilike("faculty"), models.User.archived == False).all():
        if faculty.department:
            faculty_counts[faculty.department.strip().lower()] += 1
    return [
        {
            "id": department.id,
            "name": department.name,
            "code": department.code,
            "campus_id": department.campus_id,
            "faculty_count": faculty_counts[department.name.strip().lower()],
            "programs": programs_by_department[department.id],
        }
        for department in departments
    ]


@app.get("/api/academic-hierarchy")
def get_academic_hierarchy(db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    campus_id = visible_campus_id(admin)
    campuses_query = db.query(models.Campus).order_by(models.Campus.name.asc())
    departments_query = db.query(models.Department).order_by(models.Department.name.asc())
    if campus_id is not None:
        campuses_query = campuses_query.filter(models.Campus.id == campus_id)
        departments_query = departments_query.filter(models.Department.campus_id == campus_id)
    campuses = campuses_query.all()
    departments = departments_query.all()
    department_ids = {department.id for department in departments}
    programs = db.query(models.Program).filter(models.Program.department_id.in_(department_ids)).order_by(models.Program.name.asc()).all() if department_ids else []
    program_ids = {program.id for program in programs}
    faculty = db.query(models.User).filter(models.User.role.ilike("faculty"), models.User.archived == False).all()
    if campus_id is not None:
        department_names = {department.name.strip().lower() for department in departments}
        faculty = [member for member in faculty if member.program_id in program_ids or (member.department or "").strip().lower() in department_names]
    faculty_by_program = defaultdict(list)
    for member in faculty:
        if member.program_id:
            faculty_by_program[member.program_id].append({"id": member.id, "name": member.name or member.email, "email": member.email})
    programs_by_department = defaultdict(list)
    for program in programs:
        chair_name = (program.chair_name or "").strip()
        chair = next((member for member in faculty_by_program[program.id] if member["id"] == program.chair_id), None)
        programs_by_department[program.department_id].append({
            "id": program.id,
            "name": program.name,
            "code": program.code,
            "chair_id": program.chair_id,
            "chair_name": chair_name or (chair["name"] if chair else ""),
            "chair": {"id": chair["id"], "name": chair["name"], "email": chair["email"]} if chair else ({"id": None, "name": chair_name, "email": None} if chair_name else None),
            "faculty": faculty_by_program[program.id],
        })
    departments_by_campus = defaultdict(list)
    for department in departments:
        department_faculty = [member for member in faculty if member.department and member.department.strip().lower() == department.name.strip().lower() or member.program_id in {program["id"] for program in programs_by_department[department.id]}]
        dean = next((member for member in department_faculty if member.id == department.dean_id), None)
        dean_name = (department.dean_name or "").strip()
        chair_name = (department.chair_name or "").strip()
        departments_by_campus[department.campus_id].append({
            "id": department.id,
            "name": department.name,
            "code": department.code,
            "dean_id": department.dean_id,
            "dean_name": dean_name or (dean.name if dean else ""),
            "chair_name": chair_name,
            "dean": {"id": dean.id, "name": dean.name or dean.email, "email": dean.email} if dean else ({"id": None, "name": dean_name, "email": None} if dean_name else None),
            "programs": programs_by_department[department.id],
        })
    assigned_faculty_ids = {member.id for member in faculty if member.program_id}
    unassigned_faculty = [
        {"id": member.id, "name": member.name or member.email, "email": member.email}
        for member in faculty if member.id not in assigned_faculty_ids
    ]
    return {
        "campuses": [{"id": campus.id, "name": campus.name, "code": campus.code, "is_active": campus.is_active, "departments": departments_by_campus[campus.id]} for campus in campuses],
        "unassigned_faculty": unassigned_faculty,
        "faculty": [{"id": member.id, "name": member.name or member.email, "email": member.email, "department": member.department, "program_id": member.program_id} for member in faculty],
    }

@app.get("/api/campuses")
def list_active_campuses(db: Session = Depends(get_db)):
    return [
        {"id": campus.id, "name": campus.name, "code": campus.code}
        for campus in db.query(models.Campus)
        .filter(models.Campus.is_active.is_(True))
        .order_by(models.Campus.name.asc())
        .all()
    ]


@app.post("/api/campuses", status_code=201)
def create_campus(payload: CampusRequest, db: Session = Depends(get_db), _admin: models.User = Depends(require_super_admin)):
    name, code = payload.name.strip(), payload.code.strip() if payload.code else None
    if db.query(models.Campus).filter(func.lower(models.Campus.name) == name.lower()).first():
        raise HTTPException(status_code=400, detail="A campus with this name already exists.")
    campus = models.Campus(name=name, code=code)
    db.add(campus)
    db.commit()
    db.refresh(campus)
    log_activity(db, "Campus Created", f"Super Admin { _admin.id } created campus {campus.id}.", "security", user_id=_admin.id)
    return {"id": campus.id, "name": campus.name, "code": campus.code}

@app.put("/api/campuses/{campus_id}")
def update_campus(campus_id: int, payload: CampusRequest, db: Session = Depends(get_db), _admin: models.User = Depends(require_super_admin)):
    campus = db.query(models.Campus).filter(models.Campus.id == campus_id).first()
    if not campus:
        raise HTTPException(status_code=404, detail="Campus not found.")
    campus.name, campus.code = payload.name.strip(), payload.code.strip() if payload.code else None
    if payload.is_active is not None:
        campus.is_active = payload.is_active
    db.commit()
    db.refresh(campus)
    log_activity(db, "Campus Updated", f"Super Admin { _admin.id } updated campus {campus.id}.", "security", user_id=_admin.id)
    return {"id": campus.id, "name": campus.name, "code": campus.code}

@app.delete("/api/campuses/{campus_id}")
def delete_campus(campus_id: int, db: Session = Depends(get_db), _admin: models.User = Depends(require_super_admin)):
    campus = db.query(models.Campus).filter(models.Campus.id == campus_id).first()
    if not campus:
        raise HTTPException(status_code=404, detail="Campus not found.")
    if db.query(models.Department).filter(models.Department.campus_id == campus_id).first():
        raise HTTPException(status_code=400, detail="Move or delete the departments in this campus first.")
    if db.query(models.User).filter(models.User.campus_id == campus_id).first():
        raise HTTPException(status_code=400, detail="Reassign Campus Admins before deleting this campus.")
    db.delete(campus)
    db.commit()
    log_activity(db, "Campus Deleted", f"Super Admin { _admin.id } deleted campus {campus_id}.", "security", user_id=_admin.id)
    return {"message": "Campus deleted successfully."}


@app.get("/api/super-admin/overview")
def get_super_admin_overview(db: Session = Depends(get_db), _admin: models.User = Depends(require_super_admin)):
    active_questions = db.query(models.GeneratedQuestion).filter(models.GeneratedQuestion.archived.is_(False))
    campus_stats = []
    attributed_question_ids = set()
    for campus in db.query(models.Campus).order_by(models.Campus.name.asc()).all():
        department_ids = db.query(models.Department.id).filter(models.Department.campus_id == campus.id).subquery()
        program_ids = db.query(models.Program.id).filter(models.Program.department_id.in_(department_ids)).subquery()
        subject_ids = db.query(models.Subject.id).filter(
            or_(models.Subject.department_id.in_(department_ids), models.Subject.program_id.in_(program_ids))
        ).subquery()
        campus_users = db.query(models.User.id).outerjoin(
            models.Program, models.Program.id == models.User.program_id
        ).outerjoin(
            models.Department, models.Department.id == models.Program.department_id
        ).filter(or_(
            models.User.campus_id == campus.id,
            and_(
                models.User.campus_id.is_(None),
                or_(
                    models.Department.campus_id == campus.id,
                    func.lower(models.User.department).in_(
                        db.query(func.lower(models.Department.name)).filter(models.Department.campus_id == campus.id)
                    ),
                ),
            ),
        )).subquery()
        campus_question_ids = {
            row[0]
            for row in db.query(models.GeneratedQuestion.id).outerjoin(
                models.TableOfSpecification, models.TableOfSpecification.id == models.GeneratedQuestion.tos_id
            ).outerjoin(
                models.UploadedFile, models.UploadedFile.id == models.TableOfSpecification.upload_id
            ).outerjoin(
                models.Subject, models.Subject.id == models.GeneratedQuestion.subject_id
            ).filter(
                models.GeneratedQuestion.archived.is_(False),
                or_(
                    models.GeneratedQuestion.user_id.in_(campus_users),
                    and_(
                        models.GeneratedQuestion.user_id.is_(None),
                        models.UploadedFile.user_id.in_(campus_users),
                    ),
                    and_(
                        models.GeneratedQuestion.user_id.is_(None),
                        models.UploadedFile.user_id.is_(None),
                        or_(
                            models.GeneratedQuestion.subject_id.in_(subject_ids),
                            models.Subject.user_id.in_(campus_users),
                        ),
                    ),
                ),
            ).distinct().all()
        }
        attributed_question_ids.update(campus_question_ids)
        campus_bloom_distribution = {
            level or "Unclassified": count
            for level, count in db.query(
                models.GeneratedQuestion.bloom_level,
                func.count(models.GeneratedQuestion.id),
            ).filter(
                models.GeneratedQuestion.id.in_(campus_question_ids),
                models.GeneratedQuestion.archived.is_(False),
            ).group_by(models.GeneratedQuestion.bloom_level).all()
        }
        campus_stats.append({
            "id": campus.id,
            "name": campus.name,
            "code": campus.code,
            "is_active": campus.is_active,
            "departments": db.query(models.Department.id).filter(models.Department.campus_id == campus.id).count(),
            "programs": db.query(models.Program.id).filter(models.Program.department_id.in_(department_ids)).count(),
            "subjects": db.query(models.Subject.id).filter(
                models.Subject.id.in_(subject_ids),
                models.Subject.archived.is_(False),
            ).count(),
            "users": db.query(models.User.id).filter(models.User.id.in_(campus_users)).filter(models.User.archived.is_(False)).count(),
            "faculty": db.query(models.User.id).filter(models.User.id.in_(campus_users), models.User.role.ilike("faculty"), models.User.archived.is_(False)).count(),
            "questions": len(campus_question_ids),
            "bloom_distribution": campus_bloom_distribution,
        })

    scoped_active_questions = active_questions.filter(models.GeneratedQuestion.id.in_(attributed_question_ids))
    bloom_distribution = {
        level or "Unclassified": count
        for level, count in scoped_active_questions.with_entities(
            models.GeneratedQuestion.bloom_level,
            func.count(models.GeneratedQuestion.id),
        ).group_by(models.GeneratedQuestion.bloom_level).all()
    }
    question_type_distribution = {
        question_type or "Unclassified": count
        for question_type, count in scoped_active_questions.with_entities(
            models.GeneratedQuestion.question_type,
            func.count(models.GeneratedQuestion.id),
        ).group_by(models.GeneratedQuestion.question_type).all()
    }

    return {
        "totals": {
            "campuses": db.query(models.Campus.id).count(),
            "active_campuses": db.query(models.Campus.id).filter(models.Campus.is_active.is_(True)).count(),
            "departments": db.query(models.Department.id).count(),
            "programs": db.query(models.Program.id).count(),
            "subjects": db.query(models.Subject.id).filter(models.Subject.archived.is_(False)).count(),
            "users": db.query(models.User.id).filter(models.User.archived.is_(False)).count(),
            "faculty": db.query(models.User.id).filter(models.User.role.ilike("faculty"), models.User.archived.is_(False)).count(),
            "questions": len(attributed_question_ids),
        },
        "bloom_distribution": bloom_distribution,
        "question_type_distribution": question_type_distribution,
        "campuses": campus_stats,
    }


@app.get("/api/super-admin/ai-usage")
def get_super_admin_ai_usage(
    campus_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    model_name: str | None = None,
    request_status: str | None = None,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_super_admin),
):
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from must not be later than date_to.")
    allowed_statuses = {"in_progress", "success", "failed", "rate_limited"}
    if request_status and request_status not in allowed_statuses:
        raise HTTPException(status_code=422, detail="Unsupported AI usage status filter.")

    filters = []
    if campus_id is not None:
        filters.append(models.AIUsage.campus_id == campus_id)
    if date_from is not None:
        filters.append(models.AIUsage.generated_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to is not None:
        filters.append(models.AIUsage.generated_at < datetime.combine(date_to + timedelta(days=1), datetime.min.time()))
    if model_name:
        filters.append(models.AIUsage.gemini_model == model_name)
    if request_status:
        filters.append(models.AIUsage.status == request_status)

    usage = db.query(models.AIUsage).filter(*filters)
    generated_questions = int(
        usage.with_entities(func.coalesce(func.sum(models.AIUsage.generated_question_count), 0)).scalar() or 0
    )
    generation_types = ("question_generation", "question_recreation", "legacy_question_generation")
    gemini_requests = usage.filter(models.AIUsage.gemini_api_call_count > 0)

    campus_rows = db.query(
        models.AIUsage.campus_id,
        models.Campus.name,
        func.count(models.AIUsage.id).label("request_count"),
        func.coalesce(func.sum(models.AIUsage.generated_question_count), 0).label("question_count"),
    ).outerjoin(
        models.Campus, models.Campus.id == models.AIUsage.campus_id
    ).filter(*filters).group_by(
        models.AIUsage.campus_id, models.Campus.name
    ).order_by(func.count(models.AIUsage.id).desc()).all()

    user_rows = db.query(
        models.AIUsage.user_id,
        models.User.name,
        models.User.email,
        models.User.role,
        func.count(models.AIUsage.id).label("request_count"),
        func.coalesce(func.sum(models.AIUsage.generated_question_count), 0).label("question_count"),
    ).join(
        models.User, models.User.id == models.AIUsage.user_id
    ).filter(*filters).group_by(
        models.AIUsage.user_id, models.User.name, models.User.email, models.User.role
    ).order_by(func.count(models.AIUsage.id).desc()).all()

    month_expression = (
        func.date_trunc("month", models.AIUsage.generated_at)
        if db.get_bind().dialect.name == "postgresql"
        else func.strftime("%Y-%m", models.AIUsage.generated_at)
    )
    month_rows = db.query(
        month_expression.label("month"),
        func.count(models.AIUsage.id).label("request_count"),
        func.coalesce(func.sum(models.AIUsage.generated_question_count), 0).label("question_count"),
    ).filter(*filters).group_by(month_expression).order_by(month_expression.asc()).all()

    model_rows = db.query(
        func.coalesce(models.AIUsage.gemini_model, "No Gemini call").label("model"),
        func.count(models.AIUsage.id).label("request_count"),
        func.coalesce(func.sum(models.AIUsage.gemini_api_call_count), 0).label("api_call_count"),
        func.coalesce(func.sum(models.AIUsage.generated_question_count), 0).label("question_count"),
    ).filter(*filters).group_by(
        models.AIUsage.gemini_model
    ).order_by(func.count(models.AIUsage.id).desc()).all()

    error_rows = db.query(
        models.AIUsage.error_type,
        func.count(models.AIUsage.id).label("request_count"),
    ).filter(
        *filters,
        models.AIUsage.error_type.is_not(None),
    ).group_by(models.AIUsage.error_type).order_by(func.count(models.AIUsage.id).desc()).all()

    gemini_request_count = gemini_requests.count()

    def complete_token_total(column) -> int | None:
        known_count = gemini_requests.filter(column.is_not(None)).count()
        if gemini_request_count == 0 or known_count != gemini_request_count:
            return None
        return int(gemini_requests.with_entities(func.coalesce(func.sum(column), 0)).scalar() or 0)

    input_tokens = complete_token_total(models.AIUsage.input_tokens)
    output_tokens = complete_token_total(models.AIUsage.output_tokens)
    total_tokens = complete_token_total(models.AIUsage.total_tokens)

    return {
        "totals": {
            "total_ai_requests": usage.count(),
            "generation_requests": usage.filter(models.AIUsage.request_type.in_(generation_types)).count(),
            "total_questions_generated": generated_questions,
            "successful_requests": usage.filter(models.AIUsage.status == "success").count(),
            "failed_requests": usage.filter(models.AIUsage.status == "failed").count(),
            "rate_limit_events": usage.filter(models.AIUsage.status == "rate_limited").count(),
            "in_progress_requests": usage.filter(models.AIUsage.status == "in_progress").count(),
            "gemini_api_calls": int(gemini_requests.with_entities(
                func.coalesce(func.sum(models.AIUsage.gemini_api_call_count), 0)
            ).scalar() or 0),
        },
        "requests_by_campus": [
            {
                "campus_id": row.campus_id,
                "campus": row.name or "Unassigned",
                "requests": row.request_count,
                "questions": int(row.question_count or 0),
            }
            for row in campus_rows
        ],
        "requests_by_user": [
            {
                "user_id": row.user_id,
                "name": row.name or row.email,
                "email": row.email,
                "role": row.role,
                "requests": row.request_count,
                "questions": int(row.question_count or 0),
            }
            for row in user_rows
        ],
        "requests_by_month": [
            {
                "month": row.month.strftime("%Y-%m") if hasattr(row.month, "strftime") else str(row.month),
                "requests": row.request_count,
                "questions": int(row.question_count or 0),
            }
            for row in month_rows
        ],
        "model_usage": [
            {
                "model": row.model,
                "requests": row.request_count,
                "api_calls": int(row.api_call_count or 0),
                "questions": int(row.question_count or 0),
            }
            for row in model_rows
        ],
        "error_types": [
            {"error_type": row.error_type, "requests": row.request_count}
            for row in error_rows
        ],
        "token_usage": {
            "available": input_tokens is not None and output_tokens is not None and total_tokens is not None,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "requests_with_gemini_calls": gemini_request_count,
        },
        "available_models": [
            row[0]
            for row in db.query(models.AIUsage.gemini_model).filter(
                models.AIUsage.gemini_model.is_not(None)
            ).distinct().order_by(models.AIUsage.gemini_model).all()
        ],
    }


@app.get("/api/super-admin/campuses")
def list_super_admin_campuses(db: Session = Depends(get_db), _admin: models.User = Depends(require_super_admin)):
    return get_super_admin_overview(db=db, _admin=_admin)["campuses"]


@app.patch("/api/campuses/{campus_id}/status")
def set_campus_status(campus_id: int, payload: CampusStatusRequest, db: Session = Depends(get_db), admin: models.User = Depends(require_super_admin)):
    campus = db.query(models.Campus).filter(models.Campus.id == campus_id).first()
    if not campus:
        raise HTTPException(status_code=404, detail="Campus not found.")
    campus.is_active = payload.is_active
    if not campus.is_active:
        db.query(models.UserSession).filter(
            models.UserSession.user_id.in_(db.query(models.User.id).filter(
                models.User.role == "campus_admin",
                models.User.campus_id == campus_id,
            )),
            models.UserSession.revoked_at.is_(None),
        ).update({"revoked_at": datetime.utcnow()}, synchronize_session=False)
    db.commit()
    log_activity(db, "Campus Status Updated", f"Super Admin {admin.id} set campus {campus.id} active={campus.is_active}.", "security", user_id=admin.id)
    return {"id": campus.id, "name": campus.name, "is_active": campus.is_active}


@app.get("/api/super-admin/admins")
def list_campus_admins(db: Session = Depends(get_db), _admin: models.User = Depends(require_super_admin)):
    rows = db.query(models.User, models.Campus).outerjoin(
        models.Campus, models.Campus.id == models.User.campus_id
    ).filter(models.User.role.in_(("campus_admin", "admin"))).order_by(models.User.name.asc(), models.User.email.asc()).all()
    return [{
        "id": user.id,
        "name": user.name or user.email,
        "email": user.email,
        "role": user.role,
        "campus_id": user.campus_id,
        "campus": campus.name if campus else None,
        "is_active": not user.archived and bool(campus and campus.is_active),
    } for user, campus in rows]


@app.post("/api/super-admin/admins", status_code=201)
def create_campus_admin(payload: CampusAdminCreateRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), admin: models.User = Depends(require_super_admin)):
    normalized_email = normalize_email(payload.email)
    campus = db.query(models.Campus).filter(models.Campus.id == payload.campus_id, models.Campus.is_active.is_(True)).first()
    if not campus:
        raise HTTPException(status_code=404, detail="Active campus not found.")
    if db.query(models.User).filter(func.lower(models.User.email) == normalized_email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user = models.User(
        email=normalized_email,
        password=hash_password(payload.password),
        role="campus_admin",
        campus_id=campus.id,
        name=payload.name.strip(),
        archived=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_activity(db, "Campus Admin Created", f"Super Admin {admin.id} created a Campus Admin for campus {campus.id}.", "security", user_id=admin.id)
    background_tasks.add_task(send_campus_admin_credentials_email, normalized_email, user.name, payload.password, campus.name)
    return {"id": user.id, "name": user.name, "email": user.email, "campus_id": campus.id, "campus": campus.name, "is_active": True}


@app.put("/api/super-admin/admins/{user_id}")
def update_campus_admin(user_id: int, payload: CampusAdminUpdateRequest, db: Session = Depends(get_db), admin: models.User = Depends(require_super_admin)):
    user = db.query(models.User).filter(models.User.id == user_id, models.User.role.in_(("campus_admin", "admin"))).first()
    if not user:
        raise HTTPException(status_code=404, detail="Campus Admin not found.")
    campus = db.query(models.Campus).filter(models.Campus.id == payload.campus_id).first()
    if not campus:
        raise HTTPException(status_code=404, detail="Campus not found.")
    if payload.is_active and not campus.is_active:
        raise HTTPException(status_code=400, detail="An inactive campus cannot have an active Campus Admin.")
    if payload.email:
        normalized_email = normalize_email(payload.email)
        existing_email = db.query(models.User).filter(
            func.lower(models.User.email) == normalized_email,
            models.User.id != user.id,
        ).first()
        if existing_email:
            raise HTTPException(status_code=409, detail="An account with this email already exists.")
        user.email = normalized_email
    if payload.name:
        user.name = payload.name.strip()
    old_campus_id = user.campus_id
    user.role = "campus_admin"
    user.campus_id = campus.id
    user.archived = not payload.is_active
    if user.archived or old_campus_id != campus.id:
        db.query(models.UserSession).filter(
            models.UserSession.user_id == user.id,
            models.UserSession.revoked_at.is_(None),
        ).update({"revoked_at": datetime.utcnow()}, synchronize_session=False)
    db.commit()
    log_activity(db, "Campus Admin Updated", f"Super Admin {admin.id} updated Campus Admin {user.id} assignment/status.", "security", user_id=admin.id)
    return {"id": user.id, "name": user.name or user.email, "email": user.email, "campus_id": campus.id, "campus": campus.name, "is_active": not user.archived}


@app.delete("/api/super-admin/admins/{user_id}")
def delete_campus_admin(user_id: int, db: Session = Depends(get_db), admin: models.User = Depends(require_super_admin)):
    user = db.query(models.User).filter(models.User.id == user_id, models.User.role.in_(("campus_admin", "admin"))).first()
    if not user:
        raise HTTPException(status_code=404, detail="Campus Admin not found.")

    campus = db.query(models.Campus).filter(models.Campus.id == user.campus_id).first() if user.campus_id else None
    if not user.archived and campus and campus.is_active:
        raise HTTPException(status_code=400, detail="Deactivate the Campus Admin before deleting the account.")

    db.query(models.ActivityLog).filter(models.ActivityLog.user_id == user.id).update(
        {models.ActivityLog.user_id: None}, synchronize_session=False
    )
    db.query(models.ActivityLog).filter(models.ActivityLog.actor_id == user.id).update(
        {models.ActivityLog.actor_id: None}, synchronize_session=False
    )
    db.query(models.ActivityLog).filter(models.ActivityLog.target_user_id == user.id).update(
        {models.ActivityLog.target_user_id: None}, synchronize_session=False
    )
    db.query(models.Department).filter(models.Department.dean_id == user.id).update(
        {models.Department.dean_id: None}, synchronize_session=False
    )
    db.query(models.Program).filter(models.Program.chair_id == user.id).update(
        {models.Program.chair_id: None}, synchronize_session=False
    )
    db.query(models.UserChangeRequest).filter(models.UserChangeRequest.user_id == user.id).delete(synchronize_session=False)
    db.query(models.UserChangeRequest).filter(models.UserChangeRequest.reviewed_by == user.id).update(
        {models.UserChangeRequest.reviewed_by: None}, synchronize_session=False
    )
    db.query(models.AIUsage).filter(models.AIUsage.user_id == user.id).delete(synchronize_session=False)
    db.query(models.UserHiddenSubject).filter(models.UserHiddenSubject.user_id == user.id).delete(synchronize_session=False)
    db.query(models.Subject).filter(models.Subject.user_id == user.id).update(
        {models.Subject.user_id: None}, synchronize_session=False
    )
    db.query(models.UploadedFile).filter(models.UploadedFile.user_id == user.id).update(
        {models.UploadedFile.user_id: None}, synchronize_session=False
    )
    db.query(models.GeneratedQuestion).filter(models.GeneratedQuestion.user_id == user.id).update(
        {models.GeneratedQuestion.user_id: None}, synchronize_session=False
    )
    db.query(models.UserSession).filter(models.UserSession.user_id == user.id).delete(synchronize_session=False)

    email = user.email
    db.delete(user)
    db.commit()
    log_activity(db, "Campus Admin Deleted", f"Super Admin {admin.id} permanently deleted Campus Admin {email}.", "security", actor_id=admin.id)
    return {"message": "Campus Admin permanently deleted.", "status": "deleted"}


@app.get("/api/super-admin/users")
def list_super_admin_users(
    campus_id: int | None = None,
    role: str | None = None,
    status_filter: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_super_admin),
):
    query = db.query(models.User, models.Program, models.Department).outerjoin(
        models.Program, models.Program.id == models.User.program_id
    ).outerjoin(
        models.Department, models.Department.id == models.Program.department_id
    )
    if campus_id is not None:
        department_names = db.query(func.lower(models.Department.name)).filter(models.Department.campus_id == campus_id)
        query = query.filter(or_(
            models.User.campus_id == campus_id,
            models.Department.campus_id == campus_id,
            func.lower(models.User.department).in_(department_names),
        ))
    if role:
        query = query.filter(func.lower(models.User.role) == role.lower())
    if status_filter == "active":
        query = query.filter(models.User.archived.is_(False))
    elif status_filter == "archived":
        query = query.filter(models.User.archived.is_(True))
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(or_(models.User.name.ilike(term), models.User.email.ilike(term), models.User.department.ilike(term)))
    rows = query.order_by(models.User.name.asc(), models.User.email.asc()).all()
    campus_by_id = {campus.id: campus.name for campus in db.query(models.Campus).all()}
    return [{
        "id": user.id,
        "name": user.name or user.email,
        "email": user.email,
        "role": user.role,
        "campus_id": user.campus_id or (department.campus_id if department else user_campus_id(db, user)),
        "campus": campus_by_id.get(user.campus_id or (department.campus_id if department else user_campus_id(db, user))),
        "department": department.name if department else user.department,
        "program": program.name if program else None,
        "is_active": not user.archived,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    } for user, program, department in rows]

@app.post("/api/programs", status_code=201)
def create_program(payload: ProgramRequest, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    department = db.query(models.Department).filter(models.Department.id == payload.department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found.")
    assert_campus_access(admin, department.campus_id)
    program = models.Program(name=payload.name.strip(), code=payload.code.strip() if payload.code else None, department_id=payload.department_id, chair_name=(payload.chair_name or "").strip() or None)
    db.add(program)
    db.commit()
    db.refresh(program)
    log_activity(db, "Program Created", f"Admin {admin.id} created program '{program.name}'.", "academic", user_id=admin.id)
    return {"id": program.id, "name": program.name, "code": program.code, "department_id": program.department_id, "chair_name": program.chair_name}

@app.put("/api/programs/{program_id}")
def update_program(program_id: int, payload: ProgramRequest, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    program = db.query(models.Program).filter(models.Program.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found.")
    old_department = db.query(models.Department).filter(models.Department.id == program.department_id).first()
    new_department = db.query(models.Department).filter(models.Department.id == payload.department_id).first()
    if not new_department:
        raise HTTPException(status_code=404, detail="Department not found.")
    assert_campus_access(admin, old_department.campus_id if old_department else None)
    assert_campus_access(admin, new_department.campus_id)
    program.name, program.code, program.department_id = payload.name.strip(), payload.code.strip() if payload.code else None, payload.department_id
    if payload.chair_name is not None and payload.chair_name.strip() != (program.chair_name or ""):
        program.chair_name = payload.chair_name.strip() or None
        program.chair_id = None
    db.commit()
    db.refresh(program)
    log_activity(db, "Program Updated", f"Admin {admin.id} updated program '{program.name}'.", "academic", user_id=admin.id)
    return {"id": program.id, "name": program.name, "code": program.code, "department_id": program.department_id, "chair_name": program.chair_name}

@app.delete("/api/programs/{program_id}")
def delete_program(program_id: int, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    program = db.query(models.Program).filter(models.Program.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found.")
    department = db.query(models.Department).filter(models.Department.id == program.department_id).first()
    assert_campus_access(admin, department.campus_id if department else None)
    db.query(models.User).filter(models.User.program_id == program_id).update({"program_id": None}, synchronize_session=False)
    db.delete(program)
    db.commit()
    log_activity(db, "Program Deleted", f"Admin {admin.id} deleted program '{program.name}'.", "academic", user_id=admin.id)
    return {"message": "Program deleted successfully."}

@app.put("/api/faculty/{faculty_id}/program")
def assign_faculty_program(faculty_id: int, payload: FacultyAssignmentRequest, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    faculty = db.query(models.User).filter(models.User.id == faculty_id, models.User.role.ilike("faculty")).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty member not found.")
    program = db.query(models.Program).filter(models.Program.id == payload.program_id).first() if payload.program_id else None
    if payload.program_id and not program:
        raise HTTPException(status_code=404, detail="Program not found.")
    previous_campus_id = user_campus_id(db, faculty)
    if previous_campus_id is not None:
        assert_campus_access(admin, previous_campus_id)
    if program:
        target_department = db.query(models.Department).filter(models.Department.id == program.department_id).first()
        assert_campus_access(admin, target_department.campus_id if target_department else None)
    faculty.program_id = program.id if program else None
    if program:
        department = db.query(models.Department).filter(models.Department.id == program.department_id).first()
        faculty.department = department.name if department else faculty.department
    db.commit()
    log_activity(db, "Faculty Program Assignment Updated", f"Admin {admin.id} updated faculty {faculty.id} program assignment.", "academic", user_id=admin.id)
    return {"id": faculty.id, "program_id": faculty.program_id}

def get_user_program_department(db: Session, user: models.User):
    department_name = (user.department or "").strip()
    campus_id = user_campus_id(db, user)

    if user.program_id:
        program = db.query(models.Program).filter(models.Program.id == user.program_id).first()
        department = db.query(models.Department).filter(
            models.Department.id == program.department_id,
        ).first() if program else None
        if department and (campus_id is None or department.campus_id == campus_id):
            return department

    if department_name:
        department_query = db.query(models.Department).filter(
            func.lower(models.Department.name) == department_name.lower(),
        )
        if campus_id is not None:
            department_query = department_query.filter(models.Department.campus_id == campus_id)
        department = department_query.first()
        if department:
            return department

    return None


def serialize_user_profile(db: Session, user: models.User):
    department = get_user_program_department(db, user)
    programs = db.query(models.Program).filter(
        models.Program.department_id == department.id,
    ).order_by(models.Program.name.asc()).all() if department else []
    program_ids = {program.id for program in programs}
    return {
        "full_name": user.name or "",
        "department": department.name if department else user.department or "",
        "program_id": user.program_id if user.program_id in program_ids else None,
        "programs": [
            {"id": program.id, "name": program.name, "code": program.code}
            for program in programs
        ],
    }


@app.get("/api/user/profile")
def get_user_profile(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if str(current_user.role).lower() not in {"faculty", "student"}:
        raise HTTPException(status_code=403, detail="Profile program settings are not available for this role.")
    return serialize_user_profile(db, current_user)


@app.put("/api/user/profile")
def update_user_profile(payload: UserProfileUpdateRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if str(current_user.role).lower() not in {"faculty", "student"}:
        raise HTTPException(status_code=403, detail="Profile program settings are not available for this role.")
    department = get_user_program_department(db, current_user)
    if not department:
        raise HTTPException(status_code=422, detail="Your account must have a department assigned before selecting a program.")

    program = db.query(models.Program).filter(
        models.Program.id == payload.program_id,
        models.Program.department_id == department.id,
    ).first()
    if not program:
        raise HTTPException(status_code=422, detail="Select a program from your department.")

    current_user.name = payload.full_name
    current_user.department = department.name
    current_user.program_id = program.id
    db.commit()
    db.refresh(current_user)
    log_activity(db, "User Profile Updated", f"User {current_user.id} updated their profile and program assignment.", "account", user_id=current_user.id)
    return serialize_user_profile(db, current_user)

@app.put("/api/departments/{department_id}/dean")
def assign_department_dean(department_id: int, payload: LeadershipAssignmentRequest, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    department = db.query(models.Department).filter(models.Department.id == department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found.")
    assert_campus_access(admin, department.campus_id)

    if payload.name is not None:
        normalized_name = (payload.name or "").strip()
        department.dean_name = normalized_name or None
        department.dean_id = None
        db.commit()
        log_activity(db, "Department Dean Updated", f"Admin {admin.id} updated dean for department '{department.name}'.", "academic", user_id=admin.id)
        return {"department_id": department.id, "dean_id": department.dean_id, "dean_name": department.dean_name}

    faculty = None
    if payload.faculty_id:
        faculty = db.query(models.User).filter(models.User.id == payload.faculty_id, models.User.role.ilike("faculty"), models.User.archived == False).first()
        if not faculty:
            raise HTTPException(status_code=404, detail="Faculty member not found.")
        program_ids = [program.id for program in db.query(models.Program).filter(models.Program.department_id == department_id).all()]
        if (faculty.department or "").strip().lower() != department.name.strip().lower() and faculty.program_id not in program_ids:
            raise HTTPException(status_code=400, detail="Dean must belong to this department.")
        department.dean_name = faculty.name or faculty.email or None
    department.dean_id = faculty.id if faculty else None
    db.commit()
    log_activity(db, "Department Dean Updated", f"Admin {admin.id} updated dean for department '{department.name}'.", "academic", user_id=admin.id)
    return {"department_id": department.id, "dean_id": department.dean_id, "dean_name": department.dean_name}

@app.put("/api/departments/{department_id}/chair")
def assign_department_chair(department_id: int, payload: LeadershipAssignmentRequest, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    department = db.query(models.Department).filter(models.Department.id == department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found.")
    assert_campus_access(admin, department.campus_id)

    normalized_name = payload.name.strip() if payload.name is not None else None
    department.chair_name = normalized_name or None
    db.commit()
    log_activity(db, "Department Chair Updated", f"Admin {admin.id} updated chair for department '{department.name}'.", "academic", user_id=admin.id)
    return {"department_id": department.id, "chair_name": department.chair_name}

@app.put("/api/programs/{program_id}/chair")
def assign_program_chair(program_id: int, payload: LeadershipAssignmentRequest, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    program = db.query(models.Program).filter(models.Program.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found.")
    department = db.query(models.Department).filter(models.Department.id == program.department_id).first()
    assert_campus_access(admin, department.campus_id if department else None)

    if payload.name is not None:
        normalized_name = payload.name.strip()
        program.chair_name = normalized_name or None
        program.chair_id = None
        db.commit()
        log_activity(db, "Program Chair Updated", f"Admin {admin.id} updated chair for program '{program.name}'.", "academic", user_id=admin.id)
        return {"program_id": program.id, "chair_id": program.chair_id, "chair_name": program.chair_name}

    faculty = None
    if payload.faculty_id:
        faculty = db.query(models.User).filter(models.User.id == payload.faculty_id, models.User.role.ilike("faculty"), models.User.archived == False).first()
        if not faculty or faculty.program_id != program_id:
            raise HTTPException(status_code=400, detail="Program chair must be assigned from this program's faculty.")
        program.chair_name = faculty.name or faculty.email or None
    program.chair_id = faculty.id if faculty else None
    db.commit()
    log_activity(db, "Program Chair Updated", f"Admin {admin.id} updated chair for program '{program.name}'.", "academic", user_id=admin.id)
    return {"program_id": program.id, "chair_id": program.chair_id, "chair_name": program.chair_name}

@app.post("/api/departments", status_code=201)
def create_department(payload: DepartmentCreateRequest, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    normalized_name = payload.name.strip()
    normalized_code = payload.code.strip() if payload.code else None

    campus_id = payload.campus_id
    if campus_id is None and str(admin.role).lower() == "campus_admin":
        campus_id = admin.campus_id
    if campus_id is None:
        raise HTTPException(status_code=400, detail="Select a campus for this department.")

    existing = db.query(models.Department).filter(
        func.lower(models.Department.name) == normalized_name.lower(),
        models.Department.campus_id == campus_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A department with this name already exists in this campus.")

    if normalized_code:
        code_match = db.query(models.Department).filter(
            func.lower(models.Department.code) == normalized_code.lower(),
            models.Department.campus_id == campus_id,
        ).first()
        if code_match:
            raise HTTPException(status_code=400, detail="A department with this code already exists in this campus.")

    campus = db.query(models.Campus).filter(models.Campus.id == campus_id).first()
    if not campus:
        raise HTTPException(status_code=404, detail="Campus not found.")
    if not campus.is_active:
        raise HTTPException(status_code=400, detail="Cannot add academic data to an inactive campus.")
    assert_campus_access(admin, campus.id)

    new_department = models.Department(
        name=normalized_name,
        code=normalized_code,
        campus_id=campus_id,
        dean_name=(payload.dean_name or "").strip() or None,
    )
    db.add(new_department)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="A department with this name or code already exists in this campus.")
    db.refresh(new_department)
    log_activity(db, "Department Created", f"Admin {admin.id} created department '{new_department.name}'.", "academic", user_id=admin.id)

    return {
        "id": new_department.id,
        "name": new_department.name,
        "code": new_department.code,
        "campus_id": new_department.campus_id,
        "dean_name": new_department.dean_name,
    }


# Backwards-compatible endpoints without the '/api' prefix (some clients call these paths)
@app.get("/departments")
def get_departments_noapi(db: Session = Depends(get_db), current_user: models.User | None = Depends(get_optional_current_user)):
    return get_departments(db, current_user)


@app.post("/departments", status_code=201)
def create_department_noapi(payload: DepartmentCreateRequest, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    return create_department(payload, db, admin)


@app.put("/departments/{department_id}")
def update_department_noapi(department_id: int, payload: DepartmentUpdateRequest, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    return update_department(department_id, payload, db, admin)


@app.delete("/departments/{department_id}")
def delete_department_noapi(department_id: int, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    return delete_department(department_id, db, admin)


@app.put("/api/departments/{department_id}")
def update_department(department_id: int, payload: DepartmentUpdateRequest, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    department = db.query(models.Department).filter(models.Department.id == department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found.")
    assert_campus_access(admin, department.campus_id)

    normalized_name = payload.name.strip()
    normalized_code = payload.code.strip() if payload.code else None

    target_campus_id = payload.campus_id if payload.campus_id is not None else department.campus_id
    duplicate_name = db.query(models.Department).filter(
        func.lower(models.Department.name) == normalized_name.lower(),
        models.Department.id != department_id,
        models.Department.campus_id == target_campus_id,
    ).first()
    if duplicate_name:
        raise HTTPException(status_code=400, detail="A department with this name already exists in this campus.")

    if normalized_code:
        duplicate_code = db.query(models.Department).filter(
            func.lower(models.Department.code) == normalized_code.lower(),
            models.Department.id != department_id,
            models.Department.campus_id == target_campus_id,
        ).first()
        if duplicate_code:
            raise HTTPException(status_code=400, detail="A department with this code already exists in this campus.")

    if target_campus_id is None:
        raise HTTPException(status_code=400, detail="Select a campus for this department.")
    target_campus = db.query(models.Campus).filter(models.Campus.id == target_campus_id).first()
    if not target_campus:
        raise HTTPException(status_code=404, detail="Campus not found.")
    assert_campus_access(admin, target_campus.id)

    department.name = normalized_name
    department.code = normalized_code
    department.campus_id = target_campus_id
    if payload.dean_name is not None and payload.dean_name.strip() != (department.dean_name or ""):
        department.dean_name = payload.dean_name.strip() or None
        department.dean_id = None
    db.commit()
    db.refresh(department)
    log_activity(db, "Department Updated", f"Admin {admin.id} updated department '{department.name}'.", "academic", user_id=admin.id)

    return {
        "id": department.id,
        "name": department.name,
        "code": department.code,
        "campus_id": department.campus_id,
        "dean_name": department.dean_name,
    }


@app.delete("/api/departments/{department_id}")
def delete_department(department_id: int, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    department = db.query(models.Department).filter(models.Department.id == department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found.")
    assert_campus_access(admin, department.campus_id)

    db.query(models.Subject).filter(models.Subject.department_id == department_id).update({"department_id": None})
    db.delete(department)
    db.commit()
    log_activity(db, "Department Deleted", f"Admin {admin.id} deleted department '{department.name}'.", "academic", user_id=admin.id)
    return {"message": "Department deleted successfully."}


# --- NEW ROUTE: MANUAL SUBJECT CREATION ---
def _subject_name_conflict(db, name: str, department_id: int | None, program_id: int | None, exclude_id: int | None = None):
    query = db.query(models.Subject).filter(
        func.lower(models.Subject.name) == name.strip().lower(),
        models.Subject.archived.is_(False),
    )
    if program_id is not None:
        query = query.filter(models.Subject.program_id == program_id)
    elif department_id is not None:
        query = query.filter(
            models.Subject.program_id.is_(None),
            models.Subject.department_id == department_id,
        )
    else:
        query = query.filter(
            models.Subject.program_id.is_(None),
            models.Subject.department_id.is_(None),
        )
    if exclude_id is not None:
        query = query.filter(models.Subject.id != exclude_id)
    return query.first()


@app.post("/api/subjects", status_code=201)
def create_subject_manually(payload: SubjectCreateRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if payload.department_id is not None:
        department = db.query(models.Department).filter(models.Department.id == payload.department_id).first()
        if not department:
            raise HTTPException(status_code=404, detail="Department not found.")
        department_id = department.id
    else:
        department_id = None

    if payload.program_id is not None:
        program = db.query(models.Program).filter(models.Program.id == payload.program_id).first()
        if not program:
            raise HTTPException(status_code=404, detail="Program not found.")
        if department_id is not None and program.department_id != department_id:
            raise HTTPException(status_code=400, detail="Program does not belong to the selected department.")
        department_id = program.department_id

    if _subject_name_conflict(db, payload.name, department_id, payload.program_id):
        raise HTTPException(status_code=400, detail="A subject with this name already exists in the selected program or department.")

    role = str(current_user.role).lower()
    if role in {"faculty", "student"}:
        if department_id is not None:
            department = db.query(models.Department).filter(models.Department.id == department_id).first()
            faculty_campus_id = user_campus_id(db, current_user)
            if not faculty_campus_id or department.campus_id != faculty_campus_id:
                raise HTTPException(status_code=403, detail="You can only create subjects within your assigned campus.")
        subject_owner_id = current_user.id
    elif role in {"campus_admin", "super_admin"}:
        if department_id is None:
            raise HTTPException(status_code=400, detail="Select a program or department for an administrative subject.")
        department = db.query(models.Department).filter(models.Department.id == department_id).first()
        assert_campus_access(current_user, department.campus_id)
        subject_owner_id = payload.user_id if role == "super_admin" else None
    else:
        raise HTTPException(status_code=403, detail="Subject management is not available for this role.")
        
    new_subject = models.Subject(
        name=payload.name.strip(),
        code=payload.code.strip() if payload.code else None,
        description="Manually added subject area.",
        department_id=department_id,
        program_id=payload.program_id,
        user_id=subject_owner_id,
    )
    db.add(new_subject)
    db.commit()
    db.refresh(new_subject)
    log_activity(db, "Subject Created", f"User {current_user.id} created subject '{new_subject.name}'.", "academic", user_id=current_user.id)
    
    return {
        "id": new_subject.id,
        "name": new_subject.name,
        "code": new_subject.code,
        "department_id": new_subject.department_id,
        "program_id": new_subject.program_id,
        "message": "Subject registered successfully!"
    }

@app.put("/api/subjects/{subject_id}")
def update_subject(subject_id: int, payload: SubjectCreateRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    subject = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")
    role = str(current_user.role).lower()
    if role in {"faculty", "student"}:
        if subject.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="You can only edit your own subjects.")
    elif role in {"campus_admin", "super_admin"}:
        old_department = db.query(models.Department).filter(models.Department.id == subject.department_id).first()
        assert_campus_access(current_user, old_department.campus_id if old_department else None)
    else:
        raise HTTPException(status_code=403, detail="Subject management is not available for this role.")

    normalized_name = payload.name.strip()
    normalized_code = payload.code.strip() if payload.code else None

    if payload.department_id is not None:
        dept = db.query(models.Department).filter(models.Department.id == payload.department_id).first()
        if not dept:
            raise HTTPException(status_code=404, detail="Department not found.")
        subject.department_id = dept.id
    else:
        subject.department_id = None

    if payload.program_id is not None:
        program = db.query(models.Program).filter(models.Program.id == payload.program_id).first()
        if not program:
            raise HTTPException(status_code=404, detail="Program not found.")
        if subject.department_id is not None and program.department_id != subject.department_id:
            raise HTTPException(status_code=400, detail="Program does not belong to the selected department.")
        subject.program_id = program.id
        subject.department_id = program.department_id
        parent_department = db.query(models.Department).filter(models.Department.id == program.department_id).first()
        if role in {"campus_admin", "super_admin"}:
            assert_campus_access(current_user, parent_department.campus_id if parent_department else None)
        elif role in {"faculty", "student"}:
            if user_campus_id(db, current_user) != (parent_department.campus_id if parent_department else None):
                raise HTTPException(status_code=403, detail="You can only assign subjects within your assigned campus.")
    else:
        subject.program_id = None

    if subject.department_id is not None:
        target_department = db.query(models.Department).filter(models.Department.id == subject.department_id).first()
        if role in {"campus_admin", "super_admin"}:
            assert_campus_access(current_user, target_department.campus_id if target_department else None)
        elif role in {"faculty", "student"}:
            if not target_department or user_campus_id(db, current_user) != target_department.campus_id:
                raise HTTPException(status_code=403, detail="You can only assign subjects within your assigned campus.")

    if _subject_name_conflict(
        db,
        normalized_name,
        subject.department_id,
        subject.program_id,
        exclude_id=subject_id,
    ):
        raise HTTPException(status_code=400, detail="A subject with this name already exists in the selected program or department.")

    subject.name = normalized_name
    subject.code = normalized_code
    db.commit()
    db.refresh(subject)
    log_activity(db, "Subject Updated", f"User {current_user.id} updated subject '{subject.name}'.", "academic", user_id=current_user.id)

    return {
        "id": subject.id,
        "name": subject.name,
        "code": subject.code,
        "department_id": subject.department_id,
        "program_id": subject.program_id,
    }


@app.delete("/api/subjects/{subject_id}")
def delete_subject(subject_id: int, user_id: int = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    subject = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")
    role = str(current_user.role).lower()
    if role in {"faculty", "student"}:
        assert_subject_access(db, current_user, subject)
        hidden_subject = db.query(models.UserHiddenSubject).filter(
            models.UserHiddenSubject.user_id == current_user.id,
            models.UserHiddenSubject.subject_id == subject.id,
        ).first()
        if not hidden_subject:
            db.add(models.UserHiddenSubject(user_id=current_user.id, subject_id=subject.id))
        db.commit()
        log_activity(db, "Subject Removed", f"User {current_user.id} removed subject '{subject.name}' from their Question Bank.", "academic", user_id=current_user.id)
        return {"message": "Subject removed from your Question Bank."}
    elif role in {"campus_admin", "super_admin"}:
        department = db.query(models.Department).filter(models.Department.id == subject.department_id).first()
        assert_campus_access(current_user, department.campus_id if department else None)
    else:
        raise HTTPException(status_code=403, detail="Subject management is not available for this role.")
    subject.archived = True
    db.commit()
    log_activity(db, "Subject Deleted", f"Deleted subject '{subject.name}'.", "academic", user_id=current_user.id)
    return {"message": "Subject deleted successfully."}

@app.delete("/api/recycle-bin/subjects/{subject_id}")
def permanently_delete_subject(subject_id: int, user_id: int = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    subject = db.query(models.Subject).filter(
        models.Subject.id == subject_id,
        models.Subject.archived.is_(True),
    ).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Archived subject not found.")
    assert_subject_access(db, current_user, subject)
    subject_name = subject.name

    question_ids = [question_id for (question_id,) in db.query(models.GeneratedQuestion.id).filter(
        models.GeneratedQuestion.subject_id == subject_id,
    ).all()]
    if question_ids:
        db.query(models.QuestionVersion).filter(models.QuestionVersion.question_id.in_(question_ids)).delete(synchronize_session=False)
        db.query(models.QuestionSetItem).filter(models.QuestionSetItem.question_id.in_(question_ids)).delete(synchronize_session=False)
        db.query(models.GeneratedQuestion).filter(models.GeneratedQuestion.id.in_(question_ids)).delete(synchronize_session=False)

    question_set_ids = [question_set_id for (question_set_id,) in db.query(models.QuestionSet.id).filter(
        models.QuestionSet.subject_id == subject_id,
    ).all()]
    if question_set_ids:
        db.query(models.QuestionSetExport).filter(models.QuestionSetExport.question_set_id.in_(question_set_ids)).delete(synchronize_session=False)
        db.query(models.QuestionSetItem).filter(models.QuestionSetItem.question_set_id.in_(question_set_ids)).delete(synchronize_session=False)
        db.query(models.QuestionSet).filter(models.QuestionSet.id.in_(question_set_ids)).delete(synchronize_session=False)

    upload_ids = [upload_id for (upload_id,) in db.query(models.UploadedFile.id).filter(
        models.UploadedFile.subject_id == subject_id,
    ).all()]
    if upload_ids:
        db.query(models.TableOfSpecification).filter(models.TableOfSpecification.upload_id.in_(upload_ids)).delete(synchronize_session=False)
        db.query(models.UploadedFile).filter(models.UploadedFile.id.in_(upload_ids)).delete(synchronize_session=False)

    db.query(models.UserHiddenSubject).filter(
        models.UserHiddenSubject.subject_id == subject_id,
    ).delete(synchronize_session=False)
    db.delete(subject)
    db.commit()
    log_activity(db, "Subject Permanently Deleted", f"Permanently deleted subject '{subject_name}'.", "delete", user_id=current_user.id)
    return {"message": "Subject permanently deleted."}

@app.get("/api/recycle-bin/subjects")
def get_archived_subjects(user_id: int = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.Subject).filter(models.Subject.archived.is_(True))
    visible_subject_ids = accessible_subject_ids(db, current_user, include_archived=True)
    if visible_subject_ids is not None:
        query = query.filter(models.Subject.id.in_(visible_subject_ids))
    return query.order_by(models.Subject.created_at.desc()).all()

@app.get("/api/recycle-bin")
def get_recycle_bin(user_id: int = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    subjects = get_archived_subjects(user_id=user_id, db=db, current_user=current_user)
    question_query = db.query(models.GeneratedQuestion).filter(models.GeneratedQuestion.archived.is_(True))
    question_rows = question_query.order_by(models.GeneratedQuestion.created_at.desc()).all()
    questions = []
    for question in question_rows:
        try:
            assert_question_access(db, current_user, question)
            questions.append(question)
        except HTTPException:
            continue
    download_query = db.query(models.ActivityLog).filter(
        models.ActivityLog.type == "download",
        models.ActivityLog.archived.is_(True),
    )
    download_query = download_query.filter(models.ActivityLog.user_id == current_user.id)
    downloads = download_query.order_by(models.ActivityLog.created_at.desc()).all()
    subject_names = dict(db.query(models.Subject.id, models.Subject.name).all())
    return {
        "subjects": subjects,
        "questions": [
            {**serialize_question(question), "subject_name": subject_names.get(question.subject_id, "Unassigned subject")}
            for question in questions
        ],
        "downloads": [
            {
                "id": download.id,
                "action": download.action,
                "details": download.details,
                "date": download.created_at.isoformat() if download.created_at else None,
                "type": download.type,
                "filename": download.filename,
                "media_type": download.media_type,
            }
            for download in downloads
        ],
    }

@app.post("/api/recycle-bin/subjects/{subject_id}/restore")
def restore_subject(subject_id: int, user_id: int = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    subject = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")
    role = str(current_user.role).lower()
    if role in {"faculty", "student"}:
        hidden_subject = db.query(models.UserHiddenSubject).filter(
            models.UserHiddenSubject.user_id == current_user.id,
            models.UserHiddenSubject.subject_id == subject.id,
        ).first()
        if subject.archived or not hidden_subject:
            raise HTTPException(status_code=404, detail="Removed subject not found.")
        db.delete(hidden_subject)
        db.commit()
        db.refresh(subject)
        log_activity(db, "Subject Restored", f"User {current_user.id} restored subject '{subject.name}' to their Question Bank.", "academic", user_id=current_user.id)
        return subject
    if not subject.archived:
        raise HTTPException(status_code=404, detail="Archived subject not found.")
    assert_subject_access(db, current_user, subject)
    subject.archived = False
    db.commit()
    db.refresh(subject)
    log_activity(db, "Subject Restored", f"Restored subject '{subject.name}'.", "academic")
    return subject

@app.post("/api/recycle-bin/questions/{question_id}/restore")
def restore_archived_question(question_id: int, user_id: int = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.GeneratedQuestion).filter(
        models.GeneratedQuestion.id == question_id,
        models.GeneratedQuestion.archived.is_(True),
    )
    question = query.first()
    if not question:
        raise HTTPException(status_code=404, detail="Archived question not found.")
    assert_question_access(db, current_user, question)
    question.archived = False
    db.commit()
    log_activity(db, "Question Restored", f"Restored question #{question_id}.", "academic")
    return {"message": "Question restored successfully."}

@app.post("/api/recycle-bin/downloads/{activity_id}/restore")
def restore_archived_download(activity_id: int, user_id: int = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.ActivityLog).filter(
        models.ActivityLog.id == activity_id,
        models.ActivityLog.type == "download",
        models.ActivityLog.archived.is_(True),
    )
    query = query.filter(models.ActivityLog.user_id == current_user.id)
    download = query.first()
    if not download:
        raise HTTPException(status_code=404, detail="Archived download not found.")
    download.archived = False
    db.commit()
    return {"message": "Download restored successfully."}

# --- NEW ROUTE: SINGLE QUESTION MANUAL CLASSIFICATION ---
@app.post("/api/questions/manual", status_code=201)
def classify_and_save_manual_question(payload: ManualQuestionRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    subject = db.query(models.Subject).filter(models.Subject.id == payload.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject context not found.")
    role = str(current_user.role).lower()
    if role == "campus_admin":
        campus_id = question_campus_id(db, models.GeneratedQuestion(subject_id=subject.id, user_id=subject.user_id))
        if campus_id is None:
            department = db.query(models.Department).filter(models.Department.id == subject.department_id).first() if subject.department_id else None
            campus_id = department.campus_id if department else None
        if campus_id is None:
            raise HTTPException(status_code=404, detail="Subject not found.")
        assert_campus_access(current_user, campus_id)
    elif role == "super_admin":
        pass
    elif role in {"faculty", "student"}:
        department = db.query(models.Department).filter(models.Department.id == subject.department_id).first() if subject.department_id else None
        if subject.program_id:
            department = db.query(models.Department).join(
                models.Program, models.Program.department_id == models.Department.id
            ).filter(models.Program.id == subject.program_id).first()
        actor_campus_id = user_campus_id(db, current_user)
        if (department and department.campus_id != actor_campus_id) or (not department and subject.user_id != current_user.id):
            raise HTTPException(status_code=404, detail="Subject context not found.")
    else:
        raise HTTPException(status_code=403, detail="Question creation is not available for this role.")

    normalized_question = " ".join(payload.question.split())
    duplicate_check = db.query(models.GeneratedQuestion).filter(
        models.GeneratedQuestion.subject_id == payload.subject_id,
        models.GeneratedQuestion.archived.is_(False),
        func.lower(models.GeneratedQuestion.question) == normalized_question.lower(),
    ).first()
    if duplicate_check:
        raise HTTPException(status_code=400, detail="This identical question text already exists inside this subject pool.")

    # AI classifier assigns the Bloom level for manually entered questions too.
    request_started_at = time.perf_counter()
    usage_id = questions.start_ai_usage(
        db,
        current_user,
        "bloom_classification",
        campus_id=subject_campus_id(db, subject),
    )
    usage_tracker = GeminiUsageTracker()
    bloom_level = classify_question(normalized_question, usage_tracker=usage_tracker)
    questions.finish_ai_usage(
        db,
        usage_id,
        usage_tracker,
        "failed" if usage_tracker.failure_count else "success",
        request_started_at,
        usage_tracker.last_error_type,
    )

    new_question = models.GeneratedQuestion(
        subject_id=payload.subject_id,
        user_id=current_user.id,
        bloom_level=bloom_level,
        question_type=payload.question_type,
        points=payload.points,
        question=normalized_question,
        options=payload.options,
        correct_answer=payload.correct_answer,
        explanation="Added manually."
    )
    db.add(new_question)
    db.commit()
    db.refresh(new_question)

    log_activity(db, "Classified Question", f"Manual Input: '{normalized_question[:60]}' → Categorized as {bloom_level}.", "classify", user_id=current_user.id)

    return {
        "id": new_question.id,
        "bloom_level": bloom_level,
        "message": f"Question saved in the Question Bank under {bloom_level}."
    }

@app.get("/api/faculty/subjects")
def get_faculty_program_subjects(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if str(current_user.role).lower() != "faculty":
        raise HTTPException(status_code=403, detail="Faculty subject search is not available for this role.")
    if not current_user.program_id:
        return []

    program = db.query(models.Program).filter(models.Program.id == current_user.program_id).first()
    department = db.query(models.Department).filter(
        models.Department.id == program.department_id
    ).first() if program else None
    if not program or not department:
        return []
    if current_user.department and current_user.department.strip().casefold() != department.name.strip().casefold():
        return []
    faculty_campus_id = user_campus_id(db, current_user)
    if faculty_campus_id is not None and department.campus_id != faculty_campus_id:
        return []

    subjects = db.query(models.Subject).filter(
        models.Subject.archived.is_(False),
        models.Subject.program_id == program.id,
        models.Subject.department_id == department.id,
        models.Subject.code.is_not(None),
        func.trim(models.Subject.code) != "",
    ).order_by(models.Subject.code.asc(), models.Subject.name.asc()).all()
    return [
        {
            "id": subject.id,
            "code": subject.code,
            "name": subject.name,
            "department_id": department.id,
            "department_name": department.name,
            "program_id": program.id,
            "program_name": program.name,
        }
        for subject in subjects
    ]


@app.get("/api/subjects")
def get_subjects(
    user_id: int = None,
    program_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Subject).filter(models.Subject.archived.is_(False))
    role = str(current_user.role).lower()
    scoped_user_id = None
    scoped_subject_ids = None
    scoped_program_faculty_ids = None
    if role in {"faculty", "student"}:
        hidden_subject_ids = db.query(models.UserHiddenSubject.subject_id).filter(
            models.UserHiddenSubject.user_id == current_user.id,
        )
        query = query.filter(~models.Subject.id.in_(hidden_subject_ids))
    if role == "campus_admin":
        campus_id = visible_campus_id(current_user)
        department_ids = [row[0] for row in db.query(models.Department.id).filter(models.Department.campus_id == campus_id).all()]
        program_ids = [row[0] for row in db.query(models.Program.id).filter(models.Program.department_id.in_(department_ids)).all()] if department_ids else []
        if program_id is not None:
            target_program = db.query(models.Program).filter(models.Program.id == program_id).first()
            if target_program and target_program.department_id in department_ids:
                scoped_program_faculty_ids, program_subject_ids = program_subject_scope(db, program_id)
                query = query.filter(
                    models.Subject.id.in_(program_subject_ids),
                    models.Subject.program_id == program_id,
                )
            else:
                raise HTTPException(status_code=404, detail="Program not found in this campus.")
        else:
            query = query.filter(or_(models.Subject.department_id.in_(department_ids), models.Subject.program_id.in_(program_ids)))
        scoped_subject_ids = [row[0] for row in query.with_entities(models.Subject.id).all()]
    elif role == "super_admin" and program_id is not None:
        if not db.query(models.Program.id).filter(models.Program.id == program_id).first():
            raise HTTPException(status_code=404, detail="Program not found.")
        scoped_program_faculty_ids, program_subject_ids = program_subject_scope(db, program_id)
        query = query.filter(
            models.Subject.id.in_(program_subject_ids),
            models.Subject.program_id == program_id,
        )
        scoped_subject_ids = [row[0] for row in query.with_entities(models.Subject.id).all()]
    elif role not in {"super_admin"} and (role not in {"faculty", "student"} or user_id is not None):
        scoped_user_id = current_user.id
        query = query.outerjoin(
            models.UploadedFile,
            models.UploadedFile.subject_id == models.Subject.id,
        ).outerjoin(
            models.GeneratedQuestion,
            models.GeneratedQuestion.subject_id == models.Subject.id,
        ).filter(
            (models.Subject.user_id == scoped_user_id)
            | (models.UploadedFile.user_id == scoped_user_id)
            | (models.GeneratedQuestion.user_id == scoped_user_id)
        ).distinct()
    subjects = query.all()
    question_count_query = db.query(
        models.GeneratedQuestion.subject_id,
        func.count(func.distinct(models.GeneratedQuestion.id)),
    ).filter(models.GeneratedQuestion.archived.is_(False))
    question_count_query = question_count_query.outerjoin(
        models.Subject,
        models.Subject.id == models.GeneratedQuestion.subject_id,
    ).filter(
        or_(
            models.GeneratedQuestion.subject_id.is_(None),
            models.Subject.archived.is_(False),
        )
    )
    if role in {"campus_admin", "super_admin"}:
        if scoped_subject_ids is not None:
            if scoped_subject_ids:
                question_count_query = question_count_query.filter(models.GeneratedQuestion.subject_id.in_(scoped_subject_ids))
            else:
                question_count_query = question_count_query.filter(models.GeneratedQuestion.id == -1)
        if program_id is not None:
            question_count_query = question_count_query.outerjoin(
                models.TableOfSpecification,
                models.TableOfSpecification.id == models.GeneratedQuestion.tos_id,
            ).outerjoin(
                models.UploadedFile,
                models.UploadedFile.id == models.TableOfSpecification.upload_id,
            ).filter(or_(
                models.GeneratedQuestion.user_id.in_(scoped_program_faculty_ids or []),
                and_(
                    models.GeneratedQuestion.user_id.is_(None),
                    or_(
                        models.UploadedFile.user_id.in_(scoped_program_faculty_ids or []),
                        models.Subject.user_id.in_(scoped_program_faculty_ids or []),
                    ),
                ),
            ))
    elif scoped_user_id:
        question_count_query = question_count_query.outerjoin(
            models.TableOfSpecification,
            models.TableOfSpecification.id == models.GeneratedQuestion.tos_id,
        ).outerjoin(
            models.UploadedFile,
            models.UploadedFile.id == models.TableOfSpecification.upload_id,
        ).filter(
            (models.GeneratedQuestion.user_id == scoped_user_id)
            | (models.UploadedFile.user_id == scoped_user_id)
            | (models.Subject.user_id == scoped_user_id)
        )
    question_counts = dict(
        question_count_query.group_by(models.GeneratedQuestion.subject_id).all()
    )
    departments = {department.id: department.name for department in db.query(models.Department).all()}
    faculty = {user.id: (user.name or user.email) for user in db.query(models.User).filter(models.User.role.ilike("faculty")).all()}
    return [
        {
            "id": subject.id,
            "name": subject.name,
            "code": subject.code,
            "description": subject.description,
            "department_id": subject.department_id,
            "department_name": departments.get(subject.department_id, "Unassigned department"),
            "program_id": subject.program_id,
            "faculty_name": faculty.get(subject.user_id, "System or unassigned"),
            "creator_id": subject.user_id,
            "created_at": subject.created_at,
            "archived": subject.archived,
            "question_count": question_counts.get(subject.id, 0),
        }
        for subject in subjects
    ]

# Backwards-compatible subject endpoints without the '/api' prefix
@app.get("/subjects")
def get_subjects_noapi(user_id: int = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return get_subjects(user_id=user_id, db=db, current_user=current_user)


@app.post("/subjects", status_code=201)
def create_subject_noapi(payload: SubjectCreateRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return create_subject_manually(payload, db, current_user)


@app.put("/subjects/{subject_id}")
def update_subject_noapi(subject_id: int, payload: SubjectCreateRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return update_subject(subject_id, payload, db, current_user)


@app.delete("/subjects/{subject_id}")
def delete_subject_noapi(subject_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return delete_subject(subject_id, db=db, current_user=current_user)


@app.get("/api/questions")
def get_questions(
    subject_id: int = None,
    bloom_level: str = None,
    user_id: int = None,
    program_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.GeneratedQuestion).outerjoin(
        models.Subject,
        models.Subject.id == models.GeneratedQuestion.subject_id,
    ).filter(
        models.GeneratedQuestion.archived.is_(False),
        or_(
            models.GeneratedQuestion.subject_id.is_(None),
            models.Subject.archived.is_(False),
        ),
    )
    role = str(current_user.role).lower()
    if role in {"faculty", "student"}:
        hidden_subject_ids = db.query(models.UserHiddenSubject.subject_id).filter(
            models.UserHiddenSubject.user_id == current_user.id,
        )
        query = query.filter(or_(
            models.GeneratedQuestion.subject_id.is_(None),
            ~models.GeneratedQuestion.subject_id.in_(hidden_subject_ids),
        ))
    if role in {"campus_admin", "super_admin"} and program_id is not None:
        target_program = db.query(models.Program).filter(models.Program.id == program_id).first()
        if not target_program:
            raise HTTPException(status_code=404, detail="Program not found.")
        if role == "campus_admin":
            campus_id = visible_campus_id(current_user)
            department_ids = [row[0] for row in db.query(models.Department.id).filter(models.Department.campus_id == campus_id).all()]
            if target_program.department_id not in department_ids:
                raise HTTPException(status_code=404, detail="Program not found in this campus.")
        member_ids, subject_ids = program_subject_scope(db, program_id)
        query = query.outerjoin(
            models.TableOfSpecification,
            models.TableOfSpecification.id == models.GeneratedQuestion.tos_id,
        ).outerjoin(
            models.UploadedFile,
            models.UploadedFile.id == models.TableOfSpecification.upload_id,
        ).filter(
            models.GeneratedQuestion.subject_id.in_(subject_ids),
            or_(
                models.GeneratedQuestion.user_id.in_(member_ids),
                and_(
                    models.GeneratedQuestion.user_id.is_(None),
                    or_(
                        models.UploadedFile.user_id.in_(member_ids),
                        models.Subject.user_id.in_(member_ids),
                    ),
                ),
            ),
        )
    elif role == "campus_admin":
        campus_id = visible_campus_id(current_user)
        department_ids = [row[0] for row in db.query(models.Department.id).filter(models.Department.campus_id == campus_id).all()]
        subject_ids = [row[0] for row in db.query(models.Subject.id).filter(
            or_(models.Subject.department_id.in_(department_ids), models.Subject.program_id.in_(
                db.query(models.Program.id).filter(models.Program.department_id.in_(department_ids))
            ))
        ).all()] if department_ids else []
        program_ids = [row[0] for row in db.query(models.Program.id).filter(models.Program.department_id.in_(department_ids)).all()] if department_ids else []
        member_ids = [row[0] for row in db.query(models.User.id).filter(models.User.program_id.in_(program_ids)).all()] if program_ids else []
        query = query.outerjoin(
            models.TableOfSpecification,
            models.TableOfSpecification.id == models.GeneratedQuestion.tos_id,
        ).outerjoin(
            models.UploadedFile,
            models.UploadedFile.id == models.TableOfSpecification.upload_id,
        ).filter(or_(
            models.GeneratedQuestion.subject_id.in_(subject_ids),
            models.GeneratedQuestion.user_id.in_(member_ids),
            models.UploadedFile.user_id.in_(member_ids),
        ))
    elif role != "super_admin":
        scoped_user_id = current_user.id
        query = query.outerjoin(
            models.TableOfSpecification,
            models.TableOfSpecification.id == models.GeneratedQuestion.tos_id,
        ).outerjoin(
            models.UploadedFile,
            models.UploadedFile.id == models.TableOfSpecification.upload_id,
        ).filter(or_(
            models.GeneratedQuestion.user_id == scoped_user_id,
            models.UploadedFile.user_id == scoped_user_id,
            models.Subject.user_id == scoped_user_id,
        ))
    if subject_id:
        query = query.filter(models.GeneratedQuestion.subject_id == subject_id)
    if bloom_level:
        query = query.filter(models.GeneratedQuestion.bloom_level == bloom_level)
    questions = query.all()
    if role != "super_admin":
        visible_questions = []
        for question in questions:
            try:
                assert_question_access(db, current_user, question)
                visible_questions.append(question)
            except HTTPException:
                continue
        questions = visible_questions
    creator_ids = {question.user_id for question in questions if question.user_id}
    creators = {
        user.id: {"name": user.name or user.email, "email": user.email}
        for user in db.query(models.User).filter(models.User.id.in_(creator_ids)).all()
    } if creator_ids else {}
    serialized = []
    for question in questions:
        item = serialize_question(question)
        creator = creators.get(question.user_id)
        item["creator_name"] = creator["name"] if creator else "System or unassigned"
        item["creator_email"] = creator["email"] if creator else None
        serialized.append(item)
    return serialized


def serialize_question_set(question_set, db: Session | None = None, actor: models.User | None = None):
    visible_items = []
    for item in question_set.items:
        if not item.question:
            continue
        if db is not None and actor is not None:
            try:
                assert_question_access(db, actor, item.question)
            except HTTPException:
                continue
        visible_items.append(item)
    set_questions = [item.question for item in visible_items]
    def count_values(key, fallback):
        counts = {}
        for question in set_questions:
            value = str(getattr(question, key, None) or fallback)
            counts[value] = counts.get(value, 0) + 1
        return counts
    return {
        "id": question_set.id,
        "name": question_set.name,
        "subject_id": question_set.subject_id,
        "subject_name": question_set.subject.name if question_set.subject else "",
        "status": question_set.status,
        "question_ids": [item.question_id for item in visible_items],
        "question_count": len(visible_items),
        "created_at": question_set.created_at.isoformat() if question_set.created_at else None,
        "updated_at": question_set.updated_at.isoformat() if question_set.updated_at else None,
        "exam_title": question_set.exam_title,
        "instructions": question_set.instructions,
        "total_points": question_set.total_points,
        "time_limit": question_set.time_limit,
        "instructor_name": question_set.instructor_name,
        "department": question_set.department,
        "export_history": [{"id": item.id, "format": item.export_format, "filename": item.filename, "created_at": item.created_at.isoformat() if item.created_at else None} for item in question_set.exports],
        "statistics": {
            "bloom": count_values("bloom_level", "Unknown"),
            "difficulty": count_values("difficulty", "moderate"),
            "types": count_values("question_type", "Unknown"),
            "topics": count_values("topic_name", "Unknown"),
        },
    }


@app.get("/api/question-sets")
def get_question_sets(subject_id: int | None = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.QuestionSet).order_by(models.QuestionSet.updated_at.desc(), models.QuestionSet.created_at.desc())
    visible_subject_ids = accessible_subject_ids(db, current_user)
    if visible_subject_ids is not None:
        query = query.filter(models.QuestionSet.subject_id.in_(visible_subject_ids))
    if subject_id:
        subject = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        assert_subject_access(db, current_user, subject)
        query = query.filter(models.QuestionSet.subject_id == subject_id)
    return [serialize_question_set(question_set, db, current_user) for question_set in query.all()]


@app.post("/api/question-sets", status_code=201)
def create_question_set(payload: QuestionSetCreateRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    subject = db.query(models.Subject).filter(models.Subject.id == payload.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    assert_subject_access(db, current_user, subject)
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Question set name is required")
    question_set = models.QuestionSet(
        name=name,
        subject_id=subject.id,
        exam_title=payload.exam_title or name,
        instructions=payload.instructions,
        total_points=payload.total_points,
        time_limit=payload.time_limit,
        instructor_name=payload.instructor_name,
        department=payload.department,
    )
    db.add(question_set)
    db.commit()
    db.refresh(question_set)
    log_activity(db, "Created Question Set", f"Created '{name}' for {subject.name}.", "question_set")
    return serialize_question_set(question_set, db, current_user)


@app.put("/api/question-sets/{set_id}")
def update_question_set(set_id: int, payload: QuestionSetUpdateRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    question_set = db.query(models.QuestionSet).filter(models.QuestionSet.id == set_id).first()
    if not question_set:
        raise HTTPException(status_code=404, detail="Question set not found")
    assert_subject_access(db, current_user, question_set.subject)
    if payload.name is not None:
        if not payload.name.strip():
            raise HTTPException(status_code=400, detail="Question set name is required")
        question_set.name = payload.name.strip()
    if payload.status is not None:
        if payload.status not in {"draft", "ready", "exported"}:
            raise HTTPException(status_code=400, detail="Invalid question set status")
        question_set.status = payload.status
    for field in ("exam_title", "instructions", "total_points", "time_limit", "instructor_name", "department"):
        value = getattr(payload, field)
        if value is not None:
            setattr(question_set, field, value)
    db.commit()
    db.refresh(question_set)
    log_activity(db, "Question Set Updated", f"Updated '{question_set.name}' status to {question_set.status}.", "question_set")
    return serialize_question_set(question_set, db, current_user)


@app.put("/api/question-sets/{set_id}/items")
def update_question_set_items(set_id: int, payload: QuestionSetItemsRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    question_set = db.query(models.QuestionSet).filter(models.QuestionSet.id == set_id).first()
    if not question_set:
        raise HTTPException(status_code=404, detail="Question set not found")
    assert_subject_access(db, current_user, question_set.subject)
    unique_ids = list(dict.fromkeys(payload.question_ids))
    questions = db.query(models.GeneratedQuestion).filter(
        models.GeneratedQuestion.id.in_(unique_ids),
        models.GeneratedQuestion.subject_id == question_set.subject_id,
    ).all() if unique_ids else []
    valid_ids = {question.id for question in questions}
    if len(valid_ids) != len(unique_ids):
        raise HTTPException(status_code=400, detail="Every selected question must belong to the set subject")
    for question in questions:
        assert_question_access(db, current_user, question)
    db.query(models.QuestionSetItem).filter(models.QuestionSetItem.question_set_id == set_id).delete(synchronize_session=False)
    for position, question_id in enumerate(unique_ids):
        db.add(models.QuestionSetItem(question_set_id=set_id, question_id=question_id, position=position))
    question_set.status = "ready" if unique_ids else "draft"
    db.commit()
    db.refresh(question_set)
    log_activity(db, "Question Set Selection Saved", f"Saved {len(unique_ids)} question(s) in '{question_set.name}'.", "question_set")
    return serialize_question_set(question_set, db, current_user)


@app.post("/api/question-sets/{set_id}/duplicate", status_code=201)
def duplicate_question_set(set_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    source = db.query(models.QuestionSet).filter(models.QuestionSet.id == set_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Question set not found")
    assert_subject_access(db, current_user, source.subject)
    for item in source.items:
        if item.question:
            assert_question_access(db, current_user, item.question)
    duplicate = models.QuestionSet(
        name=f"{source.name} Copy",
        subject_id=source.subject_id,
        status="draft",
    )
    db.add(duplicate)
    db.flush()
    for item in source.items:
        db.add(models.QuestionSetItem(question_set_id=duplicate.id, question_id=item.question_id, position=item.position))
    duplicate.status = "ready" if source.items else "draft"
    db.commit()
    db.refresh(duplicate)
    log_activity(db, "Question Set Duplicated", f"Duplicated '{source.name}' as '{duplicate.name}'.", "question_set")
    return serialize_question_set(duplicate, db, current_user)


@app.delete("/api/question-sets/{set_id}")
def delete_question_set(set_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    question_set = db.query(models.QuestionSet).filter(models.QuestionSet.id == set_id).first()
    if not question_set:
        raise HTTPException(status_code=404, detail="Question set not found")
    assert_subject_access(db, current_user, question_set.subject)
    set_name = question_set.name
    db.delete(question_set)
    db.commit()
    log_activity(db, "Question Set Deleted", f"Deleted question set '{set_name}'.", "question_set")
    return {"message": "Question set deleted successfully"}


@app.get("/api/history")
def get_history(user_id: int = None, email: str = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.ActivityLog).filter(models.ActivityLog.user_id == current_user.id).order_by(models.ActivityLog.created_at.desc())
    query = query.filter(
        (models.ActivityLog.type != "download")
        | models.ActivityLog.archived.is_(False)
    )
    logs = query.limit(100).all()
    return [
        {
            "id": log.id,
            "action": log.action,
            "details": log.details,
            "date": log.created_at.isoformat() if log.created_at else None,
            "type": log.type,
            "status": log.status,
            "filename": getattr(log, "filename", None),
            "downloadable": bool(getattr(log, "file_content", None)),
            "archived": bool(getattr(log, "archived", False)),
        }
        for log in logs
    ]


@app.get("/api/history/export-count")
def get_export_count(user_id: int = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    count = db.query(func.count(models.ActivityLog.id)).filter(
        models.ActivityLog.user_id == current_user.id,
        models.ActivityLog.status == "success",
        models.ActivityLog.archived.is_(False),
        models.ActivityLog.type.in_(("download", "export")),
    ).scalar()
    return {"count": count or 0}


@app.get("/api/downloads/{activity_id}")
def download_saved_file(activity_id: int, user_id: int = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.ActivityLog).filter(models.ActivityLog.id == activity_id, models.ActivityLog.type == "download")
    query = query.filter(models.ActivityLog.user_id == current_user.id, models.ActivityLog.archived.is_(False))
    log = query.first()
    if not log or not log.file_content:
        raise HTTPException(status_code=404, detail="Saved download not found")
    return Response(content=log.file_content, media_type=log.media_type or "application/octet-stream", headers={"Content-Disposition": f"attachment; filename={log.filename or 'downloaded-file'}"})


@app.get("/api/downloads/{activity_id}/view")
def view_saved_file(activity_id: int, user_id: int = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.ActivityLog).filter(models.ActivityLog.id == activity_id, models.ActivityLog.type == "download")
    query = query.filter(models.ActivityLog.user_id == current_user.id, models.ActivityLog.archived.is_(False))
    log = query.first()
    if not log or not log.file_content:
        raise HTTPException(status_code=404, detail="Saved download not found")
    return Response(content=log.file_content, media_type=log.media_type or "application/octet-stream", headers={"Content-Disposition": f"inline; filename={log.filename or 'downloaded-file'}"})


@app.get("/api/downloads/{activity_id}/preview")
def preview_saved_file(activity_id: int, user_id: int = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    authenticated_user_id = getattr(current_user, "id", None)
    if authenticated_user_id is None:
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")
        authenticated_user_id = user_id
    log = db.query(models.ActivityLog).filter(
        models.ActivityLog.id == activity_id,
        models.ActivityLog.user_id == authenticated_user_id,
        models.ActivityLog.type == "download",
        models.ActivityLog.archived.is_(False),
    ).first()
    if not log or not log.file_content:
        raise HTTPException(status_code=404, detail="Saved download not found")

    media_type = log.media_type or "application/octet-stream"
    if media_type == "application/pdf":
        return {"kind": "pdf", "filename": log.filename, "content": base64.b64encode(log.file_content).decode("ascii")}
    if media_type.endswith("wordprocessingml.document"):
        from docx import Document
        document = Document(io.BytesIO(log.file_content))
        blocks = []
        for paragraph in document.paragraphs:
            if paragraph.text.strip():
                style = paragraph.style.name.lower() if paragraph.style else ""
                tag = "h1" if "title" in style else "h2" if "heading" in style else "p"
                blocks.append(f"<{tag}>{paragraph.text}</{tag}>")
        for table in document.tables:
            rows = []
            for row in table.rows:
                cells = "".join(f"<td>{cell.text}</td>" for cell in row.cells)
                rows.append(f"<tr>{cells}</tr>")
            blocks.append(f"<table><tbody>{''.join(rows)}</tbody></table>")
        return {"kind": "html", "filename": log.filename, "content": "".join(blocks)}
    if media_type.endswith("spreadsheetml.sheet"):
        workbook = openpyxl.load_workbook(io.BytesIO(log.file_content), read_only=False, data_only=True)
        candidate_sheets = []
        for sheet in workbook.worksheets:
            if sheet.sheet_state == "hidden":
                continue
            text_values = []
            for row in sheet.iter_rows(min_row=1, max_row=min(15, sheet.max_row), min_col=1, max_col=min(12, sheet.max_column)):
                for cell in row:
                    if cell.value is None:
                        continue
                    text_values.append(str(cell.value).strip().lower())
            if any("table of specifications" in value for value in text_values):
                candidate_sheets.append(sheet)
        if not candidate_sheets:
            candidate_sheets = [sheet for sheet in workbook.worksheets if sheet.sheet_state != "hidden"]
        if not candidate_sheets:
            return {"kind": "text", "filename": log.filename, "content": log.file_content.decode("utf-8", errors="replace")}

        sheets = []
        for sheet in candidate_sheets[:1]:
            merged_ranges = []
            merged_cells = getattr(sheet, "merged_cells", None)
            if merged_cells is not None:
                for merged in merged_cells.ranges:
                    merged_ranges.append({
                        "min_row": merged.min_row,
                        "max_row": merged.max_row,
                        "min_col": merged.min_col,
                        "max_col": merged.max_col,
                    })

            html_rows = []
            occupied = set()
            for row in sheet.iter_rows():
                cells = []
                for cell in row:
                    if (cell.row, cell.column) in occupied:
                        continue
                    value = "" if cell.value is None else str(cell.value)
                    row_span = 1
                    col_span = 1
                    for merged in merged_ranges:
                        if (
                            merged["min_row"] <= cell.row <= merged["max_row"]
                            and merged["min_col"] <= cell.column <= merged["max_col"]
                            and (merged["min_row"], merged["min_col"]) == (cell.row, cell.column)
                        ):
                            row_span = merged["max_row"] - merged["min_row"] + 1
                            col_span = merged["max_col"] - merged["min_col"] + 1
                            for rr in range(merged["min_row"], merged["max_row"] + 1):
                                for cc in range(merged["min_col"], merged["max_col"] + 1):
                                    occupied.add((rr, cc))
                            break

                    style_parts = []
                    if cell.font and cell.font.bold:
                        style_parts.append("font-weight: 700;")
                    if cell.alignment and cell.alignment.horizontal:
                        style_parts.append(f"text-align: {cell.alignment.horizontal};")
                    if cell.border:
                        style_parts.append("border: 1px solid #cbd5e1;")
                    if cell.fill and getattr(cell.fill, "fill_type", None) == "solid":
                        style_parts.append("background-color: #f8fafc;")
                    cells.append({
                        "value": value,
                        "row_span": row_span,
                        "col_span": col_span,
                        "style": "".join(style_parts),
                    })
                if cells:
                    html_rows.append(cells)

            rows_html = []
            for row in html_rows:
                cells_html = []
                for cell in row:
                    cells_html.append(
                        f'<td style="{cell["style"]}" rowspan="{cell["row_span"]}" colspan="{cell["col_span"]}">{cell["value"]}</td>'
                    )
                rows_html.append(f"<tr>{''.join(cells_html)}</tr>")
            sheets.append({
                "name": sheet.title,
                "html": f"<table style='border-collapse: collapse; width: 100%; font-size: 12px; text-align: left;'>{''.join(rows_html)}</table>",
            })
        content_sections = []
        for sheet in sheets:
            content_sections.append(f"<section style='margin-bottom: 24px;'><h3 style='margin: 0 0 12px; font-weight: 700;'>{sheet['name']}</h3>{sheet['html']}</section>")
        return {"kind": "html", "filename": log.filename, "content": "".join(content_sections)}
    return {"kind": "text", "filename": log.filename, "content": log.file_content.decode("utf-8", errors="replace")}


@app.delete("/api/downloads/{activity_id}")
def delete_saved_file(activity_id: int, user_id: int = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    log = db.query(models.ActivityLog).filter(
        models.ActivityLog.id == activity_id,
        models.ActivityLog.user_id == current_user.id,
        models.ActivityLog.type == "download",
    ).first()
    if not log:
        raise HTTPException(status_code=404, detail="Saved download not found")
    log.archived = True
    db.commit()
    return {"message": "Download moved to recycle bin"}

@app.delete("/api/recycle-bin/downloads/{activity_id}")
def permanently_delete_download(activity_id: int, user_id: int = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.ActivityLog).filter(
        models.ActivityLog.id == activity_id,
        models.ActivityLog.type == "download",
        models.ActivityLog.archived.is_(True),
    )
    query = query.filter(models.ActivityLog.user_id == current_user.id)
    download = query.first()
    if not download:
        raise HTTPException(status_code=404, detail="Archived download not found")
    db.delete(download)
    db.commit()
    return {"message": "Download permanently deleted"}


@app.put("/api/questions/{question_id}")
async def update_question(
    question_id: int,
    question: str = Form(...),
    correct_answer: str = Form(...),
    explanation: str = Form(...),
    review_status: str = Form("needs_review"),
    difficulty: str = Form("moderate"),
    lifecycle_status: str = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.GeneratedQuestion).filter(
        models.GeneratedQuestion.id == question_id
    ).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    assert_question_access(db, current_user, q)
    if lifecycle_status is not None and lifecycle_status not in {"draft", "review", "approved", "published", "deprecated"}:
        raise HTTPException(status_code=400, detail="Invalid lifecycle status")
    db.add(models.QuestionVersion(snapshot={
        "question": q.question,
        "correct_answer": q.correct_answer,
        "explanation": q.explanation,
        "review_status": q.review_status,
        "difficulty": q.difficulty,
        "lifecycle_status": q.lifecycle_status,
    }, question_id=q.id))
    q.question = question
    q.correct_answer = correct_answer
    q.explanation = explanation
    if review_status not in {"needs_review", "in_review", "approved"}:
        raise HTTPException(status_code=400, detail="Invalid review status")
    if difficulty not in {"easy", "moderate", "hard"}:
        raise HTTPException(status_code=400, detail="Invalid difficulty")
    q.review_status = review_status
    q.difficulty = difficulty
    if lifecycle_status is not None:
        q.lifecycle_status = lifecycle_status
    db.commit()
    log_activity(db, "Question Updated", f"Updated question #{question_id} and review metadata.", "question", user_id=current_user.id)
    return {"message": "Question updated successfully"}


@app.get("/api/questions/{question_id}/versions")
def get_question_versions(question_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    question = db.query(models.GeneratedQuestion).filter(models.GeneratedQuestion.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    assert_question_access(db, current_user, question)
    return [
        {"id": version.id, "snapshot": version.snapshot, "created_at": version.created_at.isoformat() if version.created_at else None}
        for version in db.query(models.QuestionVersion).filter(models.QuestionVersion.question_id == question_id).order_by(models.QuestionVersion.created_at.desc()).all()
    ]


@app.post("/api/questions/{question_id}/versions/{version_id}/restore")
def restore_question_version(question_id: int, version_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    question = db.query(models.GeneratedQuestion).filter(models.GeneratedQuestion.id == question_id).first()
    version = db.query(models.QuestionVersion).filter(models.QuestionVersion.id == version_id, models.QuestionVersion.question_id == question_id).first()
    if not question or not version:
        raise HTTPException(status_code=404, detail="Question version not found")
    assert_question_access(db, current_user, question)
    db.add(models.QuestionVersion(snapshot={
        "question": question.question,
        "correct_answer": question.correct_answer,
        "explanation": question.explanation,
        "review_status": question.review_status,
        "difficulty": question.difficulty,
        "lifecycle_status": question.lifecycle_status,
    }, question_id=question.id))
    for field in ("question", "correct_answer", "explanation", "review_status", "difficulty"):
        setattr(question, field, version.snapshot.get(field))
    if "lifecycle_status" in version.snapshot:
        question.lifecycle_status = version.snapshot.get("lifecycle_status") or "draft"
    db.commit()
    log_activity(db, "Question Version Restored", f"Restored version {version_id} for question #{question_id}.", "question", user_id=current_user.id)
    return {"message": "Question version restored"}


@app.put("/api/questions/bulk")
def bulk_update_questions(
    question_ids: str = Form(...),
    review_status: str = Form(None),
    difficulty: str = Form(None),
    lifecycle_status: str = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    selected_ids = [int(item.strip()) for item in (question_ids or "").split(",") if item.strip().isdigit()]
    if not selected_ids:
        raise HTTPException(status_code=400, detail="No valid question IDs were provided")
    if review_status is not None and review_status not in {"needs_review", "in_review", "approved"}:
        raise HTTPException(status_code=400, detail="Invalid review status")
    if difficulty is not None and difficulty not in {"easy", "moderate", "hard"}:
        raise HTTPException(status_code=400, detail="Invalid difficulty")
    if lifecycle_status is not None and lifecycle_status not in {"draft", "review", "approved", "published", "deprecated"}:
        raise HTTPException(status_code=400, detail="Invalid lifecycle status")
    questions = db.query(models.GeneratedQuestion).filter(models.GeneratedQuestion.id.in_(selected_ids)).all()
    if not questions:
        raise HTTPException(status_code=404, detail="No matching questions found")
    for question in questions:
        assert_question_access(db, current_user, question)
    for question in questions:
        if review_status is not None:
            question.review_status = review_status
        if difficulty is not None:
            question.difficulty = difficulty
        if lifecycle_status is not None:
            question.lifecycle_status = lifecycle_status
    db.commit()
    log_activity(db, "Updated Questions", f"Bulk updated {len(questions)} question review records.", "review", user_id=current_user.id)
    return {"updated": len(questions)}


@app.delete("/api/questions/{question_id}")
def delete_question(question_id: int, user_id: int = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    q = db.query(models.GeneratedQuestion).filter(
        models.GeneratedQuestion.id == question_id
    ).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    assert_question_access(db, current_user, q)

    question_preview = q.question[:60] if q.question else f"Question #{question_id}"
    q.archived = True
    db.commit()

    log_activity(db, "Deleted Question", f"Removed question: '{question_preview}'.", "delete", user_id=current_user.id)

    return {"message": "Question deleted successfully"}


@app.delete("/api/recycle-bin/questions/{question_id}")
def permanently_delete_question(question_id: int, user_id: int = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    question = db.query(models.GeneratedQuestion).filter(
        models.GeneratedQuestion.id == question_id,
        models.GeneratedQuestion.archived.is_(True),
    ).first()
    if not question or (user_id and question.user_id not in (None, user_id)):
        raise HTTPException(status_code=404, detail="Archived question not found.")
    assert_question_access(db, current_user, question)
    question_preview = question.question[:60] if question.question else f"Question #{question_id}"
    db.query(models.QuestionVersion).filter(models.QuestionVersion.question_id == question_id).delete(synchronize_session=False)
    db.query(models.QuestionSetItem).filter(models.QuestionSetItem.question_id == question_id).delete(synchronize_session=False)
    db.delete(question)
    db.commit()
    log_activity(db, "Question Permanently Deleted", f"Permanently deleted question: '{question_preview}'.", "delete", user_id=current_user.id)
    return {"message": "Question permanently deleted."}


@app.post("/api/questions/export/tos")
def export_question_bank_tos(
    subject_id: int = Form(...),
    question_ids: str = Form(...),
    exam_type: str = Form("Final Exam"),
    semester: str = Form("First Semester"),
    academic_year: str = Form(""),
    subcolumn_a_hours: str = Form("{}"),
    selected_topics: str = Form("[]"),
    user_id: int | None = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    subject = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    selected_ids = [int(value) for value in (question_ids or "").split(",") if value.strip().isdigit()]
    questions = db.query(models.GeneratedQuestion).filter(
        models.GeneratedQuestion.id.in_(selected_ids),
        models.GeneratedQuestion.subject_id == subject_id,
    ).order_by(models.GeneratedQuestion.id).all()
    if not subject or not questions:
        raise HTTPException(status_code=404, detail="No questions selected for this subject")
    user_id = current_user.id
    for question in questions:
        assert_question_access(db, current_user, question)

    try:
        hours_by_topic = json.loads(subcolumn_a_hours or "{}") if subcolumn_a_hours else {}
    except json.JSONDecodeError:
        hours_by_topic = {}
    if not isinstance(hours_by_topic, dict):
        hours_by_topic = {}

    try:
        selected_topic_names = json.loads(selected_topics or "[]") if selected_topics else []
    except json.JSONDecodeError:
        selected_topic_names = []
    if not isinstance(selected_topic_names, list):
        selected_topic_names = []
    selected_topic_names = {str(item).strip() for item in selected_topic_names if str(item).strip()}

    tos_records = db.query(models.TableOfSpecification).filter(
        models.TableOfSpecification.id.in_({question.tos_id for question in questions if question.tos_id})
    ).all()
    ilo_by_topic = {
        topic.get("topic_name"): topic.get("ilo", "")
        for tos_record in tos_records
        for topic in (tos_record.tos_data or [])
        if topic.get("topic_name")
    }

    topics = {}
    for number, question in enumerate(questions, start=1):
        topic_name = question.topic_name or "General"
        if selected_topic_names and topic_name not in selected_topic_names:
            continue
        topic = topics.setdefault(topic_name, {
            "topic_name": topic_name,
            "ilo": ilo_by_topic.get(topic_name, ""),
            "hours_a": 1.0,
            "items": 0,
            "weight": 0,
            "bloom_counts": {level: 0 for level in ("Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create")},
            "bloom_question_numbers": {level: [] for level in ("Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create")},
        })
        level = question.bloom_level if question.bloom_level in topic["bloom_counts"] else "Remember"
        topic["items"] += 1
        topic["bloom_counts"][level] += 1
        topic["bloom_question_numbers"][level].append(str(number))

    selected_topics_data = list(topics.values())
    if selected_topics_data:
        total_hours = sum(
            float(hours_by_topic.get(topic["topic_name"], topic.get("hours_a", 1.0) or 1.0))
            for topic in selected_topics_data
        ) or 1.0
        for topic in selected_topics_data:
            topic["hours_a"] = float(hours_by_topic.get(topic["topic_name"], topic.get("hours_a", 1.0) or 1.0))
            topic["minutes_b"] = round(topic["hours_a"] / total_hours, 4)
            topic["weight"] = round(topic["hours_a"] / total_hours * 100, 2)
            topic["bloom_question_numbers"] = {
                level: ", ".join(numbers) for level, numbers in topic["bloom_question_numbers"].items()
            }
    else:
        selected_topics_data = []

    if not selected_topics_data:
        raise HTTPException(status_code=400, detail="No valid topics were selected for the TOS export.")

    creator = current_user
    leadership = _resolve_department_leadership(
        db,
        creator=creator,
        subject=subject,
        department_name=creator.department or "",
    )

    workbook = generate_tos_from_excel_template(
        selected_topics_data,
        subject.code,
        subject.name,
        len(questions),
        exam_type=exam_type,
        semester=semester,
        instructor_name=(creator.name or creator.email) if creator else "",
        academic_year=academic_year,
        department=leadership["department_name"],
        dean_name=leadership["dean_name"],
        program_chair_name=leadership["program_chair_name"],
        department_code=leadership["department_code"],
        program_code=leadership["program_code"],
    )
    stream = io.BytesIO()
    workbook.save(stream)
    filename_subject = re.sub(r"[^A-Za-z0-9]+", "-", subject.code or subject.name or "assessment").strip("-")
    filename_exam = re.sub(r"[^A-Za-z0-9]+", "-", exam_type).strip("-")
    filename = f"{filename_subject}-{filename_exam}-TOS.xlsx"
    log_download(db, "Downloaded TOS", f"Downloaded '{filename}' for '{subject.name}'.", filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", stream.getvalue(), user_id=user_id)
    return Response(
        content=stream.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )

@app.post("/api/question-sets/{set_id}/export")
def export_question_set(
    set_id: int,
    export_format: str = Form("pdf"),
    exam_type: str = Form("Final Exam"),
    include_answer_key: bool = Form(True),
    answer_mode: str = Form("with_key"),
    user_id: int | None = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    export_format = export_format.lower()
    if export_format not in {"pdf", "docx"}:
        raise HTTPException(status_code=400, detail="Export format must be pdf or docx")
    question_set = db.query(models.QuestionSet).filter(models.QuestionSet.id == set_id).first()
    if not question_set:
        raise HTTPException(status_code=404, detail="Question set not found")
    assert_subject_access(db, current_user, question_set.subject)
    questions = [item.question for item in question_set.items if item.question]
    if not questions:
        raise HTTPException(status_code=400, detail="Add at least one question before exporting")
    for question in questions:
        assert_question_access(db, current_user, question)
    user_id = current_user.id
    try:
        normalized_questions = [type("QuestionLike", (), {
            "question": question.question or "",
            "question_type": question.question_type or "",
            "options": question.options or [],
            "correct_answer": question.correct_answer or "",
            "left_items": matching_choices(question)[0] if question.question_type == "Matching Type" else [],
            "right_items": matching_choices(question)[1] if question.question_type == "Matching Type" else [],
        })() for question in questions]
        content, filename = build_assessment_document(
            normalized_questions,
            question_set.subject.name,
            export_format,
            include_answer_key=include_answer_key,
            answer_mode=answer_mode,
            subject_code=question_set.subject.code or "",
            exam_type=exam_type or question_set.exam_title or "Final Examination",
            class_info=question_set.name or "",
            directions=[question_set.instructions] if question_set.instructions else None,
        )
        question_set.status = "exported"
        db.add(models.QuestionSetExport(question_set_id=question_set.id, export_format=export_format, filename=filename))
        db.commit()
        log_activity(db, "Exported Question Set", f"Exported '{question_set.name}' as {export_format.upper()}.", "export", user_id=user_id)
        media_type = "application/pdf" if export_format == "pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        return Response(content=content, media_type=media_type, headers={"Content-Disposition": f"attachment; filename={filename}"})
    except HTTPException as exc:
        log_activity(db, "Question Set Export Failed", str(exc.detail), "export", status="error", user_id=user_id)
        raise
    except Exception as exc:
        log_activity(db, "Question Set Export Failed", str(exc), "export", status="error", user_id=user_id)
        raise HTTPException(status_code=500, detail=str(exc))

@app.post("/api/questions/export")
def export_assessment(
    subject_id: int = Form(...),
    question_ids: str = Form(...),
    export_format: str = Form("pdf"),
    exam_type: str = Form("Final Exam"),
    semester: str = Form(""),
    academic_year: str = Form(""),
    include_answer_key: bool = Form(True),
    answer_mode: str = Form("with_key"),
    user_id: int | None = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    user_id = current_user.id
    try:
        selected_ids = []
        for item in (question_ids or "").split(","):
            item = item.strip()
            if item.isdigit():
                selected_ids.append(int(item))

        if not selected_ids:
            raise HTTPException(status_code=400, detail="No valid question IDs were provided")

        subject = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        assert_subject_access(db, current_user, subject)

        questions = db.query(models.GeneratedQuestion).filter(
            models.GeneratedQuestion.id.in_(selected_ids),
            models.GeneratedQuestion.subject_id == subject_id
        ).all()
        if not questions:
            raise HTTPException(status_code=404, detail="No questions selected")
        for question in questions:
            assert_question_access(db, current_user, question)
        user_id = current_user.id

        normalized_questions = []
        for question in questions:
            left_items, right_items = matching_choices(question) if question.question_type == "Matching Type" else ([], [])
            normalized_questions.append(type("QuestionLike", (), {
                "question": getattr(question, "question", "") or "",
                "question_type": getattr(question, "question_type", "") or "",
                "options": getattr(question, "options", None) or {"left_items": left_items, "right_items": right_items},
                "correct_answer": getattr(question, "correct_answer", "") or "",
                "left_items": left_items,
                "right_items": right_items,
            })())

        content, filename = build_assessment_document(
            normalized_questions,
            subject.name,
            export_format.lower(),
            include_answer_key=include_answer_key,
            answer_mode=answer_mode,
            subject_code=subject.code or "",
            exam_type=exam_type or "Final Examination",
            semester=semester or "",
            academic_year=academic_year or "",
        )
        media_type = "application/pdf" if export_format.lower() == "pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename_subject = subject.code or subject.name
        filename_subject = re.sub(r"[^A-Za-z0-9]+", "-", filename_subject).strip("-")
        filename_exam = re.sub(r"[^A-Za-z0-9]+", "-", exam_type).strip("-")
        filename = f"{filename_subject}-{filename_exam}-Test.{export_format.lower()}"
        log_download(db, "Downloaded Test", f"Downloaded '{filename}' for '{subject.name}'.", filename, media_type, content, user_id=user_id)
        return Response(content=content, media_type=media_type, headers={"Content-Disposition": f"attachment; filename={filename}"})
    except HTTPException as exc:
        log_activity(db, "Assessment Export Failed", str(exc.detail), "export", status="error", user_id=user_id)
        raise
    except Exception as e:
        log_activity(db, "Assessment Export Failed", str(e), "export", status="error", user_id=user_id)
        raise HTTPException(status_code=500, detail=str(e))

app.include_router(questions.router)
app.include_router(assessment.router)
app.include_router(assessment.export_router)
app.include_router(activity.router)