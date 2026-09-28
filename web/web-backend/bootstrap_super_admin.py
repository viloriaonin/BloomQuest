import argparse
from datetime import datetime

from sqlalchemy import func

import models
from database import SessionLocal


def promote_existing_user(email: str) -> None:
    normalized_email = email.strip().lower()
    with SessionLocal() as db:
        user = db.query(models.User).filter(func.lower(models.User.email) == normalized_email).first()
        if not user:
            raise SystemExit(f"No existing account found for {normalized_email}.")
        if str(user.role).lower() not in {"admin", "campus_admin", "super_admin"}:
            raise SystemExit("Only an existing administrator account can be promoted to Super Admin.")

        user.role = "super_admin"
        user.campus_id = None
        user.archived = False
        db.query(models.UserSession).filter(
            models.UserSession.user_id == user.id,
            models.UserSession.revoked_at.is_(None),
        ).update({"revoked_at": datetime.utcnow()}, synchronize_session=False)
        db.commit()

    print(f"Promoted {normalized_email} to Super Admin. Sign in again to create campus administrators.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Promote an existing BloomQuest account to Super Admin.")
    parser.add_argument("email", help="Email address of the existing account to promote")
    promote_existing_user(parser.parse_args().email)