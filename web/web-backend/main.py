from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

# Allow React frontend to talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------
# Temporary hardcoded users — replace with DB query later
# -------------------------------------------------------
FAKE_USERS = [
    {"email": "student@bloomquest.com", "password": "student123", "role": "student"},
    {"email": "admin@bloomquest.com",   "password": "admin123",   "role": "admin"},
]

class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/api/login")
def login(data: LoginRequest):
    # Find user by email and password
    user = next(
        (u for u in FAKE_USERS if u["email"] == data.email and u["password"] == data.password),
        None
    )

    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    # Return a fake token for now — replace with JWT later
    return {
        "token": "fake-token-for-now",
        "role": user["role"],
        "email": user["email"],
        "message": "Login successful"
    }

@app.get("/")
def root():
    return {"message": "BloomQuest API is running"}