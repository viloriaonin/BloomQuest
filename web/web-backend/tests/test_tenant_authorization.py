import os
import sys
from io import BytesIO
from types import SimpleNamespace

import openpyxl
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import models
from database import Base
from main import assert_question_access, validate_account_request_scope, create_department, DepartmentCreateRequest, get_subjects, get_questions, get_super_admin_overview, get_question_sets, export_question_bank_tos
from routers.questions import _assert_upload_access, _resolve_department_leadership
from security import assert_campus_access, assert_user_subject_campus_access, require_admin, require_campus_admin, require_super_admin, visible_campus_id


@pytest.fixture
def db_session():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def test_super_admin_can_access_any_campus():
    user = SimpleNamespace(role="super_admin", campus_id=None)

    assert assert_campus_access(user, 12) is None
    assert visible_campus_id(user) is None
    assert require_admin(user) is user
    assert require_super_admin(user) is user


def test_campus_admin_is_limited_to_assigned_campus():
    user = SimpleNamespace(role="campus_admin", campus_id=4)

    assert assert_campus_access(user, 4) is None
    assert visible_campus_id(user) == 4
    assert require_admin(user) is user
    assert require_campus_admin(user) is user

    with pytest.raises(HTTPException) as error:
        assert_campus_access(user, 5)

    assert error.value.status_code == 403


def test_campus_admin_without_assignment_is_rejected():
    user = SimpleNamespace(role="campus_admin", campus_id=None)

    with pytest.raises(HTTPException) as error:
        visible_campus_id(user)

    assert error.value.status_code == 403
    with pytest.raises(HTTPException) as admin_error:
        require_admin(user)

    assert admin_error.value.status_code == 403


def test_faculty_cannot_use_admin_campus_scope():
    user = SimpleNamespace(role="faculty", campus_id=4)

    with pytest.raises(HTTPException) as admin_error:
        require_admin(user)
    with pytest.raises(HTTPException) as campus_error:
        assert_campus_access(user, 4)
    with pytest.raises(HTTPException) as campus_role_error:
        require_campus_admin(user)

    assert admin_error.value.status_code == 403
    assert campus_error.value.status_code == 403
    assert campus_role_error.value.status_code == 403


def test_question_access_resolves_campus_through_academic_hierarchy(db_session):
    lipa = models.Campus(name="Lipa", code="LIPA")
    alangilan = models.Campus(name="Alangilan", code="ALANGILAN")
    db_session.add_all([lipa, alangilan])
    db_session.flush()
    department = models.Department(name="Computing", campus_id=lipa.id)
    db_session.add(department)
    db_session.flush()
    program = models.Program(name="Information Technology", department_id=department.id)
    db_session.add(program)
    db_session.flush()
    subject = models.Subject(name="Programming", program_id=program.id, department_id=department.id)
    db_session.add(subject)
    db_session.flush()
    question = models.GeneratedQuestion(subject_id=subject.id, question="What is a program?")
    db_session.add(question)
    db_session.commit()

    lipa_admin = SimpleNamespace(role="campus_admin", campus_id=lipa.id)
    alangilan_admin = SimpleNamespace(role="campus_admin", campus_id=alangilan.id)

    assert assert_question_access(db_session, lipa_admin, question) is None
    with pytest.raises(HTTPException) as error:
        assert_question_access(db_session, alangilan_admin, question)

    assert error.value.status_code == 403


