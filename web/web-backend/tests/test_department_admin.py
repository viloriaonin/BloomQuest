import os
import sys

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import models
from database import Base, get_db
from main import app, hash_password, verify_password
from security import assert_user_subject_campus_access, get_current_user


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def with_test_dependencies(db_session, user):
    def override_db():
        yield db_session

    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: user
    return previous


def test_department_admin_can_manage_only_assigned_academic_data(db_session):
    campus = models.Campus(name="Test Campus", code="TEST")
    db_session.add(campus)
    db_session.flush()
    assigned_department = models.Department(name="Assigned Department", campus_id=campus.id)
    other_department = models.Department(name="Other Department", campus_id=campus.id)
    db_session.add_all([assigned_department, other_department])
    db_session.flush()
    assigned_program = models.Program(name="Assigned Program", department_id=assigned_department.id)
    other_program = models.Program(name="Other Program", department_id=other_department.id)
    db_session.add_all([assigned_program, other_program])
    db_session.flush()
    assigned_subject = models.Subject(
        name="Assigned Subject",
        department_id=assigned_department.id,
        program_id=assigned_program.id,
    )
    other_subject = models.Subject(
        name="Other Subject",
        department_id=other_department.id,
        program_id=other_program.id,
    )
    db_session.add_all([assigned_subject, other_subject])
    department_admin = models.User(
        email="department-admin@example.com",
        password=hash_password("department-password"),
        role="department_admin",
        campus_id=campus.id,
        admin_department_id=assigned_department.id,
        archived=False,
    )
    db_session.add(department_admin)
    db_session.commit()

    assert_user_subject_campus_access(db_session, department_admin, assigned_subject)
    with pytest.raises(HTTPException) as error:
        assert_user_subject_campus_access(db_session, department_admin, other_subject)
    assert error.value.status_code == 403

    previous = with_test_dependencies(db_session, department_admin)
    try:
        with TestClient(app) as client:
            hierarchy = client.get("/api/academic-hierarchy")
            assert hierarchy.status_code == 200
            visible_departments = [
                department
                for visible_campus in hierarchy.json()["campuses"]
                for department in visible_campus["departments"]
            ]
            assert [department["id"] for department in visible_departments] == [assigned_department.id]

            subjects = client.get("/api/subjects")
            assert subjects.status_code == 200
            assert {subject["name"] for subject in subjects.json()} == {"Assigned Subject"}

            created_program = client.post("/api/programs", json={
                "name": "New Program",
                "department_id": assigned_department.id,
            })
            assert created_program.status_code == 201

            denied_program = client.post("/api/programs", json={
                "name": "Unauthorized Program",
                "department_id": other_department.id,
            })
            assert denied_program.status_code == 403

            dean_update = client.put(
                f"/api/departments/{assigned_department.id}/dean",
                json={"name": "Assigned Dean"},
            )
            assert dean_update.status_code == 200

            denied_dean_update = client.put(
                f"/api/departments/{other_department.id}/dean",
                json={"name": "Unauthorized Dean"},
            )
            assert denied_dean_update.status_code == 403

            created_subject = client.post("/api/subjects", json={
                "name": "New Subject",
                "department_id": assigned_department.id,
                "program_id": assigned_program.id,
            })
            assert created_subject.status_code == 201

            denied_subject = client.post("/api/subjects", json={
                "name": "Unauthorized Subject",
                "department_id": other_department.id,
                "program_id": other_program.id,
            })
            assert denied_subject.status_code == 403

            denied_admin_view = client.get("/api/admin/insights")
            assert denied_admin_view.status_code == 403
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)


