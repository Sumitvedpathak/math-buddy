from typing import Annotated, Literal
from pydantic import BaseModel, Field
import uuid

ProblemType = Literal[
    "multiplication", "division", "fractions", "mixed_fractions", "squares"
]

AgeGroup = Literal["9-10", "11-12"]


class GenerateQuestionsRequest(BaseModel):
    topics: list[str] = Field(..., min_length=1)
    age_group: AgeGroup
    question_count: Annotated[int, Field(default=30, ge=1, le=100)] = 30


class QuestionSchema(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    topic: str
    problem_type: ProblemType
    text: str
    difficulty_tier: int = Field(..., ge=1)


class GenerateQuestionsResponse(BaseModel):
    questions: list[QuestionSchema]
    fun_facts: list[str] = Field(..., min_length=10)