def test_faculty_and_campus_admin_cannot_read_foreign_campus_questions(db_session):
    lipa = models.Campus(name="Lipa Access", code="LIPA-ACCESS")
    main = models.Campus(name="Main Access", code="MAIN-ACCESS")
    db_session.add_all([lipa, main])
    db_session.flush()
    lipa_department = models.Department(name="Lipa Department", campus_id=lipa.id)
    main_department = models.Department(name="Main Department", campus_id=main.id)
    db_session.add_all([lipa_department, main_department])
    db_session.flush()
    lipa_program = models.Program(name="Lipa Program", department_id=lipa_department.id)
    main_program = models.Program(name="Main Program", department_id=main_department.id)
    db_session.add_all([lipa_program, main_program])
    db_session.flush()
    lipa_faculty = models.User(email="lipa_faculty@example.com", password="secret", role="faculty", campus_id=lipa.id, program_id=lipa_program.id)
    main_faculty = models.User(email="main_faculty@example.com", password="secret", role="faculty", campus_id=main.id, program_id=main_program.id)
    lipa_admin = models.User(email="lipa_admin@example.com", password="secret", role="campus_admin", campus_id=lipa.id)
    db_session.add_all([lipa_faculty, main_faculty, lipa_admin])
    db_session.flush()
    shared_subject = models.Subject(name="Shared Access Subject", department_id=lipa_department.id, user_id=lipa_faculty.id)
    db_session.add(shared_subject)
    db_session.flush()
    lipa_question = models.GeneratedQuestion(subject_id=shared_subject.id, user_id=lipa_faculty.id, question="Lipa question")
    main_question = models.GeneratedQuestion(subject_id=shared_subject.id, user_id=main_faculty.id, question="Main question")
    db_session.add_all([lipa_question, main_question])
    foreign_subject = models.Subject(name="Main Campus Upload Subject", department_id=main_department.id)
    db_session.add(foreign_subject)
    db_session.flush()
    foreign_subject_upload = models.UploadedFile(
        user_id=lipa_faculty.id,
        subject_id=foreign_subject.id,
        module_filename="module.pdf",
        syllabus_filename="syllabus.pdf",
        module_text="module",
        syllabus_text="syllabus",
    )
    db_session.add(foreign_subject_upload)
    question_set = models.QuestionSet(name="Shared subject set", subject_id=shared_subject.id)
    db_session.add(question_set)
    db_session.flush()
    db_session.add_all([
        models.QuestionSetItem(question_set_id=question_set.id, question_id=lipa_question.id, position=0),
        models.QuestionSetItem(question_set_id=question_set.id, question_id=main_question.id, position=1),
    ])
    db_session.commit()

    faculty_questions = get_questions(db=db_session, current_user=lipa_faculty)
    admin_questions = get_questions(db=db_session, current_user=lipa_admin)
    faculty_sets = get_question_sets(db=db_session, current_user=lipa_faculty)
    admin_sets = get_question_sets(db=db_session, current_user=lipa_admin)

    assert {item["id"] for item in faculty_questions} == {lipa_question.id}
    assert {item["id"] for item in admin_questions} == {lipa_question.id}
    assert faculty_sets[0]["question_ids"] == [lipa_question.id]
    assert faculty_sets[0]["question_count"] == 1
    assert admin_sets[0]["question_ids"] == [lipa_question.id]
    assert_user_subject_campus_access(db_session, lipa_faculty, shared_subject)
    with pytest.raises(HTTPException) as subject_error:
        assert_user_subject_campus_access(db_session, main_faculty, shared_subject)
    assert subject_error.value.status_code == 403
    with pytest.raises(HTTPException) as error:
        assert_question_access(db_session, lipa_faculty, main_question)
    assert error.value.status_code == 404
    with pytest.raises(HTTPException) as upload_error:
        _assert_upload_access(str(foreign_subject_upload.id), lipa_faculty, db_session)
    assert upload_error.value.status_code == 403


def test_account_request_must_match_selected_campus_department_and_program(db_session):
    lipa = models.Campus(name="Lipa Request", code="LIPA-REQ")
    alangilan = models.Campus(name="Alangilan Request", code="ALA-REQ")
    db_session.add_all([lipa, alangilan])
    db_session.flush()
    department = models.Department(name="Computing Request", campus_id=lipa.id)
    db_session.add(department)
    db_session.flush()
    program = models.Program(name="IT Request", department_id=department.id)
    db_session.add(program)
    db_session.commit()

    assert validate_account_request_scope(
        db_session, lipa.id, department.name, program.id
    ) is None
    with pytest.raises(HTTPException) as error:
        validate_account_request_scope(
            db_session, alangilan.id, department.name, program.id
        )

    assert error.value.status_code == 422


