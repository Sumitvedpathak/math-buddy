import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

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


class ParentChildOut(ChildOut):
    """A child as the parent sees it: also how many devices are signed in as them."""

    linked_devices: int = 0


class ParentMe(BaseModel):
    kind: Literal["parent"] = "parent"
    parent: ParentOut
    children: list[ParentChildOut]


class ChildMe(BaseModel):
    """A linked child device."""

    kind: Literal["child"] = "child"
    profile: ChildOut


Me = Annotated[ParentMe | ChildMe, Field(discriminator="kind")]


class LinkCodeOut(BaseModel):
    code: str  # shown once, e.g. "7K4Q-9PXM"
    expires_at: datetime


class LinkIn(BaseModel):
    code: str = Field(max_length=32)
    client: Client = "web"
    # Optional name the device gives itself; otherwise worked out from the browser.
    device_name: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)] | None
    ) = None


class SignedIn(BaseModel):
    access_token: str
    expires_in: int  # seconds
    me: Me
    refresh_token: str | None = None  # native clients only


DeviceName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)
]


class DeviceOut(BaseModel):
    """A device signed in as a child (one auth session)."""

    session_id: uuid.UUID
    device_name: str
    created_at: datetime
    last_used_at: datetime


class DeviceRename(BaseModel):
    device_name: DeviceName
