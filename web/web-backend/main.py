from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from dotenv import load_dotenv
from database import engine, get_db
from file_extractor import extract_text
from ai_service import detect_subject, detect_topics, compute_tos, generate_questions_from_tos
from classifier import classify_question
import models
from datetime import datetime, timedelta
import os
import random
from routers import assessment 
from routers import questions
from pydantic import BaseModel
import secrets
import smtplib
import string
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "database.env"))
from assessment_export import build_assessment_document

models.Base.metadata.create_all(bind=engine)

# Ensure the new archive flag exists in the users table for soft-deletion support.
with engine.begin() as conn:
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE"))

app = FastAPI()

otp_store = {}

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
    return str(value).strip().lower()


def generate_temporary_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def send_approval_email(recipient_email: str, temporary_password: str):
    if not SENDER_EMAIL or not SENDER_PASSWORD:
        print(f"SMTP credentials are not configured. Approval email for {recipient_email} was not sent.")
        return

    try:
        msg = MIMEMultipart()
        msg["From"] = SENDER_EMAIL
        msg["To"] = recipient_email
        msg["Subject"] = "BloomQuest Account Approved & Created"

        body = f"""
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #B01C1C;">Welcome to BloomQuest!</h2>
            <p>Great news! Your administrator request has been approved, and your official account has been configured.</p>
            <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0;"><strong>Username / Email:</strong> {recipient_email}</p>
              <p style="margin: 0;"><strong>Temporary Password:</strong> <code style="background: #FFF; padding: 2px 6px; border: 1px solid #DDD; font-size: 1.1em;">{temporary_password}</code></p>
            </div>
            <p style="color: #EF4444; font-size: 0.9em;"><em>Note: For your profile security, please update this password immediately upon logging in for the first time.</em></p>
            <p>Best Regards,<br/><strong>BloomQuest Admin Team</strong></p>
          </body>
        </html>
        """
        msg.attach(MIMEText(body, "html"))

        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.send_message(msg)
    except Exception as exc:
        print(f"Failed to deliver account creation email: {exc}")

def _cleanup_otp(email: str):
    record = otp_store.get(email)
    if record and record["expires_at"] < datetime.utcnow():
        otp_store.pop(email, None)

@app.get("/")
def root():
    return {"message": "Welcome to the API"}

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
    # In production, send the code by email here.
    print(f"[DEBUG] OTP for {data.email}: {code}")

    return {
        "message": "A password reset code has been sent to your email address.",
        "otp": code
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
        "full_name": user.email.split("@", 1)[0],
        "department": "N/A",
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

    temp_password = generate_temporary_password()

    existing_user = db.query(models.User).filter(func.lower(models.User.email) == normalized_email).first()
    if existing_user:
        existing_user.password = temp_password
        existing_user.role = "faculty"
        existing_user.archived = False
    else:
        new_user = models.User(
            email=normalized_email,
            password=temp_password,
            role="faculty",
            archived=False,
        )
        db.add(new_user)

    db.delete(request_entry)
    db.commit()

    background_tasks.add_task(send_approval_email, str(payload.email), temp_password)

    # fetch the user row we just created/updated to return a formatted user object
    created_user = db.query(models.User).filter(func.lower(models.User.email) == normalized_email).first()

    formatted = None
    if created_user:
        formatted = {
            "id": created_user.id,
            "full_name": created_user.email.split("@", 1)[0],
            "department": "N/A",
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

@app.post("/api/contact-admin")
def submit_account_request(payload: AccountRequestPayload, db: Session = Depends(get_db)):
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

    new_request = models.AccountRequest(
        full_name=payload.full_name,
        department=payload.department,
        email=normalized_email,
        status="pending"
    )
    db.add(new_request)
    db.commit()
    db.refresh(new_request)
    
    return {"message": "Ticket created successfully", "status": "pending"}


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
    db: Session = Depends(get_db)
):
    try:
        module_bytes = await module_file.read()
        syllabus_bytes = await syllabus_file.read()
        module_text = extract_text(module_bytes, module_file.filename)
        syllabus_text = extract_text(syllabus_bytes, syllabus_file.filename)

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

        return {
            "upload_id": upload.id,
            "subject": subject_info,
            "topics": topics_data["topics"],
            "message": "Files uploaded! Now enter total number of items."
        }
    except Exception as e:
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
        tos = compute_tos(total_items, topics_data["topics"], selected_question_types=selected_question_types)

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
            upload.module_text,
            upload.syllabus_text,
            tos,
            subject.name,
            selected_question_types=selected_question_types
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


@app.get("/api/subjects")
def get_subjects(db: Session = Depends(get_db)):
    return db.query(models.Subject).all()


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
    db.delete(q)
    db.commit()
    return {"message": "Question deleted successfully"}

@app.post("/api/questions/export")
def export_assessment(
    subject_id: int = Form(...),
    question_ids: str = Form(...),
    export_format: str = Form("pdf"),
    db: Session = Depends(get_db)
):
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

app.include_router(questions.router)
app.include_router(assessment.router)
