"""Request/response shapes for generating questions and marking answers."""

import uuid
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, Field

ProblemType = Literal[
    "multiplication", "division", "fractions", "mixed_fractions", "squares", "lesson"
]

AgeGroup = Literal["9-10", "11-12"]


class GenerateQuestionsRequest(BaseModel):
    topics: list[str] = Field(..., min_length=1)
    age_group: AgeGroup
    question_count: Annotated[int, Field(default=30, ge=1, le=100)] = 30
    # Curriculum lesson (e.g. "10.3"): scopes generation to that lesson and
    # replaces the five mandatory arithmetic problem types with "lesson".
    lesson_id: str | None = None


class QuestionSchema(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    topic: str
    problem_type: ProblemType
    text: str
    difficulty_tier: int = Field(..., ge=1)


class GenerateQuestionsResponse(BaseModel):
    questions: list[QuestionSchema]
    fun_facts: list[str] = Field(..., min_length=10)



AnswerMode = Literal["sketch", "text"]


class AnswerSchema(BaseModel):
    question_id: str
    mode: AnswerMode
    content: str = Field(..., min_length=1)


class EvaluateAnswersRequest(BaseModel):
    questions: list[QuestionSchema]
    answers: list[AnswerSchema]


class QuestionResultSchema(BaseModel):
    question_id: str
    marks: Literal[0, 1, 2]
    feedback: str
    student_answer: Optional[str] = Field(
        default=None,
        description="What the student answered (required from LLM when marks < 2).",
    )
    correct_answer: Optional[str] = Field(
        default=None,
        description="Expected correct answer (required from LLM when marks < 2).",
    )


class TopicScoreSchema(BaseModel):
    score: int
    max_score: int
    question_count: int


class EvaluateAnswersResponse(BaseModel):
    results: list[QuestionResultSchema]
    total_score: int
    max_score: int
    topic_breakdown: dict[str, TopicScoreSchema]
