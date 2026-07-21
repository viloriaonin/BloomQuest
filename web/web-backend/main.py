from typing import Optional
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from dotenv import load_dotenv
from database import engine, get_db, SessionLocal
from file_extractor import extract_text
from ai_service import generate_questions_from_tos, build_preview, prepare_database_rows, statistics, parse_syllabus_text_with_ai
from routers.tos_utils import compute_tos
from classifier import classify_question
import models
from datetime import datetime, timedelta
import logging
import os
import random
from routers import assessment 
from routers import questions
from routers.assessment import build_assessment_docx, cleanup_file
from routers import activity
from pydantic import BaseModel
import secrets
import smtplib
import string
import pythoncom
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "database.env"))

models.Base.metadata.create_all(bind=engine)


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


def build_assessment_document(questions, subject_name, export_format):
    SubjectLike = type("SubjectLike", (), {"name": subject_name})
    docx_path = build_assessment_docx(SubjectLike(), questions)
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

# Ensure the new archive, name, and department columns exist in the users table.
# SQLAlchemy's create_all does not alter existing tables, so we add missing columns explicitly.
with engine.begin() as conn:
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE"))
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR"))
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR"))
    conn.execute(text("ALTER TABLE subjects ADD COLUMN IF NOT EXISTS department_id INTEGER"))

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
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LoginRequest(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class VerifyOtpRequest(BaseModel):
    email: str
    otp: str

class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str

# Pydantic schema for account request submissions
class AccountRequestPayload(BaseModel):
    full_name: str
    department: str
    email: str

class ContactAdminOtpRequest(BaseModel):
    full_name: str
    department: str
    email: str

class AccountActionRequest(BaseModel):
    email: str

class AdminVerifyRequest(BaseModel):
    admin_email: str
    admin_password: str
    target_email: str

class UpdatePasswordRequest(BaseModel):
    email: str
    new_password: str

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD", "")


def normalize_email(value: str) -> str:
    """Normalize and correct common typos in email addresses.

    - Trim whitespace
    - Lowercase
    - Replace common accidental separators (commas, semicolons) in the domain part with dots
    """
    raw = str(value or "").strip()
    if "@" not in raw:
        return raw.lower()

    local, sep, domain = raw.partition("@")
    # Replace commas/semicolons and collapse whitespace in domain
    domain = domain.replace(",", ".").replace(";", ".").replace(" ", "")
    return f"{local}@{domain}".lower()


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
    user = db.query(models.User).filter(models.User.email == data.email).first()
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
        return {
            "message": "A password reset code has been sent to your email address.",
            "demo_code": code,
        }

    return {
        "message": "A password reset code has been sent to your email address.",
    }

@app.post("/api/forgot-password/verify-otp")
def verify_otp(data: VerifyOtpRequest):
    _cleanup_otp(data.email)
    record = otp_store.get(data.email)
    if not record or record["otp"] != data.otp:
        raise HTTPException(status_code=400, detail="Incorrect or expired verification code.")

    return {"message": "OTP verified."}

@app.patch("/api/forgot-password/reset")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    _cleanup_otp(data.email)
    record = otp_store.get(data.email)
    if not record or record["otp"] != data.otp:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP.")

    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.password = data.new_password
    db.commit()
    otp_store.pop(data.email, None)

    return {"message": "Password has been reset successfully."}

@app.post("/api/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    # Find user in database
    user = db.query(models.User).filter(
        models.User.email == data.email,
        models.User.password == data.password
    ).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    log_activity(db, "System Login", f"Logged in as {user.email}.", "login", user_id=user.id)

    # Return response (replace with JWT later)
    return {
        "token": "fake-token-for-now",
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
        existing_user.password = temp_password
        existing_user.role = "faculty"
        existing_user.archived = False
        existing_user.department = department
        existing_user.name = full_name or existing_user.name
    else:
        new_user = models.User(
            email=normalized_email,
            password=temp_password,
            role="faculty",
            archived=False,
            name=full_name,
            department=department,
        )
        db.add(new_user)

    # remove the pending account request and commit
    db.delete(request_entry)
    db.commit()

    # send the approval email in the background with templated fields
    background_tasks.add_task(send_approval_email, normalized_email, temp_password, full_name, department)

    # fetch the user row we just created/updated to return a formatted user object
    created_user = db.query(models.User).filter(func.lower(models.User.email) == normalized_email).first()

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

    user.password = payload.new_password
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
    return {"message": "User archived successfully.", "status": "archived"}

@app.post("/api/users/restore")
def restore_user(payload: AccountActionRequest, db: Session = Depends(get_db)):
    normalized_email = normalize_email(payload.email)
    user = db.query(models.User).filter(func.lower(models.User.email) == normalized_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.archived = False
    db.commit()
    return {"message": "User restored successfully.", "status": "active"}

@app.post("/api/users/verify-admin-password")
def verify_admin_password(payload: AdminVerifyRequest, db: Session = Depends(get_db)):
    normalized_admin_email = normalize_email(payload.admin_email)
    admin_user = (
        db.query(models.User)
        .filter(func.lower(models.User.email) == normalized_admin_email,
                models.User.password == payload.admin_password,
                models.User.role == "admin")
        .first()
    )
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
    module_file: UploadFile = File(...),
    syllabus_file: UploadFile = File(...),
    subject_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    try:
        module_bytes = await module_file.read()
        syllabus_bytes = await syllabus_file.read()
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
    # Nullify references in dependent tables to avoid foreign key constraint errors
    db.query(models.GeneratedQuestion).filter(models.GeneratedQuestion.subject_id == subject_id).update({"subject_id": None})
    db.query(models.UploadedFile).filter(models.UploadedFile.subject_id == subject_id).update({"subject_id": None})
    db.delete(subject)
    db.commit()
    return {"message": "Subject deleted successfully."}

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

    log_activity(db, "Classified Question", f"Manual Input: '{payload.question[:60]}' → Categorized as {bloom_level}.", "classify")

    return {
        "id": new_question.id,
        "bloom_level": bloom_level,
        "message": f"Successfully classified question under {bloom_level} tier!"
    }

@app.get("/api/subjects")
def get_subjects(db: Session = Depends(get_db)):
    return db.query(models.Subject).all()


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
    return query.all()


@app.get("/api/history")
def get_history(user_id: int = None, db: Session = Depends(get_db)):
    query = db.query(models.ActivityLog).order_by(models.ActivityLog.created_at.desc())
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
    db: Session = Depends(get_db)
):
    q = db.query(models.GeneratedQuestion).filter(
        models.GeneratedQuestion.id == question_id
    ).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    q.question = question
    q.correct_answer = correct_answer
    q.explanation = explanation
    db.commit()
    return {"message": "Question updated successfully"}


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

@app.post("/api/questions/export")
def export_assessment(
    subject_id: int = Form(...),
    question_ids: str = Form(...),
    export_format: str = Form("pdf"),
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
            })())

        content, filename = build_assessment_document(normalized_questions, subject.name, export_format.lower())
        media_type = "application/pdf" if export_format.lower() == "pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        return Response(content=content, media_type=media_type, headers={"Content-Disposition": f"attachment; filename={filename}"})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        pythoncom.CoUninitialize()

app.include_router(questions.router)
app.include_router(assessment.router)
app.include_router(assessment.export_router)
app.include_router(activity.router)
