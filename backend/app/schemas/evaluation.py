from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.questions import QuestionSchema

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