def test_super_admin_can_create_department_admin_with_scoped_department(db_session, monkeypatch):
    campus = models.Campus(name="Admin Campus", code="ADMIN")
    db_session.add(campus)
    db_session.flush()
    department = models.Department(name="Managed Department", campus_id=campus.id)
    super_admin = models.User(
        email="super-admin@example.com",
        password=hash_password("super-password"),
        role="super_admin",
        archived=False,
    )
    db_session.add_all([department, super_admin])
    db_session.commit()
    monkeypatch.setattr("main.log_activity", lambda *args, **kwargs: None)

    previous = with_test_dependencies(db_session, super_admin)
    try:
        with TestClient(app) as client:
            response = client.post("/api/super-admin/department-admins", json={
                "name": "Department Admin",
                "email": "new-admin@example.com",
                "password": "new-admin-password",
                "department_id": department.id,
            })
            assert response.status_code == 201
            created_user = db_session.query(models.User).filter_by(
                email="new-admin@example.com"
            ).one()
            assert created_user.role == "department_admin"
            assert created_user.admin_department_id == department.id
            assert created_user.campus_id == campus.id
            assert verify_password("new-admin-password", created_user.password)
            assert response.json()["department"] == department.name
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)


def test_department_admin_manages_department_faculty_and_submits_requests(db_session, monkeypatch):
    campus = models.Campus(name="Faculty Campus", code="FAC")
    db_session.add(campus)
    db_session.flush()
    department = models.Department(name="Managed Department", campus_id=campus.id)
    other_department = models.Department(name="Other Department", campus_id=campus.id)
    db_session.add_all([department, other_department])
    db_session.flush()
    program = models.Program(name="Managed Program", department_id=department.id)
    other_program = models.Program(name="Other Program", department_id=other_department.id)
    db_session.add_all([program, other_program])
    db_session.flush()
    faculty = models.User(
        email="faculty@example.com",
        name="Faculty Member",
        role="faculty",
        department=department.name,
        campus_id=campus.id,
        archived=False,
    )
    other_faculty = models.User(
        email="other-faculty@example.com",
        name="Other Faculty",
        role="faculty",
        department=other_department.name,
        campus_id=campus.id,
        archived=False,
    )
    department_admin = models.User(
        email="department-admin@example.com",
        role="department_admin",
        campus_id=campus.id,
        admin_department_id=department.id,
        archived=False,
    )
    db_session.add_all([faculty, other_faculty, department_admin])
    db_session.flush()
    subject = models.Subject(
        name="Managed Subject",
        department_id=department.id,
        program_id=program.id,
    )
    db_session.add(subject)
    db_session.commit()
    monkeypatch.setattr("main.log_activity", lambda *args, **kwargs: None)

    previous = with_test_dependencies(db_session, department_admin)
    try:
        with TestClient(app) as client:
            profile = client.put(
                "/api/user/profile",
                json={"full_name": "Department Administrator"},
            )
            assert profile.status_code == 200
            assert profile.json()["full_name"] == "Department Administrator"
            assert profile.json()["department"] == department.name

            denied_profile_assignment = client.put(
                "/api/user/profile",
                json={"full_name": "Department Administrator", "program_id": program.id},
            )
            assert denied_profile_assignment.status_code == 403

            assignment = client.put(
                f"/api/faculty/{faculty.id}/program",
                json={"program_id": program.id},
            )
            assert assignment.status_code == 200
            assert assignment.json()["program_id"] == program.id

            chair_assignment = client.put(
                f"/api/programs/{program.id}/chair",
                json={"faculty_id": faculty.id},
            )
            assert chair_assignment.status_code == 200
            assert chair_assignment.json()["chair_id"] == faculty.id

            denied_assignment = client.put(
                f"/api/faculty/{other_faculty.id}/program",
                json={"program_id": program.id},
            )
            assert denied_assignment.status_code == 403

            subject_assignment = client.put(
                f"/api/subjects/{subject.id}/faculty",
                json={"faculty_id": faculty.id},
            )
            assert subject_assignment.status_code == 200
            assert subject_assignment.json()["faculty_id"] == faculty.id

            denied_subject_assignment = client.put(
                f"/api/subjects/{subject.id}/faculty",
                json={"faculty_id": other_faculty.id},
            )
            assert denied_subject_assignment.status_code == 400

            moved_subject = client.put(
                f"/api/subjects/{subject.id}",
                json={
                    "name": "Managed Subject",
                    "department_id": other_department.id,
                    "program_id": other_program.id,
                },
            )
            assert moved_subject.status_code == 403
            db_session.refresh(subject)
            assert subject.department_id == department.id
            assert subject.program_id == program.id

            details = client.put(
                f"/api/departments/{department.id}/details",
                json={"name": "Updated Department", "code": "UPDATED"},
            )
            assert details.status_code == 200, details.text
            assert faculty.department == "Updated Department"

            invitation = client.post(
                "/api/department-admin/faculty-requests",
                json={
                    "full_name": "New Faculty",
                    "email": "new-faculty@example.com",
                    "program_id": program.id,
                },
            )
            assert invitation.status_code == 201
            account_request = db_session.query(models.AccountRequest).filter_by(
                email="new-faculty@example.com"
            ).one()
            assert account_request.status == "pending"
            assert account_request.department == "Updated Department"

            change_request = client.post(
                "/api/department-academic-change-requests",
                json={
                    "title": "Coordinate shared subject",
                    "details": "Please review the shared curriculum alignment.",
                    "related_department": other_department.name,
                },
            )
            assert change_request.status_code == 201
            assert client.get("/api/department-academic-change-requests").json()[0]["title"] == "Coordinate shared subject"

            denied_review = client.put(
                f"/api/department-academic-change-requests/{change_request.json()['id']}",
                json={"status": "approved"},
            )
            assert denied_review.status_code == 403
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)


