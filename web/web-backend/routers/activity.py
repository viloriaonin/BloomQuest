from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from database import get_db
from models import ActivityLog, User
import models
from security import get_current_user, visible_campus_id

router = APIRouter()

@router.get("/api/activity-logs")
def get_activity_logs(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = (
        db.query(ActivityLog, User)
        .outerjoin(User, ActivityLog.user_id == User.id)
    )
    role = str(current_user.role).lower()
    if role == "campus_admin":
        campus_id = visible_campus_id(current_user)
        scoped_user_ids = db.query(User.id).outerjoin(
            models.Program, models.Program.id == User.program_id
        ).outerjoin(
            models.Department, models.Department.id == models.Program.department_id
        ).filter(or_(User.campus_id == campus_id, models.Department.campus_id == campus_id))
        query = query.filter(ActivityLog.user_id.in_(scoped_user_ids))
    elif role != "super_admin":
        query = query.filter(ActivityLog.user_id == current_user.id)
    rows = query.order_by(desc(ActivityLog.created_at)).all()

    result = []
    for log, user in rows:
        result.append({
            "id": log.id,
            "name": user.name if user else "System",
            "dept": user.department if user else None,
            "role": user.role if user else "system",
            "action": log.action,
            "detail": log.details,
            "type": log.type,
            "status": log.status,
            "date": log.created_at.strftime("%Y-%m-%d"),
            "time": log.created_at.strftime("%I:%M %p"),
        })
    return result