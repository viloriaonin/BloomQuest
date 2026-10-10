import hashlib
from datetime import datetime

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models


def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    token_hash = hashlib.sha256(authorization.split(" ", 1)[1].strip().encode()).hexdigest()
    session = db.query(models.UserSession).filter(
        models.UserSession.token_hash == token_hash,
        models.UserSession.revoked_at.is_(None),
        models.UserSession.expires_at > datetime.utcnow(),
    ).first()
    if not session:
        raise HTTPException(status_code=401, detail="Session expired or replaced by another login")

    user = db.query(models.User).filter(
        models.User.id == session.user_id,
        models.User.archived.is_(False),
    ).first()
    if not user:
        raise HTTPException(status_code=401, detail="Account is inactive")

    campus_id = user_campus_id(db, user)
    if campus_id is not None:
        campus = db.query(models.Campus).filter(models.Campus.id == campus_id).first()
        if not campus or not campus.is_active:
            raise HTTPException(status_code=403, detail="This campus is inactive")

    session.last_used_at = datetime.utcnow()
    db.commit()
    return user


def get_optional_current_user(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization:
        return None
    return get_current_user(authorization=authorization, db=db)


def require_super_admin(user: models.User = Depends(get_current_user)):
    if str(user.role).lower() != "super_admin":
        raise HTTPException(status_code=403, detail="Super administrator access required")
    return user


def require_campus_admin(user: models.User = Depends(get_current_user)):
    role = str(user.role).lower()
    if role not in {"admin", "campus_admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Campus administrator access required")
    if role in {"admin", "campus_admin"} and not user.campus_id:
        raise HTTPException(status_code=403, detail="A campus assignment is required")
    return user


def require_campus_admin_user(user: models.User = Depends(get_current_user)):
    role = str(user.role).lower()
    if role not in {"admin", "campus_admin"}:
        raise HTTPException(status_code=403, detail="Campus administrator access required")
    if not user.campus_id:
        raise HTTPException(status_code=403, detail="A campus assignment is required")
    return user


def require_admin(user: models.User = Depends(get_current_user)):
    role = str(user.role).lower()
    if role not in {"super_admin", "campus_admin", "admin"}:
        raise HTTPException(status_code=403, detail="Administrator access required")
    if role in {"admin", "campus_admin"} and not user.campus_id:
        raise HTTPException(status_code=403, detail="A campus assignment is required")
    return user


def require_academic_admin(user: models.User = Depends(get_current_user)):
    role = str(user.role).lower()
    if role == "department_admin":
        if not user.admin_department_id:
            raise HTTPException(status_code=403, detail="A department assignment is required.")
        return user
    return require_admin(user)


def require_admin_workspace(user: models.User = Depends(get_current_user)):
    role = str(user.role).lower()
    if role == "department_admin":
        if not user.admin_department_id:
            raise HTTPException(status_code=403, detail="A department assignment is required.")
        return user
    return require_admin(user)


def assert_campus_access(user: models.User, campus_id: int) -> None:
    role = str(user.role).lower()
    if role == "super_admin":
        return
    if role in {"admin", "campus_admin"} and user.campus_id == campus_id:
        return
    raise HTTPException(status_code=403, detail="You do not have access to this campus")


def assert_department_access(user: models.User, department: models.Department) -> None:
    if str(user.role).lower() == "department_admin":
        if user.admin_department_id != department.id:
            raise HTTPException(status_code=403, detail="You do not have access to this department.")
        return
    assert_campus_access(user, department.campus_id)


def visible_campus_id(user: models.User) -> int | None:
    if str(user.role).lower() == "super_admin":
        return None
    if str(user.role).lower() in {"admin", "campus_admin"} and user.campus_id:
        return user.campus_id
    raise HTTPException(status_code=403, detail="Campus-scoped administrator access required")


def user_campus_id(db: Session, user: models.User) -> int | None:
    role = str(user.role).lower()
    if role == "super_admin":
        return None
    if role == "department_admin":
        if user.admin_department_id:
            return db.query(models.Department.campus_id).filter(
                models.Department.id == user.admin_department_id
            ).scalar()
        return None
    if role in {"admin", "campus_admin"}:
        return visible_campus_id(user)
    if user.campus_id:
        return user.campus_id
    if user.program_id:
        return (
            db.query(models.Department.campus_id)
            .join(models.Program, models.Program.department_id == models.Department.id)
            .filter(models.Program.id == user.program_id)
            .scalar()
        )
    if user.department:
        return db.query(models.Department.campus_id).filter(
            models.Department.name.ilike(user.department.strip())
        ).scalar()
    return None


def subject_campus_id(db: Session, subject: models.Subject) -> int | None:
    if subject.program_id:
        campus_id = db.query(models.Department.campus_id).join(
            models.Program, models.Program.department_id == models.Department.id
        ).filter(models.Program.id == subject.program_id).scalar()
        if campus_id is not None:
            return campus_id
    if subject.department_id:
        campus_id = db.query(models.Department.campus_id).filter(
            models.Department.id == subject.department_id
        ).scalar()
        if campus_id is not None:
            return campus_id
    if subject.user_id:
        owner = db.query(models.User).filter(models.User.id == subject.user_id).first()
        return user_campus_id(db, owner) if owner else None
    return None


def assert_user_subject_campus_access(db: Session, user: models.User, subject: models.Subject) -> None:
    role = str(user.role).lower()
    if role == "department_admin":
        department_id = subject.department_id
        if department_id is None and subject.program_id:
            department_id = db.query(models.Program.department_id).filter(
                models.Program.id == subject.program_id
            ).scalar()
        if department_id != user.admin_department_id:
            raise HTTPException(status_code=403, detail="You can only use subjects in your assigned department.")
        return
    if role not in {"faculty", "student"}:
        return
    actor_campus_id = user_campus_id(db, user)
    if actor_campus_id is None or subject_campus_id(db, subject) != actor_campus_id:
        raise HTTPException(status_code=403, detail="You can only generate questions for subjects in your assigned campus.")