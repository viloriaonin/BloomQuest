from types import SimpleNamespace

import pytest
from fastapi import BackgroundTasks, HTTPException

import main
import models


class FakeQuery:
    def __init__(self, session, model):
        self.session = session
        self.model = model

    def filter(self, *args, **kwargs):
        return self

    def outerjoin(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def first(self):
        if self.model is models.AccountRequest:
            return self.session.account_request
        if self.model is models.Department:
            return self.session.department
        if self.model is models.Program:
            return self.session.program
        if self.model is models.UserChangeRequest:
            if self.session.user_change_requests:
                return self.session.user_change_requests.pop(0)
            return None
        if self.model is models.User:
            if self.session.user_results:
                return self.session.user_results.pop(0)
            return None
        if self.model is models.Campus:
            return self.session.campus
        return None

    def update(self, *args, **kwargs):
        return 0

    def all(self):
        if self.model is models.User:
            return list(self.session.user_results)
        return []

    def delete(self, *args, **kwargs):
        return 0


class FakeSession:
    def __init__(self, account_request=None, department=None, user_results=None, program=None, user_change_requests=None, campus=None):
        self.account_request = account_request
        self.department = department
        self.program = program
        self.user_change_requests = list(user_change_requests or [])
        self.user_results = list(user_results or [])
        self.campus = campus
        self.added = []
        self.deleted = []
        self.commits = 0

    def query(self, model):
        return FakeQuery(self, model)

    def add(self, value):
        self.added.append(value)

    def delete(self, value):
        self.deleted.append(value)

    def commit(self):
        self.commits += 1

    def refresh(self, value):
        return None


@pytest.mark.asyncio
async def test_approve_request_creates_faculty_with_department_and_program(monkeypatch):
    request = SimpleNamespace(
        id=10,
        full_name="Willian T Acorda",
        department="College of Informatics and Computing Sciences",
        program_id=7,
        email="faculty@example.com",
    )
    created_user = SimpleNamespace(
        id=23,
        name=request.full_name,
        email=request.email,
        role="faculty",
        department=request.department,
        program_id=request.program_id,
        archived=False,
    )
    db = FakeSession(account_request=request, user_results=[None, created_user])
    monkeypatch.setattr(main, "generate_temporary_password", lambda: "TempPass1!")
    monkeypatch.setattr(main, "log_activity", lambda *args, **kwargs: None)

    result = await main.approve_account_request(
        SimpleNamespace(email=request.email),
        SimpleNamespace(add_task=lambda *args, **kwargs: None),
        db,
        _admin=SimpleNamespace(id=1, role="super_admin"),
    )

    created = next(item for item in db.added if isinstance(item, models.User))
    assert created.name == request.full_name
    assert created.department == request.department
    assert created.program_id == request.program_id
    assert result["created_user"]["id"] == created_user.id
    assert request in db.deleted


def test_delete_user_archives_instead_of_permanently_deleting(monkeypatch):
    user = SimpleNamespace(id=23, email="faculty@example.com", role="faculty", archived=False)
    db = FakeSession(user_results=[user], department=SimpleNamespace(name="Engineering"))
    monkeypatch.setattr(main, "log_activity", lambda *args, **kwargs: None)

    result = main.delete_user(user.email, db, admin=SimpleNamespace(id=1, role="super_admin"))

    assert user.archived is True
    assert db.commits == 1
    assert result["message"] == "User archived successfully."


def test_permanent_delete_user_removes_account_record(monkeypatch):
    user = SimpleNamespace(id=23, email="faculty@example.com", archived=True)
    db = FakeSession(user_results=[user], department=SimpleNamespace(name="Engineering"))
    monkeypatch.setattr(main, "log_activity", lambda *args, **kwargs: None)

    result = main.permanent_delete_user(user.email, db, admin=SimpleNamespace(id=1, role="super_admin"))

    assert user in db.deleted
    assert db.commits == 1
    assert result["message"] == "User permanently deleted successfully."


def test_delete_campus_admin_rejects_active_account():
    user = SimpleNamespace(id=23, email="admin@example.com", role="campus_admin", archived=False, campus_id=4)
    db = FakeSession(user_results=[user], campus=SimpleNamespace(id=4, is_active=True))

    with pytest.raises(HTTPException, match="Deactivate the Campus Admin") as error:
        main.delete_campus_admin(user.id, db, admin=SimpleNamespace(id=1, role="super_admin"))

    assert error.value.status_code == 400
    assert db.deleted == []
    assert db.commits == 0


def test_delete_campus_admin_removes_inactive_account(monkeypatch):
    user = SimpleNamespace(id=23, email="admin@example.com", role="campus_admin", archived=False, campus_id=4)
    db = FakeSession(user_results=[user], campus=SimpleNamespace(id=4, is_active=False))
    monkeypatch.setattr(main, "log_activity", lambda *args, **kwargs: None)

    result = main.delete_campus_admin(user.id, db, admin=SimpleNamespace(id=1, role="super_admin"))

    assert user in db.deleted
    assert db.commits == 1
    assert result["status"] == "deleted"


def test_create_campus_admin_queues_credentials_email(monkeypatch):
    campus = SimpleNamespace(id=4, name="North Campus", is_active=True)
    db = FakeSession(campus=campus, user_results=[None])
    background_tasks = BackgroundTasks()
    monkeypatch.setattr(main, "log_activity", lambda *args, **kwargs: None)
    payload = main.CampusAdminCreateRequest(
        name="Avery Admin",
        email="avery@example.com",
        password="InitialPass1!",
        campus_id=campus.id,
    )

    result = main.create_campus_admin(
        payload,
        background_tasks,
        db,
        admin=SimpleNamespace(id=1, role="super_admin"),
    )

    assert result["email"] == payload.email
    assert len(background_tasks.tasks) == 1
    assert background_tasks.tasks[0].func is main.send_campus_admin_credentials_email
    assert background_tasks.tasks[0].args == (payload.email, payload.name, payload.password, campus.name)


def test_campus_admin_credentials_email_has_greeting_credentials_and_reminder(monkeypatch):
    captured = {}

    class FakeSMTP:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def starttls(self):
            return None

        def login(self, sender, password):
            return None

        def send_message(self, message):
            captured["message"] = message

    monkeypatch.setattr(main, "SENDER_EMAIL", "noreply@example.com")
    monkeypatch.setattr(main, "SENDER_PASSWORD", "smtp-secret")
    monkeypatch.setattr(main.smtplib, "SMTP", lambda *args, **kwargs: FakeSMTP())

    assert main.send_campus_admin_credentials_email(
        "avery@example.com", "Avery Admin", "InitialPass1!", "North Campus"
    )

    message = captured["message"]
    body = "\n".join(part.get_payload(decode=True).decode() for part in message.get_payload())
    assert message["To"] == "avery@example.com"
    assert "Hello Avery Admin" in body
    assert "avery@example.com" in body
    assert "InitialPass1!" in body
    assert "change your password immediately after your first login" in body


def test_create_user_change_request_requires_matching_session_user():
    payload = main.UserChangeRequestPayload(user_id=99, request_type="department", requested_value="Engineering")
    user = SimpleNamespace(id=7, archived=False, department="Business", email="me@example.com")
    db = FakeSession(user_results=[user], department=SimpleNamespace(name="Engineering"))

    with pytest.raises(HTTPException, match="authorized"):
        main.create_user_change_request(payload, db, current_user=user)

    payload_for_self = main.UserChangeRequestPayload(user_id=7, request_type="department", requested_value="Engineering")
    result = main.create_user_change_request(payload_for_self, db, current_user=user)
    assert result["status"] == "pending"


def test_update_department_changes_department_and_clears_program(monkeypatch):
    user = SimpleNamespace(id=23, email="faculty@example.com", department="Old Department", program_id=7)
    department = SimpleNamespace(name="College of Engineering", campus_id=1)
    db = FakeSession(department=department, user_results=[user])
    monkeypatch.setattr(main, "log_activity", lambda *args, **kwargs: None)

    result = main.update_user_department(
        SimpleNamespace(email=user.email, department=department.name),
        db,
        admin=SimpleNamespace(id=1, role="super_admin"),
    )

    assert user.department == department.name
    assert user.program_id is None
    assert result["department"] == department.name


def test_create_program_change_request_requires_matching_session_user():
    payload = main.UserChangeRequestPayload(user_id=99, request_type="program", requested_value="BSIT")
    user = SimpleNamespace(id=7, archived=False, department="Engineering", program_id=3, email="me@example.com")
    program = SimpleNamespace(id=9, name="BSIT", department_id=1)
    db = FakeSession(user_results=[user], department=SimpleNamespace(name="Engineering"), program=program)

    with pytest.raises(HTTPException, match="authorized"):
        main.create_user_change_request(payload, db, current_user=user)

    payload_for_self = main.UserChangeRequestPayload(user_id=7, request_type="program", requested_value="BSIT")
    result = main.create_user_change_request(payload_for_self, db, current_user=user)
    assert result["status"] == "pending"
    request = next(item for item in db.added if isinstance(item, models.UserChangeRequest))
    assert request.requested_value == str(program.id)


def test_review_program_change_request_updates_user_program(monkeypatch):
    row = SimpleNamespace(
        id=15,
        user_id=23,
        request_type="program",
        requested_value="BSIT",
        status="pending",
        current_value="BSCS",
        reviewed_at=None,
        reviewed_by=None,
    )
    user = SimpleNamespace(id=23, email="faculty@example.com", department="Engineering", program_id=3)
    program = SimpleNamespace(id=9, name="BSIT", department_id=1)
    db = FakeSession(
        user_results=[user, user],
        department=SimpleNamespace(name="Engineering"),
        program=program,
        user_change_requests=[row],
    )
    monkeypatch.setattr(main, "log_activity", lambda *args, **kwargs: None)

    result = main.review_user_change_request(
        15,
        SimpleNamespace(action="approve"),
        db,
        admin=SimpleNamespace(id=1, role="super_admin"),
    )

    assert user.program_id == program.id
    assert result["status"] == "approved"


def test_bulk_user_action_logs_actor_and_target_user(monkeypatch):
    user = SimpleNamespace(id=23, role="faculty", archived=False)
    db = FakeSession(user_results=[user])
    calls = []
    monkeypatch.setattr(main, "log_activity", lambda *args, **kwargs: calls.append({"args": args, "kwargs": kwargs}))

    result = main.bulk_user_action(
        SimpleNamespace(user_ids=[23], action="archive"),
        db,
        admin=SimpleNamespace(id=1, role="super_admin"),
    )

    assert result["updated"] == [23]
    assert len(calls) == 1
    assert calls[0]["kwargs"]["actor_id"] == 1
    assert calls[0]["kwargs"]["target_user_id"] == 23
