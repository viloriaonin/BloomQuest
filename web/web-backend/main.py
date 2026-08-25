from typing import Optional
import io
import json
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, status, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from dotenv import load_dotenv
from database import engine, get_db, SessionLocal
from file_extractor import extract_text
from ai_service import generate_questions_from_tos, build_preview, prepare_database_rows, statistics, parse_syllabus_text_with_ai
from routers.tos_utils import compute_tos, generate_tos_from_excel_template
from classifier import classify_question
import models
from datetime import datetime, timedelta
import logging
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
from routers.assessment import build_assessment_docx, cleanup_file
from routers import activity
import smtplib
import string
import pythoncom
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


def log_activity(db: Session, action: str, details: str, type: str, status: str = "success", user_id: int = None):
    entry = models.ActivityLog(
        user_id=user_id,
        action=action,
        details=details,
        type=type,
        status=status
    )
    db.add(entry)
    db.commit()


def detect_subject(syllabus_text: str):
    course_title, course_code, topics = parse_syllabus_text_with_ai(syllabus_text)
    return {"name": course_title, "code": course_code, "description": ""}


def detect_topics(syllabus_text: str, module_text: str):
    course_title, course_code, topics = parse_syllabus_text_with_ai(syllabus_text)
    return {"course_title": course_title, "course_code": course_code, "topics": topics}


def build_assessment_document(questions, subject_name, export_format, include_answer_key=True, answer_mode="with_key"):
    SubjectLike = type("SubjectLike", (), {"name": subject_name})
    docx_path = build_assessment_docx(SubjectLike(), questions, include_answer_key=include_answer_key, answer_mode=answer_mode)
    try:
        if export_format == "docx":
            with open(docx_path, "rb") as f:
                content = f.read()
            filename = f"{subject_name.replace(' ', '_')}_Assessment.docx"
            return content, filename

        if export_format == "pdf":
            try:
                from docx2pdf import convert
            except ImportError as exc:
                raise Exception("PDF export requires the docx2pdf package.") from exc

            pdf_path = docx_path.replace(".docx", ".pdf")
            convert(docx_path, pdf_path)
            with open(pdf_path, "rb") as f:
                content = f.read()
            filename = f"{subject_name.replace(' ', '_')}_Assessment.pdf"
            cleanup_file(pdf_path)
            return content, filename

        raise ValueError(f"Unsupported export format: {export_format}")
    finally:
        cleanup_file(docx_path)


def matching_choices(question):
    options = question.options
    if isinstance(options, str):
        try:
            options = json.loads(options)
        except (TypeError, json.JSONDecodeError):
            options = None
    if isinstance(options, dict) and options.get("left_items") and options.get("right_items"):
        return options["left_items"], options["right_items"]

    answer = question.correct_answer
    if isinstance(answer, str):
        try:
            answer = json.loads(answer)
        except (TypeError, json.JSONDecodeError):
            answer = None
    if isinstance(answer, dict):
        return list(answer.keys()), list(answer.values())
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
        "question": question.question,
        "options": options,
        "correct_answer": question.correct_answer,
        "explanation": question.explanation,
        "review_status": question.review_status,
        "difficulty": question.difficulty,
        "created_at": question.created_at,
    }

# Ensure the new archive, name, and department columns exist in the users table.
# SQLAlchemy's create_all does not alter existing tables, so we add missing columns explicitly.
with engine.begin() as conn:
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE"))
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR"))
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR"))
    conn.execute(text("ALTER TABLE subjects ADD COLUMN IF NOT EXISTS department_id INTEGER"))
    conn.execute(text("ALTER TABLE generated_questions ADD COLUMN IF NOT EXISTS review_status VARCHAR(32) NOT NULL DEFAULT 'needs_review'"))
    conn.execute(text("ALTER TABLE generated_questions ADD COLUMN IF NOT EXISTS difficulty VARCHAR(32) NOT NULL DEFAULT 'moderate'"))
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

app = FastAPI()

otp_store = {}
contact_admin_otp_store = {}
contact_admin_pending_requests = {}

# Allow React frontend to talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173").split(","),
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
    department: str = Field(..., min_length=2, max_length=100)
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
    department: str = Field(..., min_length=2, max_length=100)
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
    if record and record["expires_at"] < datetime.utcnow():
        otp_store.pop(email, None)

