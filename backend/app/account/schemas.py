import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class GoogleSignIn(BaseModel):
    id_token: str = Field(min_length=1)
    # Required only the first time (sign-up): the terms version the parent ticked.
    accepted_terms_version: str | None = None


class ParentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    display_name: str


class ParentMe(BaseModel):
    kind: Literal["parent"] = "parent"
    parent: ParentOut


class SignedIn(BaseModel):
    access_token: str
    expires_in: int  # seconds
    me: ParentMe