def test_campus_admin_can_review_department_academic_change_requests(db_session, monkeypatch):
    campus = models.Campus(name="Review Campus", code="REV")
    db_session.add(campus)
    db_session.flush()
    department = models.Department(name="Review Department", campus_id=campus.id)
    db_session.add(department)
    db_session.flush()
    campus_admin = models.User(
        email="campus-admin@example.com",
        role="campus_admin",
        campus_id=campus.id,
        archived=False,
    )
    department_admin = models.User(
        email="department-admin@example.com",
        role="department_admin",
        campus_id=campus.id,
        admin_department_id=department.id,
        archived=False,
    )
    db_session.add_all([campus_admin, department_admin])
    db_session.flush()
    request_entry = models.DepartmentAcademicChangeRequest(
        department_id=department.id,
        submitted_by=department_admin.id,
        title="Review curriculum mapping",
        details="Please check the program subject mapping.",
        status="pending",
    )
    db_session.add(request_entry)
    db_session.commit()
    monkeypatch.setattr("main.log_activity", lambda *args, **kwargs: None)

    previous = with_test_dependencies(db_session, campus_admin)
    try:
        with TestClient(app) as client:
            listed = client.get("/api/department-academic-change-requests")
            assert listed.status_code == 200
            assert [row["id"] for row in listed.json()] == [request_entry.id]
            reviewed = client.put(
                f"/api/department-academic-change-requests/{request_entry.id}",
                json={"status": "needs_info", "response": "Please include the affected semester."},
            )
            assert reviewed.status_code == 200
            db_session.refresh(request_entry)
            assert request_entry.status == "needs_info"
            assert request_entry.response == "Please include the affected semester."

            app.dependency_overrides[get_current_user] = lambda: department_admin
            response = client.put(
                f"/api/department-academic-change-requests/{request_entry.id}/respond",
                json={"details": "The affected semesters are the first and second."},
            )
            assert response.status_code == 200
            db_session.refresh(request_entry)
            assert request_entry.status == "pending"
            assert request_entry.details == "The affected semesters are the first and second."

            app.dependency_overrides[get_current_user] = lambda: campus_admin
            approved = client.put(
                f"/api/department-academic-change-requests/{request_entry.id}",
                json={"status": "approved"},
            )
            assert approved.status_code == 200
            db_session.refresh(request_entry)
            assert request_entry.status == "approved"
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
