from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models import ActivityLog, User

router = APIRouter()

@router.get("/api/activity-logs")
def get_activity_logs(db: Session = Depends(get_db)):
    rows = (
        db.query(ActivityLog, User)
        .outerjoin(User, ActivityLog.user_id == User.id)
        .order_by(desc(ActivityLog.created_at))
        .all()
    )

    result = []
    for log, user in rows:
        result.append({
            "id": log.id,
            "name": user.name if user else "System",
            "dept": user.department if user else None,
            "action": log.action,
            "detail": log.details,
            "type": log.type,
            "status": log.status,
            "date": log.created_at.strftime("%Y-%m-%d"),
            "time": log.created_at.strftime("%I:%M %p"),
        })
    return result