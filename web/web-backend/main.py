from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import engine, get_db
from file_extractor import extract_text
from ai_service import detect_subject, detect_topics, compute_tos, generate_questions_from_tos
from classifier import classify_question
import models
from datetime import datetime, timedelta
import random
from routers import assessment 
from routers import questions
from pydantic import BaseModel

models.Base.metadata.create_all(bind=engine)

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
    db: Session = Depends(get_db)
):
    try:
        upload = db.query(models.UploadedFile).filter(
            models.UploadedFile.id == upload_id
        ).first()
        if not upload:
            raise HTTPException(status_code=404, detail="Upload not found")

        topics_data = detect_topics(upload.syllabus_text, upload.module_text)
        tos = compute_tos(total_items, topics_data["topics"])

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
            subject.name
        )

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

app.include_router(questions.router)
app.include_router(assessment.router)