@app.post("/api/forgot-password/send-otp")
def send_otp(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    enforce_rate_limit("otp", data.email)
    user = db.query(models.User).filter(func.lower(models.User.email) == data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found for this email.")

    code = f"{random.randint(0, 999999):06d}"
    otp_store[data.email] = {
        "otp": code,
        "expires_at": datetime.utcnow() + timedelta(minutes=10),
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

@app.post("/api/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    enforce_rate_limit("login", data.email)
    user = db.query(models.User).filter(func.lower(models.User.email) == data.email).first()

    if user and verify_password(data.password, user.password):
        pass
    else:
        user = None

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    log_activity(db, "System Login", f"Logged in as {user.email}.", "login", user_id=user.id)

    # Return response (replace with JWT later)
    return {
        "token": "fake-token-for-now",
        "user_id": user.id,
        "role": user.role,
        "email": user.email,
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
def list_pending_account_requests(db: Session = Depends(get_db)):
    requests = (
        db.query(models.AccountRequest)
        .filter(models.AccountRequest.status == "pending")
        .order_by(models.AccountRequest.created_at.desc())
        .all()
    )

    return [
        {
            "id": request.id,
            "full_name": request.full_name,
            "department": request.department,
            "email": request.email,
            "status": request.status,
            "created_at": request.created_at.isoformat() if request.created_at else None,
            "requested_at": request.created_at.isoformat() if request.created_at else None,
        }
        for request in requests
    ]

@app.get("/api/contact-admin/users")
def list_admin_users(db: Session = Depends(get_db)):
    # Return all users (except those soft-archived) so admin can manage any account
    active_users = (
        db.query(models.User)
        .filter(models.User.archived == False)
        .order_by(models.User.id.desc())
        .all()
    )
    archived_users = (
        db.query(models.User)
        .filter(models.User.archived == True)
        .order_by(models.User.id.desc())
        .all()
    )

    format_user = lambda user: {
        "id": user.id,
        "full_name": user.name or user.email.split("@", 1)[0],
        "department": user.department or "N/A",
        "email": user.email,
        "role": user.role,
        "status": "Active" if not user.archived else "Archived",
        "created_at": None,
        "joined": "Recently added",
        "archived": user.archived,
    }

    return {
        "active": [format_user(user) for user in active_users],
        "archived": [format_user(user) for user in archived_users],
    }

@app.post("/api/contact-admin/approve")
async def approve_account_request(payload: AccountActionRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    normalized_email = normalize_email(payload.email)
    request_entry = (
        db.query(models.AccountRequest)
        .filter(func.lower(models.AccountRequest.email) == normalized_email)
        .first()
    )
    if not request_entry:
        raise HTTPException(status_code=404, detail="Pending registration ticket not found.")

    # capture details from the request before deleting the ticket
    full_name = getattr(request_entry, "full_name", None)
    department = getattr(request_entry, "department", None)

    temp_password = generate_temporary_password()

    existing_user = db.query(models.User).filter(func.lower(models.User.email) == normalized_email).first()
    if existing_user:
        existing_user.password = hash_password(temp_password)
        existing_user.role = "faculty"
        existing_user.archived = False
        existing_user.department = department
        existing_user.name = full_name or existing_user.name
    else:
        new_user = models.User(
            email=normalized_email,
            password=hash_password(temp_password),
            role="faculty",
            archived=False,
            name=full_name,
            department=department,
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
def update_user_password(payload: UpdatePasswordRequest, db: Session = Depends(get_db)):
    normalized_email = normalize_email(payload.email)
    user = db.query(models.User).filter(func.lower(models.User.email) == normalized_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.password = hash_password(payload.new_password)
    db.commit()

    return {"message": "Password updated successfully."}

@app.post("/api/users/archive")
def archive_user(payload: AccountActionRequest, db: Session = Depends(get_db)):
    normalized_email = normalize_email(payload.email)
    user = db.query(models.User).filter(func.lower(models.User.email) == normalized_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.archived = True
    db.commit()
    log_activity(db, "User Archived", f"Archived user {normalized_email}.", "user")
    return {"message": "User archived successfully.", "status": "archived"}

@app.post("/api/users/restore")
def restore_user(payload: AccountActionRequest, db: Session = Depends(get_db)):
    normalized_email = normalize_email(payload.email)
    user = db.query(models.User).filter(func.lower(models.User.email) == normalized_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.archived = False
    db.commit()
    log_activity(db, "User Restored", f"Restored user {normalized_email}.", "user")
    return {"message": "User restored successfully.", "status": "active"}

@app.post("/api/users/verify-admin-password")
def verify_admin_password(payload: AdminVerifyRequest, db: Session = Depends(get_db)):
    normalized_admin_email = normalize_email(payload.admin_email)
    admin_user = (
        db.query(models.User)
        .filter(func.lower(models.User.email) == normalized_admin_email,
                models.User.role == "admin")
        .first()
    )
    if admin_user and not verify_password(payload.admin_password, admin_user.password):
        admin_user = None
    if not admin_user:
        raise HTTPException(status_code=403, detail="Invalid admin credentials.")

    normalized_target_email = normalize_email(payload.target_email)
    target_user = (
        db.query(models.User)
        .filter(func.lower(models.User.email) == normalized_target_email)
        .first()
    )
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found.")

    return {
        "email": target_user.email,
        "password": target_user.password,
        "role": target_user.role,
        "archived": target_user.archived,
    }

@app.delete("/api/users/{email}")
def delete_user(email: str, db: Session = Depends(get_db)):
    normalized_email = normalize_email(email)
    user = db.query(models.User).filter(func.lower(models.User.email) == normalized_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    db.delete(user)
    db.commit()
    log_activity(db, "User Deleted", f"Deleted user {normalized_email}.", "user")

    return {"message": "User deleted successfully."}

@app.post("/api/contact-admin/decline")
def decline_account_request(payload: AccountActionRequest, db: Session = Depends(get_db)):
    normalized_email = normalize_email(payload.email)
    request_entry = (
        db.query(models.AccountRequest)
        .filter(func.lower(models.AccountRequest.email) == normalized_email)
        .first()
    )
    if not request_entry:
        raise HTTPException(status_code=404, detail="Account request not found.")

    request_entry.status = "declined"
    db.commit()
    log_activity(db, "Account Request Declined", f"Declined account request for {normalized_email}.", "user")

    return {"message": "Account request declined successfully.", "status": request_entry.status}

@app.post("/api/contact-admin/send-otp")
def request_contact_admin_otp(payload: ContactAdminOtpRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    normalized_email = normalize_email(payload.email)

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
        "department": payload.department,
        "email": normalized_email,
    }
    contact_admin_otp_store[normalized_email] = {
        "otp": code,
        "expires_at": datetime.utcnow() + timedelta(minutes=10),
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

    if record and record["expires_at"] < datetime.utcnow():
        contact_admin_otp_store.pop(normalized_email, None)
        contact_admin_pending_requests.pop(normalized_email, None)
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")

    if not record or record["otp"] != data.otp:
        raise HTTPException(status_code=400, detail="Incorrect or expired verification code.")

    pending_payload = contact_admin_pending_requests.get(normalized_email)
    if not pending_payload:
        contact_admin_otp_store.pop(normalized_email, None)
        raise HTTPException(status_code=400, detail="Request session expired. Please request a new OTP.")

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
        department=pending_payload["department"],
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
    db: Session = Depends(get_db)
):
    try:
        enforce_rate_limit("upload", request.client.host if request.client else "unknown")
        module_bytes = await read_upload_bytes(module_file, "module_file")
        syllabus_bytes = await read_upload_bytes(syllabus_file, "syllabus_file")
        module_text = extract_text(module_bytes, module_file.filename)
        syllabus_text = extract_text(syllabus_bytes, syllabus_file.filename)

        subject = None
        subject_info = None

        if subject_id is not None:
            subject = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
            if not subject:
                raise HTTPException(status_code=404, detail=f"Subject with id {subject_id} was not found")
            subject_info = {
                "name": subject.name,
                "code": subject.code,
                "description": subject.description,
            }
        else:
            subject_info = detect_subject(syllabus_text)
            subject = db.query(models.Subject).filter(
                models.Subject.name == subject_info["name"]
            ).first()
            if not subject:
                subject = models.Subject(
                    name=subject_info["name"],
                    code=subject_info.get("code"),
                    description=subject_info.get("description")
                )
                db.add(subject)
                db.commit()
                db.refresh(subject)

        topics_data = detect_topics(syllabus_text, module_text)

        upload = models.UploadedFile(
            user_id=1,
            subject_id=subject.id,
            module_filename=module_file.filename,
            syllabus_filename=syllabus_file.filename,
            module_text=module_text,
            syllabus_text=syllabus_text
        )
        db.add(upload)
        db.commit()
        db.refresh(upload)

        log_activity(db, "Uploaded Module", f"Processed '{module_file.filename}' for Table of Specifications.", "upload")

        return {
            "upload_id": upload.id,
            "subject": subject_info,
            "topics": topics_data["topics"],
            "message": "Files uploaded! Now enter total number of items."
        }
    except Exception as e:
        log_activity(db, "Failed Upload", f"File '{module_file.filename}' could not be processed.", "upload", status="error")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate")
async def generate_questions(
    upload_id: int = Form(...),
    total_items: int = Form(...),
    question_types: str = Form(None),
    db: Session = Depends(get_db)
):
    try:
        upload = db.query(models.UploadedFile).filter(
            models.UploadedFile.id == upload_id
        ).first()
        if not upload:
            raise HTTPException(status_code=404, detail="Upload not found")

        topics_data = detect_topics(upload.syllabus_text, upload.module_text)
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

        questions = generate_questions_from_tos(
            subject={"name": subject.name, "code": subject.code},
            module_text=upload.module_text,
            tos_data=tos,
        )

        bloom_distribution = {}
        question_type_distribution = {}
        for q in questions:
            bloom_distribution[q["bloom_level"]] = bloom_distribution.get(q["bloom_level"], 0) + 1
            question_type_distribution[q["type"]] = question_type_distribution.get(q["type"], 0) + 1

        for q in questions:
            bloom_level = classify_question(q["question"])
            question = models.GeneratedQuestion(
                tos_id=tos_record.id,
                subject_id=upload.subject_id,
                bloom_level=bloom_level,
                question_type=q.get("type"),
                question=q["question"],
                options=q.get("options"),
                correct_answer=q.get("correct_answer"),
                explanation=q.get("explanation")
            )
            db.add(question)
        db.commit()

        log_activity(db, "Generated Assessment", f"Created '{subject.name}' with {len(questions)} questions.", "generate")

        return {
            "tos_id": tos_record.id,
            "tos": tos,
            "total_questions": len(questions),
            "questions_preview": questions,
            "bloom_distribution": bloom_distribution,
            "question_type_distribution": question_type_distribution,
            "message": f"Successfully generated and classified {len(questions)} questions!"
        }
    except Exception as e:
        log_activity(db, "Assessment Generation Failed", f"Legacy generation failed for upload {upload_id}.", "generate", status="error")
        raise HTTPException(status_code=500, detail=str(e))

# --- NEW SCHEMAS FOR MANUAL ENTERED OPERATIONS ---
class SubjectCreateRequest(BaseModel):
    name: str
    code: str = None
    department_id: int | None = None

class DepartmentCreateRequest(BaseModel):
    name: str
    code: str | None = None

class DepartmentUpdateRequest(BaseModel):
    name: str
    code: str | None = None

class ManualQuestionRequest(BaseModel):
    question: str
    question_type: str
    subject_id: int
    user_id: int | None = None

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
def get_departments(db: Session = Depends(get_db)):
    departments = db.query(models.Department).order_by(models.Department.name.asc()).all()
    return [
        {
            "id": department.id,
            "name": department.name,
            "code": department.code,
        }
        for department in departments
    ]


@app.post("/api/departments", status_code=201)
def create_department(payload: DepartmentCreateRequest, db: Session = Depends(get_db)):
    normalized_name = payload.name.strip()
    normalized_code = payload.code.strip() if payload.code else None

    existing = db.query(models.Department).filter(
        func.lower(models.Department.name) == normalized_name.lower()
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A department with this name already exists.")

    if normalized_code:
        code_match = db.query(models.Department).filter(
            func.lower(models.Department.code) == normalized_code.lower()
        ).first()
        if code_match:
            raise HTTPException(status_code=400, detail="A department with this code already exists.")

    new_department = models.Department(
        name=normalized_name,
        code=normalized_code,
    )
    db.add(new_department)
    db.commit()
    db.refresh(new_department)
    log_activity(db, "Department Created", f"Created department '{new_department.name}'.", "academic")

    return {
        "id": new_department.id,
        "name": new_department.name,
        "code": new_department.code,
    }


# Backwards-compatible endpoints without the '/api' prefix (some clients call these paths)
@app.get("/departments")
def get_departments_noapi(db: Session = Depends(get_db)):
    return get_departments(db)


@app.post("/departments", status_code=201)
def create_department_noapi(payload: DepartmentCreateRequest, db: Session = Depends(get_db)):
    return create_department(payload, db)


@app.put("/departments/{department_id}")
def update_department_noapi(department_id: int, payload: DepartmentUpdateRequest, db: Session = Depends(get_db)):
    return update_department(department_id, payload, db)


@app.delete("/departments/{department_id}")
def delete_department_noapi(department_id: int, db: Session = Depends(get_db)):
    return delete_department(department_id, db)


@app.put("/api/departments/{department_id}")
def update_department(department_id: int, payload: DepartmentUpdateRequest, db: Session = Depends(get_db)):
    department = db.query(models.Department).filter(models.Department.id == department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found.")

    normalized_name = payload.name.strip()
    normalized_code = payload.code.strip() if payload.code else None

    duplicate_name = db.query(models.Department).filter(
        func.lower(models.Department.name) == normalized_name.lower(),
        models.Department.id != department_id,
    ).first()
    if duplicate_name:
        raise HTTPException(status_code=400, detail="A department with this name already exists.")

    if normalized_code:
        duplicate_code = db.query(models.Department).filter(
            func.lower(models.Department.code) == normalized_code.lower(),
            models.Department.id != department_id,
        ).first()
        if duplicate_code:
            raise HTTPException(status_code=400, detail="A department with this code already exists.")

    department.name = normalized_name
    department.code = normalized_code
    db.commit()
    db.refresh(department)
    log_activity(db, "Department Updated", f"Updated department '{department.name}'.", "academic")

    return {
        "id": department.id,
        "name": department.name,
        "code": department.code,
    }


@app.delete("/api/departments/{department_id}")
def delete_department(department_id: int, db: Session = Depends(get_db)):
    department = db.query(models.Department).filter(models.Department.id == department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found.")

    db.query(models.Subject).filter(models.Subject.department_id == department_id).update({"department_id": None})
    db.delete(department)
    db.commit()
    log_activity(db, "Department Deleted", f"Deleted department '{department.name}'.", "academic")
    return {"message": "Department deleted successfully."}


# --- NEW ROUTE: MANUAL SUBJECT CREATION ---
@app.post("/api/subjects", status_code=201)
def create_subject_manually(payload: SubjectCreateRequest, db: Session = Depends(get_db)):
    existing_subject = db.query(models.Subject).filter(
        func.lower(models.Subject.name) == payload.name.strip().lower()
    ).first()
    
    if existing_subject:
        raise HTTPException(status_code=400, detail="A subject with this name already exists.")

    if payload.department_id is not None:
        department = db.query(models.Department).filter(models.Department.id == payload.department_id).first()
        if not department:
            raise HTTPException(status_code=404, detail="Department not found.")
        department_id = department.id
    else:
        department_id = None
        
    new_subject = models.Subject(
        name=payload.name.strip(),
        code=payload.code.strip() if payload.code else None,
        description="Manually added subject area.",
        department_id=department_id,
    )
    db.add(new_subject)
    db.commit()
    db.refresh(new_subject)
    log_activity(db, "Subject Created", f"Created subject '{new_subject.name}'.", "academic")
    
    return {
        "id": new_subject.id,
        "name": new_subject.name,
        "code": new_subject.code,
        "department_id": new_subject.department_id,
        "message": "Subject registered successfully!"
    }

@app.put("/api/subjects/{subject_id}")
def update_subject(subject_id: int, payload: SubjectCreateRequest, db: Session = Depends(get_db)):
    subject = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    normalized_name = payload.name.strip()
    normalized_code = payload.code.strip() if payload.code else None

    duplicate = db.query(models.Subject).filter(
        func.lower(models.Subject.name) == normalized_name.lower(),
        models.Subject.id != subject_id,
    ).first()
    if duplicate:
        raise HTTPException(status_code=400, detail="A subject with this name already exists.")

    if payload.department_id is not None:
        dept = db.query(models.Department).filter(models.Department.id == payload.department_id).first()
        if not dept:
            raise HTTPException(status_code=404, detail="Department not found.")
        subject.department_id = dept.id
    else:
        subject.department_id = None

    subject.name = normalized_name
    subject.code = normalized_code
    db.commit()
    db.refresh(subject)
    log_activity(db, "Subject Updated", f"Updated subject '{subject.name}'.", "academic")

    return {
        "id": subject.id,
        "name": subject.name,
        "code": subject.code,
        "department_id": subject.department_id,
    }


@app.delete("/api/subjects/{subject_id}")
def delete_subject(subject_id: int, db: Session = Depends(get_db)):
    subject = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")
    subject.archived = True
    db.commit()
    log_activity(db, "Subject Deleted", f"Deleted subject '{subject.name}'.", "academic")
    return {"message": "Subject deleted successfully."}

@app.get("/api/recycle-bin/subjects")
def get_archived_subjects(db: Session = Depends(get_db)):
    return db.query(models.Subject).filter(models.Subject.archived.is_(True)).order_by(models.Subject.created_at.desc()).all()

@app.post("/api/recycle-bin/subjects/{subject_id}/restore")
def restore_subject(subject_id: int, db: Session = Depends(get_db)):
    subject = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")
    subject.archived = False
    db.commit()
    db.refresh(subject)
    log_activity(db, "Subject Restored", f"Restored subject '{subject.name}'.", "academic")
    return subject

# --- NEW ROUTE: SINGLE QUESTION MANUAL CLASSIFICATION ---
@app.post("/api/questions/manual", status_code=201)
def classify_and_save_manual_question(payload: ManualQuestionRequest, db: Session = Depends(get_db)):
    subject = db.query(models.Subject).filter(models.Subject.id == payload.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject context not found.")

    # 1. Run semantic similarity logic / duplicate validation against existing items
    duplicate_check = db.query(models.GeneratedQuestion).filter(
        models.GeneratedQuestion.subject_id == payload.subject_id,
        func.lower(models.GeneratedQuestion.question) == payload.question.strip().lower()
    ).first()

    if duplicate_check:
        raise HTTPException(status_code=400, detail="This identical question text already exists inside this subject pool.")

    # 2. Leverage your classifier pipeline engine to evaluate Bloom's Taxonomy tier
    bloom_level = classify_question(payload.question.strip())

    # 3. Save entry directly to database row structures
    new_question = models.GeneratedQuestion(
        subject_id=payload.subject_id,
        bloom_level=bloom_level,
        question_type=payload.question_type,
        question=payload.question.strip(),
        options=None,
        correct_answer="Evaluated text payload.",
        explanation="Manually classified entry item."
    )
    db.add(new_question)
    db.commit()
    db.refresh(new_question)

    log_activity(db, "Classified Question", f"Manual Input: '{payload.question[:60]}' → Categorized as {bloom_level}.", "classify", user_id=payload.user_id)

    return {
        "id": new_question.id,
        "bloom_level": bloom_level,
        "message": f"Successfully classified question under {bloom_level} tier!"
    }

@app.get("/api/subjects")
def get_subjects(db: Session = Depends(get_db)):
    subjects = db.query(models.Subject).filter(models.Subject.archived.is_(False)).all()
    question_counts = dict(
        db.query(models.GeneratedQuestion.subject_id, func.count(models.GeneratedQuestion.id))
        .group_by(models.GeneratedQuestion.subject_id)
        .all()
    )
    return [
        {
            "id": subject.id,
            "name": subject.name,
            "code": subject.code,
            "description": subject.description,
            "department_id": subject.department_id,
            "created_at": subject.created_at,
            "archived": subject.archived,
            "question_count": question_counts.get(subject.id, 0),
        }
        for subject in subjects
    ]

# Backwards-compatible subject endpoints without the '/api' prefix
@app.get("/subjects")
def get_subjects_noapi(db: Session = Depends(get_db)):
    return get_subjects(db)


@app.post("/subjects", status_code=201)
def create_subject_noapi(payload: SubjectCreateRequest, db: Session = Depends(get_db)):
    return create_subject_manually(payload, db)


@app.put("/subjects/{subject_id}")
def update_subject_noapi(subject_id: int, payload: SubjectCreateRequest, db: Session = Depends(get_db)):
    return update_subject(subject_id, payload, db)


@app.delete("/subjects/{subject_id}")
def delete_subject_noapi(subject_id: int, db: Session = Depends(get_db)):
    return delete_subject(subject_id, db)


@app.get("/api/questions")
def get_questions(
    subject_id: int = None,
    bloom_level: str = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.GeneratedQuestion)
    if subject_id:
        query = query.filter(models.GeneratedQuestion.subject_id == subject_id)
    if bloom_level:
        query = query.filter(models.GeneratedQuestion.bloom_level == bloom_level)
    return [serialize_question(question) for question in query.all()]


def serialize_question_set(question_set):
    set_questions = [item.question for item in question_set.items if item.question]
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
        "question_ids": [item.question_id for item in question_set.items],
        "question_count": len(question_set.items),
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
def get_question_sets(subject_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(models.QuestionSet).order_by(models.QuestionSet.updated_at.desc(), models.QuestionSet.created_at.desc())
    if subject_id:
        query = query.filter(models.QuestionSet.subject_id == subject_id)
    return [serialize_question_set(question_set) for question_set in query.all()]


@app.post("/api/question-sets", status_code=201)
def create_question_set(payload: QuestionSetCreateRequest, db: Session = Depends(get_db)):
    subject = db.query(models.Subject).filter(models.Subject.id == payload.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
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
    return serialize_question_set(question_set)


@app.put("/api/question-sets/{set_id}")
def update_question_set(set_id: int, payload: QuestionSetUpdateRequest, db: Session = Depends(get_db)):
    question_set = db.query(models.QuestionSet).filter(models.QuestionSet.id == set_id).first()
    if not question_set:
        raise HTTPException(status_code=404, detail="Question set not found")
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
    return serialize_question_set(question_set)


@app.put("/api/question-sets/{set_id}/items")
def update_question_set_items(set_id: int, payload: QuestionSetItemsRequest, db: Session = Depends(get_db)):
    question_set = db.query(models.QuestionSet).filter(models.QuestionSet.id == set_id).first()
    if not question_set:
        raise HTTPException(status_code=404, detail="Question set not found")
    unique_ids = list(dict.fromkeys(payload.question_ids))
    questions = db.query(models.GeneratedQuestion).filter(
        models.GeneratedQuestion.id.in_(unique_ids),
        models.GeneratedQuestion.subject_id == question_set.subject_id,
    ).all() if unique_ids else []
    valid_ids = {question.id for question in questions}
    if len(valid_ids) != len(unique_ids):
        raise HTTPException(status_code=400, detail="Every selected question must belong to the set subject")
    db.query(models.QuestionSetItem).filter(models.QuestionSetItem.question_set_id == set_id).delete(synchronize_session=False)
    for position, question_id in enumerate(unique_ids):
        db.add(models.QuestionSetItem(question_set_id=set_id, question_id=question_id, position=position))
    question_set.status = "ready" if unique_ids else "draft"
    db.commit()
    db.refresh(question_set)
    log_activity(db, "Question Set Selection Saved", f"Saved {len(unique_ids)} question(s) in '{question_set.name}'.", "question_set")
    return serialize_question_set(question_set)


@app.post("/api/question-sets/{set_id}/duplicate", status_code=201)
def duplicate_question_set(set_id: int, db: Session = Depends(get_db)):
    source = db.query(models.QuestionSet).filter(models.QuestionSet.id == set_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Question set not found")
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
    return serialize_question_set(duplicate)


@app.delete("/api/question-sets/{set_id}")
def delete_question_set(set_id: int, db: Session = Depends(get_db)):
    question_set = db.query(models.QuestionSet).filter(models.QuestionSet.id == set_id).first()
    if not question_set:
        raise HTTPException(status_code=404, detail="Question set not found")
    set_name = question_set.name
    db.delete(question_set)
    db.commit()
    log_activity(db, "Question Set Deleted", f"Deleted question set '{set_name}'.", "question_set")
    return {"message": "Question set deleted successfully"}


@app.get("/api/history")
def get_history(user_id: int = None, email: str = None, db: Session = Depends(get_db)):
    query = db.query(models.ActivityLog).order_by(models.ActivityLog.created_at.desc())
    if not user_id and email:
        user = db.query(models.User).filter(func.lower(models.User.email) == email.strip().lower()).first()
        user_id = user.id if user else -1
    if user_id:
        query = query.filter(models.ActivityLog.user_id == user_id)
    logs = query.limit(100).all()
    return [
        {
            "id": log.id,
            "action": log.action,
            "details": log.details,
            "date": log.created_at.isoformat() if log.created_at else None,
            "type": log.type,
            "status": log.status,
        }
        for log in logs
    ]


@app.put("/api/questions/{question_id}")
async def update_question(
    question_id: int,
    question: str = Form(...),
    correct_answer: str = Form(...),
    explanation: str = Form(...),
    review_status: str = Form("needs_review"),
    difficulty: str = Form("moderate"),
    db: Session = Depends(get_db)
):
    q = db.query(models.GeneratedQuestion).filter(
        models.GeneratedQuestion.id == question_id
    ).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    db.add(models.QuestionVersion(snapshot={
        "question": q.question,
        "correct_answer": q.correct_answer,
        "explanation": q.explanation,
        "review_status": q.review_status,
        "difficulty": q.difficulty,
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
    db.commit()
    log_activity(db, "Question Updated", f"Updated question #{question_id} and review metadata.", "question")
    return {"message": "Question updated successfully"}


@app.get("/api/questions/{question_id}/versions")
def get_question_versions(question_id: int, db: Session = Depends(get_db)):
    return [
        {"id": version.id, "snapshot": version.snapshot, "created_at": version.created_at.isoformat() if version.created_at else None}
        for version in db.query(models.QuestionVersion).filter(models.QuestionVersion.question_id == question_id).order_by(models.QuestionVersion.created_at.desc()).all()
    ]


@app.post("/api/questions/{question_id}/versions/{version_id}/restore")
def restore_question_version(question_id: int, version_id: int, db: Session = Depends(get_db)):
    question = db.query(models.GeneratedQuestion).filter(models.GeneratedQuestion.id == question_id).first()
    version = db.query(models.QuestionVersion).filter(models.QuestionVersion.id == version_id, models.QuestionVersion.question_id == question_id).first()
    if not question or not version:
        raise HTTPException(status_code=404, detail="Question version not found")
    db.add(models.QuestionVersion(snapshot={
        "question": question.question,
        "correct_answer": question.correct_answer,
        "explanation": question.explanation,
        "review_status": question.review_status,
        "difficulty": question.difficulty,
    }, question_id=question.id))
    for field in ("question", "correct_answer", "explanation", "review_status", "difficulty"):
        setattr(question, field, version.snapshot.get(field))
    db.commit()
    log_activity(db, "Question Version Restored", f"Restored version {version_id} for question #{question_id}.", "question")
    return {"message": "Question version restored"}


@app.put("/api/questions/bulk")
def bulk_update_questions(
    question_ids: str = Form(...),
    review_status: str = Form(None),
    difficulty: str = Form(None),
    db: Session = Depends(get_db),
):
    selected_ids = [int(item.strip()) for item in (question_ids or "").split(",") if item.strip().isdigit()]
    if not selected_ids:
        raise HTTPException(status_code=400, detail="No valid question IDs were provided")
    if review_status is not None and review_status not in {"needs_review", "in_review", "approved"}:
        raise HTTPException(status_code=400, detail="Invalid review status")
    if difficulty is not None and difficulty not in {"easy", "moderate", "hard"}:
        raise HTTPException(status_code=400, detail="Invalid difficulty")
    questions = db.query(models.GeneratedQuestion).filter(models.GeneratedQuestion.id.in_(selected_ids)).all()
    if not questions:
        raise HTTPException(status_code=404, detail="No matching questions found")
    for question in questions:
        if review_status is not None:
            question.review_status = review_status
        if difficulty is not None:
            question.difficulty = difficulty
    db.commit()
    log_activity(db, "Updated Questions", f"Bulk updated {len(questions)} question review records.", "review")
    return {"updated": len(questions)}


@app.delete("/api/questions/{question_id}")
def delete_question(question_id: int, db: Session = Depends(get_db)):
    q = db.query(models.GeneratedQuestion).filter(
        models.GeneratedQuestion.id == question_id
    ).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    question_preview = q.question[:60] if q.question else f"Question #{question_id}"
    db.delete(q)
    db.commit()

    log_activity(db, "Deleted Question", f"Removed question: '{question_preview}'.", "delete")

    return {"message": "Question deleted successfully"}


@app.post("/api/questions/export/tos")
def export_question_bank_tos(
    subject_id: int = Form(...),
    question_ids: str = Form(...),
    exam_type: str = Form("Final Exam"),
    semester: str = Form("First Semester"),
    user_id: int | None = Form(None),
    db: Session = Depends(get_db),
):
    subject = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    selected_ids = [int(value) for value in (question_ids or "").split(",") if value.strip().isdigit()]
    questions = db.query(models.GeneratedQuestion).filter(
        models.GeneratedQuestion.id.in_(selected_ids),
        models.GeneratedQuestion.subject_id == subject_id,
    ).order_by(models.GeneratedQuestion.id).all()
    if not subject or not questions:
        raise HTTPException(status_code=404, detail="No questions selected for this subject")

    topics = {}
    for number, question in enumerate(questions, start=1):
        topic_name = question.topic_name or "General"
        topic = topics.setdefault(topic_name, {
            "topic_name": topic_name,
            "ilo": "",
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

    selected_topics = list(topics.values())
    total_hours = sum(topic["hours_a"] for topic in selected_topics)
    for topic in selected_topics:
        topic["weight"] = round(topic["hours_a"] / total_hours * 100, 2)
        topic["bloom_question_numbers"] = {
            level: ", ".join(numbers) for level, numbers in topic["bloom_question_numbers"].items()
        }

    workbook = generate_tos_from_excel_template(
        selected_topics, subject.code, subject.name, len(questions), exam_type=exam_type, semester=semester
    )
    stream = io.BytesIO()
    workbook.save(stream)
    log_activity(db, "Downloaded TOS", f"Downloaded a TOS for {len(questions)} selected question(s) from '{subject.name}'.", "download", user_id=user_id)
    return Response(
        content=stream.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={subject.name.replace(' ', '_')}_TOS.xlsx"},
    )

@app.post("/api/question-sets/{set_id}/export")
def export_question_set(
    set_id: int,
    export_format: str = Form("pdf"),
    include_answer_key: bool = Form(True),
    answer_mode: str = Form("with_key"),
    user_id: int | None = Form(None),
    db: Session = Depends(get_db),
):
    export_format = export_format.lower()
    if export_format not in {"pdf", "docx"}:
        raise HTTPException(status_code=400, detail="Export format must be pdf or docx")
    question_set = db.query(models.QuestionSet).filter(models.QuestionSet.id == set_id).first()
    if not question_set:
        raise HTTPException(status_code=404, detail="Question set not found")
    questions = [item.question for item in question_set.items if item.question]
    if not questions:
        raise HTTPException(status_code=400, detail="Add at least one question before exporting")
    pythoncom.CoInitialize()
    try:
        normalized_questions = [type("QuestionLike", (), {
            "question": question.question or "",
            "question_type": question.question_type or "",
            "options": question.options or [],
            "correct_answer": question.correct_answer or "",
            "left_items": matching_choices(question)[0] if question.question_type == "Matching Type" else [],
            "right_items": matching_choices(question)[1] if question.question_type == "Matching Type" else [],
        })() for question in questions]
        content, filename = build_assessment_document(normalized_questions, question_set.subject.name, export_format, include_answer_key=include_answer_key, answer_mode=answer_mode)
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
    finally:
        pythoncom.CoUninitialize()

@app.post("/api/questions/export")
def export_assessment(
    subject_id: int = Form(...),
    question_ids: str = Form(...),
    export_format: str = Form("pdf"),
    include_answer_key: bool = Form(True),
    answer_mode: str = Form("with_key"),
    user_id: int | None = Form(None),
    db: Session = Depends(get_db)
):
    pythoncom.CoInitialize()
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

        questions = db.query(models.GeneratedQuestion).filter(
            models.GeneratedQuestion.id.in_(selected_ids),
            models.GeneratedQuestion.subject_id == subject_id
        ).all()
        if not questions:
            raise HTTPException(status_code=404, detail="No questions selected")

        normalized_questions = []
        for question in questions:
            normalized_questions.append(type("QuestionLike", (), {
                "question": getattr(question, "question", "") or "",
                "question_type": getattr(question, "question_type", "") or "",
                "options": getattr(question, "options", None) or [],
                "correct_answer": getattr(question, "correct_answer", "") or "",
                "left_items": matching_choices(question)[0] if question.question_type == "Matching Type" else [],
                "right_items": matching_choices(question)[1] if question.question_type == "Matching Type" else [],
            })())

        content, filename = build_assessment_document(normalized_questions, subject.name, export_format.lower(), include_answer_key=include_answer_key, answer_mode=answer_mode)
        log_activity(db, "Assessment Exported", f"Exported {len(questions)} selected question(s) from '{subject.name}' as {export_format.upper()}.", "export", user_id=user_id)
        media_type = "application/pdf" if export_format.lower() == "pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        return Response(content=content, media_type=media_type, headers={"Content-Disposition": f"attachment; filename={filename}"})
    except HTTPException as exc:
        log_activity(db, "Assessment Export Failed", str(exc.detail), "export", status="error", user_id=user_id)
        raise
    except Exception as e:
        log_activity(db, "Assessment Export Failed", str(e), "export", status="error", user_id=user_id)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        pythoncom.CoUninitialize()

app.include_router(questions.router)
app.include_router(assessment.router)
app.include_router(assessment.export_router)
app.include_router(activity.router)
