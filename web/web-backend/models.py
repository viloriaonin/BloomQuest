from sqlalchemy import Column, Integer, String, Text, JSON, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    role = Column(String)

class Subject(Base):
    __tablename__ = "subjects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    code = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

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