import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.profiles.schemas import DisplayName, Grade

# "web": refresh token in an HttpOnly cookie. "native" (future apps): in the JSON body.
Client = Literal["web", "native"]


class GoogleSignIn(BaseModel):
    id_token: str = Field(min_length=1)
    # Required only the first time (sign-up): the terms version the parent ticked.
    accepted_terms_version: str | None = None
    client: Client = "web"


class RefreshIn(BaseModel):
    """Native clients send their refresh token here; web clients send nothing (cookie)."""

    refresh_token: str | None = None


class ParentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    display_name: str


class ChildCreate(BaseModel):
    display_name: DisplayName
    grade: Grade


class ChildUpdate(BaseModel):
    display_name: DisplayName | None = None
    grade: Grade | None = None


class ChildOut(BaseModel):
    """All we keep about a child: a name and a grade."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    display_name: str
    grade: Grade


class ParentMe(BaseModel):
    kind: Literal["parent"] = "parent"
    parent: ParentOut
    children: list[ChildOut]


class SignedIn(BaseModel):
    access_token: str
    expires_in: int  # seconds
    me: ParentMe
    refresh_token: str | None = None  # native clients only
