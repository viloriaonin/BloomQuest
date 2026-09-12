"""
Input validation module for BloomQuest backend.
Provides comprehensive validation for file uploads, generation requests, and API inputs.
"""

import logging

logger = logging.getLogger(__name__)


class QuestionGenerationValidator:
    """Validates inputs for question generation pipeline"""
    
    @staticmethod
    def validate_topics_selected(topics: list[int] | None) -> bool:
        """Ensure at least one topic is selected"""
        if not topics or len(topics) == 0:
            logger.error("Validation failed: No topics selected for generation")
            return False
        return True
    
    @staticmethod
    def validate_questions_selected(questions: list[int] | None) -> bool:
        """Ensure at least one question is selected"""
        if not questions or len(questions) == 0:
            logger.error("Validation failed: No questions selected")
            return False
        return True
    
    @staticmethod
    def validate_hours_values(hours_dict: dict[str, str] | None) -> tuple[bool, str]:
        """Validate that all topics have positive hour values"""
        if not hours_dict:
            return False, "Hours configuration is missing"
        
        for topic_id, hours_str in hours_dict.items():
            try:
                hours = float(hours_str)
                if hours <= 0:
                    return False, f"Topic {topic_id}: Hours must be positive (got {hours})"
                if hours > 999:
                    return False, f"Topic {topic_id}: Hours value too large (max 999)"
            except (ValueError, TypeError):
                return False, f"Topic {topic_id}: Invalid hours value '{hours_str}' (must be numeric)"
        
        return True, "Valid"
    
    @staticmethod
    def validate_total_items(total_items: int | None) -> tuple[bool, str]:
        """Validate total items is a positive integer"""
        if total_items is None:
            return False, "Total items not specified"
        try:
            items = int(total_items)
            if items <= 0:
                return False, "Total items must be greater than 0"
            if items > 1000:
                return False, "Total items cannot exceed 1000"
            return True, "Valid"
        except (ValueError, TypeError):
            return False, f"Invalid total items value: {total_items}"
    
    @staticmethod
    def validate_question_types(types_list: list[str] | None) -> tuple[bool, str]:
        """Validate question types are recognized"""
        valid_types = {
            'MCQ', 'True or False', 'Identification', 'Matching Type',
            'Enumeration', 'Essay', 'Situational', 'Short Answer', 'True/False'
        }
        
        if not types_list or len(types_list) == 0:
            return False, "At least one question type must be selected"
        
        for qtype in types_list:
            if qtype not in valid_types:
                return False, f"Unknown question type: {qtype}"
        
        return True, "Valid"
    
    @staticmethod
    def validate_exam_type(exam_type: str) -> tuple[bool, str]:
        """Validate exam type is recognized"""
        valid_types = {'Midterm Exam', 'Preliminary Exam', 'Final Exam', 'Quiz', 'Long Exam'}
        
        if not exam_type:
            return False, "Exam type is required"
        if exam_type not in valid_types:
            return False, f"Unknown exam type: {exam_type}"
        
        return True, "Valid"
    
    @staticmethod
    def validate_semester(semester: str) -> tuple[bool, str]:
        """Validate semester is recognized"""
        valid_semesters = {'First Semester', 'Second Semester', 'Midterm Class'}
        
        if not semester:
            return False, "Semester is required"
        if semester not in valid_semesters:
            return False, f"Unknown semester: {semester}"
        
        return True, "Valid"


class FileValidation:
    """Validates file uploads and formats"""
    
    ALLOWED_EXTENSIONS = {".pdf", ".docx", ".pptx", ".xlsx", ".xls"}
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    MIN_FILE_SIZE = 100  # 100 bytes
    
    @staticmethod
    def validate_file_extension(filename: str) -> tuple[bool, str]:
        """Check if file extension is allowed"""
        if not filename:
            return False, "Filename is required"
        
        filename_lower = filename.lower()
        ext = None
        for allowed_ext in FileValidation.ALLOWED_EXTENSIONS:
            if filename_lower.endswith(allowed_ext):
                ext = allowed_ext
                break
        
        if not ext:
            return False, f"File type not allowed. Use: {', '.join(FileValidation.ALLOWED_EXTENSIONS)}"
        
        return True, "Valid"
    
    @staticmethod
    def validate_file_size(file_size: int) -> tuple[bool, str]:
        """Check if file size is within limits"""
        if file_size < FileValidation.MIN_FILE_SIZE:
            return False, f"File is too small (minimum {FileValidation.MIN_FILE_SIZE} bytes)"
        if file_size > FileValidation.MAX_FILE_SIZE:
            return False, f"File is too large (maximum {FileValidation.MAX_FILE_SIZE // 1024 // 1024}MB)"
        
        return True, "Valid"
    
    @staticmethod
    def validate_file_content(file_bytes: bytes) -> tuple[bool, str]:
        """Basic validation of file content"""
        if not file_bytes or len(file_bytes) == 0:
            return False, "File is empty"
        
        # Check for null bytes (possible corruption)
        if b'\x00' * 100 in file_bytes:
            return False, "File appears to be corrupted (contains excessive null bytes)"
        
        return True, "Valid"


def validate_generation_request(
    upload_id: str,
    total_items: int | None,
    question_types: list[str] | None,
    selected_topics: list[int] | None,
    hours_dict: dict[str, str] | None,
    exam_type: str | None,
    semester: str | None,
    selected_questions: list[int] | None = None,
) -> tuple[bool, str]:
    """
    Comprehensive validation of generation request.
    Returns (is_valid, error_message)
    """
    
    if not upload_id or len(upload_id.strip()) == 0:
        return False, "Upload ID is required"
    
    # Validate topics
    if not QuestionGenerationValidator.validate_topics_selected(selected_topics):
        return False, "Please select at least one topic to generate"
    
    # Validate questions only when a caller supplies a separate question list.
    if selected_questions is not None and not QuestionGenerationValidator.validate_questions_selected(selected_questions):
        return False, "No questions available for generation"
    
    # Validate total items
    is_valid, msg = QuestionGenerationValidator.validate_total_items(total_items)
    if not is_valid:
        return False, msg
    
    # Validate question types
    is_valid, msg = QuestionGenerationValidator.validate_question_types(question_types)
    if not is_valid:
        return False, msg
    
    # Validate hours
    is_valid, msg = QuestionGenerationValidator.validate_hours_values(hours_dict)
    if not is_valid:
        return False, msg
    
    # Validate exam type
    is_valid, msg = QuestionGenerationValidator.validate_exam_type(exam_type)
    if not is_valid:
        return False, msg
    
    # Validate semester
    is_valid, msg = QuestionGenerationValidator.validate_semester(semester)
    if not is_valid:
        return False, msg
    
    return True, "All validations passed"
