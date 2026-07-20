from sqlalchemy import Column, Integer, String, Text, JSON, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    role = Column(String)
    archived = Column(Boolean, default=False, nullable=False)
    name = Column(String, nullable=True)         # <-- new
    department = Column(String, nullable=True)   # <-- new, only set for role == "faculty"

class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    code = Column(String(255), unique=True, nullable=True, index=True)
    created_at = Column(DateTime, server_default=func.now())

class Subject(Base):
    __tablename__ = "subjects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    code = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    department = relationship("Department")

class UploadedFile(Base):
    __tablename__ = "uploaded_files"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    module_filename = Column(String)
    syllabus_filename = Column(String)
    module_text = Column(Text)
    syllabus_text = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    subject = relationship("Subject")

class TableOfSpecification(Base):
    __tablename__ = "table_of_specification"
    id = Column(Integer, primary_key=True, index=True)
    upload_id = Column(Integer, ForeignKey("uploaded_files.id"))
    tos_data = Column(JSON)
    total_items = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())

class GeneratedQuestion(Base):
    __tablename__ = "generated_questions"
    id = Column(Integer, primary_key=True, index=True)
    tos_id = Column(Integer, ForeignKey("table_of_specification.id"))
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    bloom_level = Column(String)
    question_type = Column(String)
    question = Column(Text)
    options = Column(JSON, nullable=True)
    correct_answer = Column(Text)
    explanation = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

class AccountRequest(Base):
    __tablename__ = "account_requests"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False)
    department = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    status = Column(String(50), default="pending")
    created_at = Column(DateTime, server_default=func.now())

class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String)
    details = Column(Text)
    type = Column(String)       # "generate", "upload", "classify", "login"
    status = Column(String, default="success")   # "success", "error", "info"
    created_at = Column(DateTime, server_default=func.now())