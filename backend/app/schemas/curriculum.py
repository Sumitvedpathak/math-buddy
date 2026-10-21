from pydantic import BaseModel


class LessonSchema(BaseModel):
    id: str
    title: str
    keywords: list[str]
    focus: str


class UnitSchema(BaseModel):
    id: str
    number: int
    title: str
    grade: str
    keywords: list[str]
    lessons: list[LessonSchema]


class CurriculumResponse(BaseModel):
    units: list[UnitSchema]
