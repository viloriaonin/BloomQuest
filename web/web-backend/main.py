from datetime import datetime, timedelta
import random

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import engine, get_db
import models

# Create tables automatically
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

otp_store = {}

# Allow React frontend to talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
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