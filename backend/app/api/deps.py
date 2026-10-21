import hmac
from typing import Annotated

from fastapi import Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_session

SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def require_admin(
    x_admin_token: Annotated[str | None, Header()] = None,
) -> None:
    """Gate for /api/v1/admin/*. Placeholder for real login — swap only this function.

    Any failure (missing header, wrong token, token not configured) is a generic
    404 so a wrong guess does not even confirm the admin API exists.
    """
    expected = get_settings().admin_token
    if (
        not expected
        or not x_admin_token
        or not hmac.compare_digest(x_admin_token.encode(), expected.encode())
    ):
        raise HTTPException(status_code=404, detail="Not Found")
