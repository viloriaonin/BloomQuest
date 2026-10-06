import re


_WORD_PATTERN = re.compile(r"[a-z0-9]+")
_COURSE_CODE_PATTERN = re.compile(
    r"(?im)^\s*(?:course|subject)\s*(?:code|no\.?|number)\s*[:#-]\s*"
    r"([a-z]{1,10}[\s-]*\d[a-z0-9-]{0,12})\b"
)
_STOP_WORDS = {
    "a", "about", "an", "and", "are", "as", "at", "by", "for", "from",
    "in", "into", "is", "of", "on", "or", "the", "to", "with",
    "chapter", "concept", "concepts", "introduction", "lesson", "module",
    "overview", "principle", "principles", "topic", "topics", "unit",
}


def _terms(value):
    terms = set()
    for word in _WORD_PATTERN.findall(str(value or "").casefold()):
        if len(word) < 3 or word in _STOP_WORDS:
            continue
        terms.add(word[:-1] if word.endswith("s") and len(word) > 4 else word)
    return terms


def _course_code(value):
    return re.sub(r"[^a-z0-9]", "", str(value or "").casefold())


def validate_material_alignment(module_text, course_title, course_code, topics, selected_subject=None):
    """Return a user-facing reason when the module cannot be matched to its CIS."""
    if selected_subject:
        selected_code = selected_subject.get("code")
        normalized_selected_code = _course_code(selected_code)
        normalized_cis_code = _course_code(course_code)
        has_matching_codes = bool(
            normalized_selected_code
            and normalized_cis_code
            and normalized_selected_code == normalized_cis_code
        )
        if normalized_selected_code and normalized_cis_code and not has_matching_codes:
            return (
                f"The selected subject code ({selected_code}) does not match the CIS "
                f"course code ({course_code})."
            )

        if not has_matching_codes:
            selected_name_terms = _terms(selected_subject.get("name"))
            cis_name_terms = _terms(course_title)
            if selected_name_terms and cis_name_terms:
                overlap = len(selected_name_terms & cis_name_terms)
                similarity = overlap / max(len(selected_name_terms), len(cis_name_terms))
                if similarity < 0.5:
                    return (
                        f"The selected subject ({selected_subject.get('name')}) does not match "
                        f"the CIS course title ({course_title})."
                    )
            else:
                return "The CIS does not contain enough course information to verify the selected subject."

    expected_code = (selected_subject or {}).get("code") or course_code
    module_code_match = _COURSE_CODE_PATTERN.search(str(module_text or ""))
    module_code = module_code_match.group(1).strip() if module_code_match else None
    if module_code and expected_code and _course_code(module_code) != _course_code(expected_code):
        return (
            f"The learning materials course code ({module_code}) does not match "
            f"the CIS course code ({expected_code})."
        )

    module_terms = _terms(module_text)
    if not module_terms:
        return "The learning materials do not contain enough readable text to verify alignment with the CIS."

    topic_names = [
        topic.get("name") or topic.get("topic_name") or topic.get("topic") or ""
        for topic in (topics or [])
        if isinstance(topic, dict)
    ]
    topic_terms = [_terms(name) for name in topic_names]
    topic_terms = [terms for terms in topic_terms if terms]
    if not topic_terms:
        return "The CIS topics could not be identified, so the learning materials cannot be matched."

    if not any(
        len(terms & module_terms) / len(terms) >= 0.6
        for terms in topic_terms
    ):
        return (
            "The learning materials do not appear to cover any of the topics listed in the CIS. "
            "Check that both files belong to the same subject."
        )

    return None
