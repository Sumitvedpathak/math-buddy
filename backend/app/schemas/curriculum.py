from pydantic import BaseModel


class LessonSchema(BaseModel):
    id: str
    title: str
    keywords: list[str]
    focus: str
    # Number of textbook pages to read before practising, shown from
    # frontend/public/lessons/<id>/<n>.jpg (built by scripts/build_lesson_theory.py).
    # 0 = no reading, go straight to practice.
    theory_pages: int = 0


class UnitSchema(BaseModel):
    id: str
    number: int
    title: str
    grade: str
    keywords: list[str]
    lessons: list[LessonSchema]


class CurriculumResponse(BaseModel):
    units: list[UnitSchema]
