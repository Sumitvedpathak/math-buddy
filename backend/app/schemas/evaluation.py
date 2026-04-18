from typing import Literal
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


class TopicScoreSchema(BaseModel):
    score: int
    max_score: int
    question_count: int


class EvaluateAnswersResponse(BaseModel):
    results: list[QuestionResultSchema]
    total_score: int
    max_score: int
    topic_breakdown: dict[str, TopicScoreSchema]
