import logging
import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import LessonProgress, Profile
from app.schemas.profiles import ProfileCreate

logger = logging.getLogger(__name__)


class ProfileExistsError(Exception):
    pass


class ProfileNotFoundError(Exception):
    pass


async def find_by_email(session: AsyncSession, email: str) -> Profile | None:
    """Read-only lookup. `email` must already be normalized."""
    return await session.scalar(select(Profile).where(Profile.email == email))


async def create_profile(session: AsyncSession, data: ProfileCreate) -> Profile:
    profile = Profile(
        email=data.email, display_name=data.display_name, grade=data.grade
    )
    session.add(profile)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise ProfileExistsError(data.email) from exc
    logger.info("Profile created", extra={"profile_id": str(profile.id), "grade": profile.grade})
    return profile


async def require_profile(session: AsyncSession, profile_id: uuid.UUID) -> Profile:
    profile = await session.get(Profile, profile_id)
    if profile is None:
        raise ProfileNotFoundError(str(profile_id))
    return profile


async def list_lesson_progress(
    session: AsyncSession, profile_id: uuid.UUID
) -> list[LessonProgress]:
    result = await session.scalars(
        select(LessonProgress)
        .where(LessonProgress.profile_id == profile_id)
        .order_by(LessonProgress.lesson_id)
    )
    return list(result)
