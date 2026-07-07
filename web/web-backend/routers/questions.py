# routers/questions.py
from fastapi import APIRouter
from pydantic import BaseModel

# Note the prefix. This automatically adds /api/questions to all routes in this file.
router = APIRouter(prefix="/api/questions", tags=["Questions"])

class QuestionUpdate(BaseModel):
    question: str
    correct_answer: str
    bloom_level: str

# Since the prefix is /api/questions, we just need /{question_id} here
@router.put("/{question_id}")
async def update_question(question_id: int, data: QuestionUpdate):
    # Database logic here
    return {"status": "success", "message": "Taxonomy updated successfully", "id": question_id}