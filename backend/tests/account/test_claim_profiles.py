"""The one-off move of the old email profiles to a parent (scripts/assign_profiles_to_parent.py)."""

import uuid

import pytest

from app.account.service import ClaimFailed, claim_legacy_profiles
from app.core.db import get_session
from app.main import app
from app.profiles.models import Profile
from tests.account.helpers import add_child, parent_headers


@pytest.fixture
async def db(client):
    """A database session on the same in-memory database the client uses."""
    sessions = app.dependency_overrides[get_session]()
    session = await anext(sessions)
    yield session
    await sessions.aclose()


async def old_profile(db, email, name="Aarav"):
    profile = Profile(email=email, display_name=name, grade="7")
    db.add(profile)
    await db.commit()
    return profile


async def children(client, headers):
    return (await client.get("/api/v1/children", headers=headers)).json()


async def test_old_profiles_become_the_parents_children(client, db):
    headers = await parent_headers(client)  # ana@example.com has signed in once
    aarav = await old_profile(db, "aarav@example.com", "Aarav")
    vihaan = await old_profile(db, "vihaan@example.com", "Vihaan")

    claimed = await claim_legacy_profiles(
        db, " Ana@Example.com ", ["AARAV@example.com", "vihaan@example.com"]
    )

    assert {p.id for p in claimed} == {aarav.id, vihaan.id}
    listed = await children(client, headers)
    assert {c["display_name"] for c in listed} == {"Aarav", "Vihaan"}
    # A claimed child can be linked like any other.
    resp = await client.post(
        f"/api/v1/children/{aarav.id}/link-codes", headers=headers
    )
    assert resp.status_code == 201


async def test_claiming_again_changes_nothing(client, db):
    headers = await parent_headers(client)
    await old_profile(db, "aarav@example.com")
    await claim_legacy_profiles(db, "ana@example.com", ["aarav@example.com"])
    await claim_legacy_profiles(db, "ana@example.com", ["aarav@example.com"])
    assert len(await children(client, headers)) == 1


async def test_parent_must_have_signed_in_first(client, db):
    await old_profile(db, "aarav@example.com")
    with pytest.raises(ClaimFailed, match="No parent"):
        await claim_legacy_profiles(db, "nobody@example.com", ["aarav@example.com"])


async def test_all_or_nothing_when_a_profile_is_missing(client, db):
    headers = await parent_headers(client)
    await old_profile(db, "aarav@example.com")
    with pytest.raises(ClaimFailed, match="typo@example.com"):
        await claim_legacy_profiles(
            db, "ana@example.com", ["aarav@example.com", "typo@example.com"]
        )
    assert await children(client, headers) == []


async def test_never_takes_another_parents_child(client, db):
    ana = await parent_headers(client)
    await parent_headers(client, "token-ben")
    child = await add_child(client, ana, "Aarav")
    profile = await db.get(Profile, uuid.UUID(child["id"]))
    profile.email = "aarav@example.com"
    await db.commit()

    with pytest.raises(ClaimFailed, match="already belongs"):
        await claim_legacy_profiles(db, "ben@example.com", ["aarav@example.com"])