def test_campus_admin_can_list_subjects_by_program_membership(db_session):
    campus = models.Campus(name="Main Campus", code="MAIN")
    db_session.add(campus)
    db_session.flush()
    department = models.Department(name="College of Teaching Education", campus_id=campus.id)
    db_session.add(department)
    db_session.flush()
    program = models.Program(name="Bachelor of Secondary Education", department_id=department.id)
    other_program = models.Program(name="Bachelor of Elementary Education", department_id=department.id)
    db_session.add_all([program, other_program])
    db_session.flush()
    faculty = models.User(email="faculty1@example.com", password="secret", role="faculty", campus_id=campus.id, program_id=program.id)
    second_faculty = models.User(email="faculty2@example.com", password="secret", role="faculty", campus_id=campus.id, program_id=program.id)
    other_faculty = models.User(email="faculty3@example.com", password="secret", role="faculty", campus_id=campus.id, program_id=other_program.id)
    other_campus = models.Campus(name="Other Campus", code="OTHER")
    db_session.add(other_campus)
    db_session.flush()
    mismatched_campus_faculty = models.User(email="faculty4@example.com", password="secret", role="faculty", campus_id=other_campus.id, program_id=program.id)
    db_session.add_all([faculty, second_faculty, other_faculty, mismatched_campus_faculty])
    db_session.flush()
    subject = models.Subject(name="Educational Assessment", department_id=department.id)
    unrelated_subject = models.Subject(name="Elementary Curriculum", department_id=department.id, user_id=other_faculty.id)
    db_session.add_all([subject, unrelated_subject])
    db_session.flush()
    first_question = models.GeneratedQuestion(subject_id=subject.id, user_id=faculty.id, question="First faculty question")
    second_question = models.GeneratedQuestion(subject_id=subject.id, user_id=second_faculty.id, question="Second faculty question")
    additional_question = models.GeneratedQuestion(subject_id=subject.id, user_id=other_faculty.id, question="Additional question in the same subject")
    mismatched_campus_question = models.GeneratedQuestion(subject_id=subject.id, user_id=mismatched_campus_faculty.id, question="Question from another campus")
    unrelated_question = models.GeneratedQuestion(subject_id=unrelated_subject.id, user_id=other_faculty.id, question="Other program question")
    db_session.add_all([first_question, second_question, additional_question, mismatched_campus_question, unrelated_question])
    db_session.commit()

    admin = models.User(email="admin@example.com", password="secret", role="campus_admin", campus_id=campus.id)
    super_admin = models.User(email="super_admin@example.com", password="secret", role="super_admin")
    db_session.add_all([admin, super_admin])
    db_session.commit()

    subjects = get_subjects(db=db_session, current_user=admin, program_id=program.id)
    questions = get_questions(subject_id=subject.id, program_id=program.id, db=db_session, current_user=admin)
    super_admin_subjects = get_subjects(db=db_session, current_user=super_admin, program_id=program.id)
    super_admin_questions = get_questions(subject_id=subject.id, program_id=program.id, db=db_session, current_user=super_admin)

    assert any(item["id"] == subject.id for item in subjects)
    assert any(item["name"] == "Educational Assessment" for item in subjects)
    assert next(item for item in subjects if item["id"] == subject.id)["question_count"] == 2
    assert all(item["id"] != unrelated_subject.id for item in subjects)
    assert {item["id"] for item in questions} == {first_question.id, second_question.id}
    assert {item["id"] for item in super_admin_subjects} == {item["id"] for item in subjects}
    assert {item["id"] for item in super_admin_questions} == {first_question.id, second_question.id}


def test_super_admin_overview_counts_only_campus_attributed_questions(db_session):
    lipa = models.Campus(name="Alpha Campus", code="ALPHA")
    main = models.Campus(name="Beta Campus", code="BETA")
    db_session.add_all([lipa, main])
    db_session.flush()
    lipa_department = models.Department(name="Alpha Department", campus_id=lipa.id)
    main_department = models.Department(name="Beta Department", campus_id=main.id)
    db_session.add_all([lipa_department, main_department])
    db_session.flush()
    lipa_program = models.Program(name="Alpha Program", department_id=lipa_department.id)
    main_program = models.Program(name="Beta Program", department_id=main_department.id)
    db_session.add_all([lipa_program, main_program])
    db_session.flush()
    lipa_faculty = models.User(email="alpha_faculty@example.com", password="secret", role="faculty", campus_id=lipa.id, program_id=lipa_program.id)
    main_faculty = models.User(email="beta_faculty@example.com", password="secret", role="faculty", campus_id=main.id, program_id=main_program.id)
    db_session.add_all([lipa_faculty, main_faculty])
    db_session.flush()
    subject = models.Subject(name="Overview Subject", department_id=lipa_department.id)
    db_session.add(subject)
    db_session.flush()
    lipa_questions = [
        models.GeneratedQuestion(subject_id=subject.id, user_id=lipa_faculty.id, bloom_level="Remember" if index < 5 else "Analyze", question=f"Lipa question {index}")
        for index in range(10)
    ]
    main_questions = [
        models.GeneratedQuestion(subject_id=subject.id, user_id=main_faculty.id, bloom_level="Remember" if index < 5 else "Analyze", question=f"Main question {index}")
        for index in range(10)
    ]
    unassigned_questions = [
        models.GeneratedQuestion(bloom_level="Create", question=f"Unassigned question {index}")
        for index in range(3)
    ]
    db_session.add_all(lipa_questions + main_questions + unassigned_questions)
    db_session.commit()

    admin = models.User(email="overview_admin@example.com", password="secret", role="super_admin")
    db_session.add(admin)
    db_session.commit()

    overview = get_super_admin_overview(db=db_session, _admin=admin)

    campuses = {campus["name"]: campus for campus in overview["campuses"]}
    assert overview["totals"]["questions"] == 20
    assert campuses["Alpha Campus"]["questions"] == 10
    assert campuses["Beta Campus"]["questions"] == 10
    assert campuses["Alpha Campus"]["bloom_distribution"] == {"Remember": 5, "Analyze": 5}
    assert campuses["Beta Campus"]["bloom_distribution"] == {"Remember": 5, "Analyze": 5}
    assert overview["bloom_distribution"] == {"Remember": 10, "Analyze": 10}


