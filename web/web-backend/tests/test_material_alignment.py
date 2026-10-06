from material_alignment import validate_material_alignment


def test_matching_module_and_cis_course_code_and_topic_are_accepted():
    assert validate_material_alignment(
        "Course Code: IT 101\nThe module introduces database normalization.",
        "Database Systems",
        "IT101",
        [{"name": "Database Normalization"}],
        {"name": "Database Systems", "code": "IT 101"},
    ) is None


def test_matching_course_code_allows_cis_title_variants():
    assert validate_material_alignment(
        "Advanced algorithms and computational complexity.",
        "Design and Analysis of Algorithms",
        "CS301",
        [{"name": "Advanced Algorithms"}],
        {"name": "Algorithms", "code": "CS 301"},
    ) is None


def test_cis_for_another_selected_subject_is_rejected():
    reason = validate_material_alignment(
        "Database normalization and relational models.",
        "Database Systems",
        "IT202",
        [{"name": "Database Normalization"}],
        {"name": "Database Systems", "code": "IT101"},
    )

    assert reason is not None
    assert "selected subject code" in reason


def test_module_without_a_cis_topic_match_is_rejected():
    reason = validate_material_alignment(
        "Cell structure, genetics, and biological systems.",
        "Database Systems",
        "IT101",
        [{"name": "Database Normalization"}],
        {"name": "Database Systems", "code": "IT101"},
    )

    assert reason is not None
    assert "do not appear to cover" in reason


def test_module_course_code_mismatch_is_rejected():
    reason = validate_material_alignment(
        "Course Code: BIO202\nDatabase normalization.",
        "Database Systems",
        "IT101",
        [{"name": "Database Normalization"}],
        {"name": "Database Systems", "code": "IT101"},
    )

    assert reason is not None
    assert "learning materials course code" in reason


def test_missing_cis_topics_cannot_be_verified():
    reason = validate_material_alignment(
        "Readable module text.",
        "Database Systems",
        "IT101",
        [],
        {"name": "Database Systems", "code": "IT101"},
    )

    assert reason is not None
    assert "CIS topics could not be identified" in reason
