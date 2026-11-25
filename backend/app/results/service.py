import logging
import uuid
from datetime import datetime, timezone
from decimal import ROUND_FLOOR, Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.curriculum.service import UnknownLessonError, get_lesson
from app.results.models import LessonProgress, PracticeAttempt
from app.results.schemas import AttemptCreate

logger = logging.getLogger(__name__)

MASTERY_THRESHOLD_PCT = Decimal("95")


def compute_score_pct(score: float, max_score: float) -> float:
    """Percentage floored to 2 dp, so a displayed 95.00 always means >= 95%."""
    pct = Decimal(str(score)) * 100 / Decimal(str(max_score))
    return float(pct.quantize(Decimal("0.01"), rounding=ROUND_FLOOR))


def is_mastered(score_pct: float) -> bool:
    return Decimal(str(score_pct)) >= MASTERY_THRESHOLD_PCT


async def save_attempt(
    session: AsyncSession, profile_id: uuid.UUID, data: AttemptCreate
) -> tuple[PracticeAttempt, float, LessonProgress | None]:
    """Persist one attempt; for curriculum mode also upsert lesson_progress."""
    if data.mode == "curriculum" and get_lesson(data.lesson_id) is None:
        raise UnknownLessonError(data.lesson_id)

    now = datetime.now(timezone.utc)
    pct = compute_score_pct(data.score, data.max_score)
    attempt = PracticeAttempt(
        profile_id=profile_id,
        mode=data.mode,
        lesson_id=data.lesson_id,
        topic_id=data.topic_id,
        question_count=len(data.questions),
        score=data.score,
        max_score=data.max_score,
        questions_snapshot=data.questions,
        evaluation_snapshot=data.evaluation,
        created_at=now,
    )
    session.add(attempt)

    progress: LessonProgress | None = None
    if data.mode == "curriculum":
        progress = await session.scalar(
            select(LessonProgress).where(
                LessonProgress.profile_id == profile_id,
                LessonProgress.lesson_id == data.lesson_id,
            )
        )
        if progress is None:
            progress = LessonProgress(
                profile_id=profile_id,
                lesson_id=data.lesson_id,
                best_score_pct=pct,
                attempts_count=1,
                completed=is_mastered(pct),
                last_attempt_at=now,
            )
            session.add(progress)
        else:
            # Best score never regresses and mastery is sticky.
            progress.best_score_pct = max(progress.best_score_pct, pct)
            progress.attempts_count += 1
            progress.completed = progress.completed or is_mastered(pct)
            progress.last_attempt_at = now

    await session.commit()
    logger.info(
        "Attempt saved",
        extra={
            "profile_id": str(profile_id),
            "mode": data.mode,
            "lesson_id": data.lesson_id,
            "score_pct": pct,
        },
    )
    return attempt, pct, progress


async def list_lesson_progress(
    session: AsyncSession, profile_id: uuid.UUID
) -> list[LessonProgress]:
    result = await session.scalars(
        select(LessonProgress)
        .where(LessonProgress.profile_id == profile_id)
        .order_by(LessonProgress.lesson_id)
    )
    return list(result)