def test_tos_leadership_uses_faculty_program_department_before_subject_department(db_session):
    faculty_campus = models.Campus(name="Faculty Campus", code="FACULTY-CAMPUS")
    subject_campus = models.Campus(name="Subject Campus", code="SUBJECT-CAMPUS")
    db_session.add_all([faculty_campus, subject_campus])
    db_session.flush()
    faculty_department = models.Department(name="Education Department", campus_id=faculty_campus.id, dean_name="Faculty Campus Dean")
    subject_department = models.Department(name="Education Department", campus_id=subject_campus.id, dean_name="Subject Campus Dean")
    db_session.add_all([faculty_department, subject_department])
    db_session.flush()
    faculty_program = models.Program(name="Education Program", department_id=faculty_department.id)
    subject_program = models.Program(name="Other Education Program", department_id=subject_department.id)
    db_session.add_all([faculty_program, subject_program])
    db_session.flush()
    faculty = models.User(email="faculty_tos@example.com", password="secret", role="faculty", campus_id=faculty_campus.id, program_id=faculty_program.id, department=faculty_department.name)
    subject = models.Subject(name="Cross-listed Subject", department_id=subject_department.id, program_id=subject_program.id)
    db_session.add_all([faculty, subject])
    db_session.commit()

    leadership = _resolve_department_leadership(db_session, creator=faculty, subject=subject)

    assert leadership["department_name"] == faculty_department.name
    assert leadership["dean_name"] == "Faculty Campus Dean"


def test_question_bank_tos_export_uses_authenticated_faculty_department_dean(db_session):
    other_campus = models.Campus(name="Other TOS Campus", code="OTHER-TOS")
    faculty_campus = models.Campus(name="Faculty TOS Campus", code="FACULTY-TOS")
    db_session.add_all([other_campus, faculty_campus])
    db_session.flush()
    other_department = models.Department(name="Education Department", campus_id=other_campus.id, dean_name="Other Campus Dean")
    faculty_department = models.Department(name="Education Department", campus_id=faculty_campus.id, dean_name="Faculty Campus Dean")
    db_session.add_all([other_department, faculty_department])
    db_session.flush()
    program = models.Program(name="Teacher Education", department_id=faculty_department.id)
    db_session.add(program)
    db_session.flush()
    faculty = models.User(email="tos_faculty@example.com", password="secret", role="faculty", campus_id=faculty_campus.id, program_id=program.id, department=faculty_department.name)
    untrusted_user = models.User(email="other_user@example.com", password="secret", role="faculty", campus_id=other_campus.id)
    db_session.add_all([faculty, untrusted_user])
    db_session.flush()
    subject = models.Subject(
        name="Faculty TOS Subject",
        user_id=faculty.id,
        department_id=other_department.id,
    )
    db_session.add(subject)
    db_session.flush()
    question = models.GeneratedQuestion(
        subject_id=subject.id,
        user_id=faculty.id,
        topic_name="Foundations",
        bloom_level="Remember",
        question_type="MCQ",
        question="Which principle guides teaching?",
    )
    db_session.add(question)
    db_session.commit()

    response = export_question_bank_tos(
        subject_id=subject.id,
        question_ids=str(question.id),
        exam_type="Final Exam",
        semester="First Semester",
        academic_year="2026-2027",
        subcolumn_a_hours='{"Foundations": 1}',
        selected_topics='["Foundations"]',
        user_id=untrusted_user.id,
        db=db_session,
        current_user=faculty,
    )
    workbook = openpyxl.load_workbook(BytesIO(response.body))
    values = {str(cell.value).strip() for row in workbook.active.iter_rows() for cell in row if cell.value is not None}

    assert "Faculty Campus Dean" in values
    assert "Other Campus Dean" not in values


def test_department_creation_is_scoped_to_campus(db_session):
    campus_one = models.Campus(name="Campus One", code="C1")
    campus_two = models.Campus(name="Campus Two", code="C2")
    db_session.add_all([campus_one, campus_two])
    db_session.flush()

    admin = models.User(
        email="campus_admin@example.com",
        password="secret",
        role="campus_admin",
        campus_id=campus_one.id,
    )
    db_session.add(admin)
    db_session.commit()

    first = create_department(
        DepartmentCreateRequest(name="Computer Science", code="CS", campus_id=campus_one.id),
        db_session,
        admin,
    )
    assert first["campus_id"] == campus_one.id

    second = create_department(
        DepartmentCreateRequest(name="Computer Science", code="CS", campus_id=campus_two.id),
        db_session,
        admin,
    )
    assert second["campus_id"] == campus_two.id

    with pytest.raises(HTTPException) as error:
        create_department(
            DepartmentCreateRequest(name="Computer Science", code="CS-ALT", campus_id=campus_one.id),
            db_session,
            admin,
        )

    assert error.value.status_code == 400