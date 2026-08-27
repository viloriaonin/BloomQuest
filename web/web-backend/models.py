from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON, LargeBinary, UniqueConstraint
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
    created_at = Column(DateTime, server_default=func.now())

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
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    archived = Column(Boolean, nullable=False, default=False, server_default="false")
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
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    bloom_level = Column(String)
    question_type = Column(String)
    question = Column(Text)
    options = Column(JSON, nullable=True)
    correct_answer = Column(Text)
    explanation = Column(Text)
    topic_name = Column(String, nullable=True)  # 🌟 Added column to record topic origin metadata
    review_status = Column(String(32), nullable=False, default="needs_review", server_default="needs_review")
    lifecycle_status = Column(String(32), nullable=False, default="draft", server_default="draft")
    difficulty = Column(String(32), nullable=False, default="moderate", server_default="moderate")
    archived = Column(Boolean, nullable=False, default=False, server_default="false")
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
    filename = Column(String(255), nullable=True)
    media_type = Column(String(255), nullable=True)
    file_content = Column(LargeBinary, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class QuestionSet(Base):
    __tablename__ = "question_sets"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    status = Column(String(32), nullable=False, default="draft", server_default="draft")
    exam_title = Column(String(255), nullable=True)
    instructions = Column(Text, nullable=True)
    total_points = Column(Integer, nullable=True)
    time_limit = Column(String(64), nullable=True)
    instructor_name = Column(String(255), nullable=True)
    department = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    subject = relationship("Subject")
    items = relationship("QuestionSetItem", cascade="all, delete-orphan", order_by="QuestionSetItem.position")
    exports = relationship("QuestionSetExport", cascade="all, delete-orphan", order_by="QuestionSetExport.created_at.desc()")

class QuestionSetItem(Base):
    __tablename__ = "question_set_items"
    id = Column(Integer, primary_key=True, index=True)
    question_set_id = Column(Integer, ForeignKey("question_sets.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("generated_questions.id"), nullable=False)
    position = Column(Integer, nullable=False, default=0)
    question = relationship("GeneratedQuestion")
    __table_args__ = (UniqueConstraint("question_set_id", "question_id", name="uq_question_set_question"),)

class QuestionSetExport(Base):
    __tablename__ = "question_set_exports"
    id = Column(Integer, primary_key=True, index=True)
    question_set_id = Column(Integer, ForeignKey("question_sets.id"), nullable=False)
    export_format = Column(String(16), nullable=False)
    filename = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

class QuestionVersion(Base):
    __tablename__ = "question_versions"
    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("generated_questions.id"), nullable=False)
    snapshot = Column(JSON, nullable=False)
    filename = Column(String(255), nullable=True)
    media_type = Column(String(255), nullable=True)
    file_content = Column(LargeBinary, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class UserSession(Base):
    __tablename__ = "user_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String(128), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())
    last_used_at = Column(DateTime, server_default=func.now())
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)