from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from database import get_db
from models import ActivityLog, User
import models
from security import get_current_user, visible_campus_id, user_campus_id

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

    attributed_user_ids = {
        log.target_user_id or log.user_id or log.actor_id
        for log, _user in rows
        if log.target_user_id or log.user_id or log.actor_id
    }
    attributed_users = db.query(User).filter(User.id.in_(attributed_user_ids)).all() if attributed_user_ids else []
    campus_by_user_id = {user.id: user_campus_id(db, user) for user in attributed_users}
    attributed_user_by_id = {user.id: user for user in attributed_users}
    campus_ids = {campus_id for campus_id in campus_by_user_id.values() if campus_id is not None}
    campus_names = {
        campus.id: campus.name
        for campus in db.query(models.Campus).filter(models.Campus.id.in_(campus_ids)).all()
    } if campus_ids else {}
    program_ids = {user.program_id for user in attributed_users if user.program_id is not None}
    department_id_by_program_id = {
        program.id: program.department_id
        for program in db.query(models.Program).filter(models.Program.id.in_(program_ids)).all()
    } if program_ids else {}
    assigned_department_ids = {
        user.admin_department_id for user in attributed_users if user.admin_department_id is not None
    }
    department_id_by_campus_and_name = {
        (department.campus_id, department.name.strip().casefold()): department.id
        for department in db.query(models.Department).filter(models.Department.campus_id.in_(campus_ids)).all()
    } if campus_ids else {}
    departments_by_id = {
        department.id: department
        for department in db.query(models.Department).filter(
            models.Department.id.in_(assigned_department_ids)
        ).all()
    } if assigned_department_ids else {}

    result = []
    for log, user in rows:
        attributed_user_id = log.target_user_id or log.user_id or log.actor_id
        attributed_user = attributed_user_by_id.get(attributed_user_id)
        campus_id = campus_by_user_id.get(attributed_user_id)
        program_id = attributed_user.program_id if attributed_user else None
        department_id = department_id_by_program_id.get(program_id)
        if department_id is None and attributed_user:
            department_id = attributed_user.admin_department_id
        if department_id is None and attributed_user and campus_id is not None and attributed_user.department:
            department_id = department_id_by_campus_and_name.get(
                (campus_id, attributed_user.department.strip().casefold())
            )
        assigned_department = departments_by_id.get(department_id)
        result.append({
            "id": log.id,
            "user_id": attributed_user_id,
            "program_id": program_id,
            "department_id": department_id,
            "name": (attributed_user.name or attributed_user.email) if attributed_user else (user.name if user else "System"),
            "dept": attributed_user.department if attributed_user else (user.department if user else None),
            "role": attributed_user.role if attributed_user else (user.role if user else "system"),
            "campus_id": campus_id,
            "campus": campus_names.get(campus_id) or (assigned_department and campus_names.get(assigned_department.campus_id)),
            "action": log.action,
            "detail": log.details,
            "type": log.type,
            "status": log.status,
            "date": log.created_at.strftime("%Y-%m-%d"),
            "time": log.created_at.strftime("%I:%M %p"),
        })
    return result