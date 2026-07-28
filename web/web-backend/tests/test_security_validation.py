import io
import os
import sys

import pytest
from fastapi import UploadFile

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import normalize_email, read_upload_bytes
from routers.questions import TOSGenerationPayload


def test_normalize_email_trims_and_lowercases():
    assert normalize_email("  User@Example.com ") == "user@example.com"


def test_normalize_email_handles_common_domain_typos():
    assert normalize_email("user@example,com") == "user@example.com"
    assert normalize_email("user@example;com") == "user@example.com"


@pytest.mark.asyncio
async def test_read_upload_bytes_rejects_image_content_even_with_allowed_extension():
    png_bytes = b"\x89PNG\r\n\x1a\n" + b"fake-image-data"
    file = UploadFile(filename="report.pdf", file=io.BytesIO(png_bytes))

    with pytest.raises(Exception):
        await read_upload_bytes(file, "module_file")


def test_tos_generation_payload_accepts_frontend_question_types():
    payload = TOSGenerationPayload(
        upload_id="demo-upload",
        total_items=10,
        whole_total_points=50,
        question_types=["MCQ", "True or False", "Identification", "Matching Type", "Enumeration", "Essay", "Situational"],
        selected_topic_indices=[0, 1],
        subcolumn_a_hours={"0": "3.0", "1": "2.0"},
    )

    assert payload.question_types == ["MCQ", "True or False", "Identification", "Matching Type", "Enumeration", "Essay", "Situational"]
