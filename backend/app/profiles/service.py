import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.profiles.models import Profile


class ProfileNotFoundError(Exception):
    pass


async def require_profile(session: AsyncSession, profile_id: uuid.UUID) -> Profile:
    profile = await session.get(Profile, profile_id)
    if profile is None:
        raise ProfileNotFoundError(str(profile_id))
    return profile
