import json
from functools import lru_cache
from pathlib import Path
from typing import Any

DATA_PATH = Path(__file__).parent.parent / "data" / "curriculum.json"


class UnknownLessonError(Exception):
    pass


@lru_cache
def load_curriculum() -> dict[str, Any]:
    """Static curriculum, read once from disk (edit the JSON + redeploy to change it)."""
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))


def get_curriculum(grade: str | None = None) -> dict[str, Any]:
    units = load_curriculum()["units"]
    if grade is not None:
        units = [u for u in units if u["grade"] == grade]
    return {"units": units}


@lru_cache
def _lesson_index() -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for unit in load_curriculum()["units"]:
        for lesson in unit["lessons"]:
            index[lesson["id"]] = {
                **lesson,
                "unit_id": unit["id"],
                "unit_number": unit["number"],
                "unit_title": unit["title"],
            }
    return index


def get_lesson(lesson_id: str | None) -> dict[str, Any] | None:
    """Lesson dict (with unit_id / unit_number / unit_title merged in), or None."""
    if lesson_id is None:
        return None
    return _lesson_index().get(lesson_id)


def all_lessons() -> list[dict[str, Any]]:
    return list(_lesson_index().values())
