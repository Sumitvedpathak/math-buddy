import hmac
from typing import Annotated

from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.account.tokens import InvalidAccessToken, TokenClaims, verify_access_token
from app.core.config import get_settings
from app.core.db import get_session

SessionDep = Annotated[AsyncSession, Depends(get_session)]

_bearer = HTTPBearer(auto_error=False)


async def require_signed_in(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> TokenClaims:
    """Any valid Math Buddy access token (`Authorization: Bearer ...`), parent or child."""
    secret = get_settings().jwt_secret
    if credentials is None or not secret:
        raise _not_signed_in()
    try:
        return verify_access_token(secret, credentials.credentials)
    except InvalidAccessToken as exc:
        raise _not_signed_in() from exc


def _not_signed_in() -> HTTPException:
    return HTTPException(
        status_code=401, detail="Not signed in", headers={"WWW-Authenticate": "Bearer"}
    )


SignedInDep = Annotated[TokenClaims, Depends(require_signed_in)]


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
