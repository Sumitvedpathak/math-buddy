"""Step 4: a parent makes a one-time code for a child; the child's device links with it.

POST /children/{id}/link-codes (parent) and POST /auth/link (no token: the code is the proof).
"""

import re
import uuid
from datetime import datetime

import jwt
import pytest

from app.account.service import friendly_device_name
from app.account.tokens import issue_access_token, normalize_link_code
from app.core.config import get_settings
from tests.account.helpers import add_child, parent_headers

CODE_RE = re.compile(r"^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$")
LINK = "/api/v1/auth/link"


@pytest.fixture(autouse=True)
def fresh_limits():
    from app.account.router import link_failures

    link_failures.clear()
    yield
    link_failures.clear()


def as_child_sees(child):
    """The child's own view of their profile: no device count."""
    return {k: v for k, v in child.items() if k != "linked_devices"}


async def make_code(client, headers, child_id):
    resp = await client.post(f"/api/v1/children/{child_id}/link-codes", headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def link(client, code, **extra):
    return await client.post(LINK, json={"code": code, "client": "native", **extra})


@pytest.fixture
async def family(client):
    """Ana with one child, Aarav (grade 7)."""
    headers = await parent_headers(client)
    child = await add_child(client, headers, "Aarav", "7")
    return headers, child


# --- Making a code ------------------------------------------------------------------


async def test_parent_gets_a_short_code_valid_for_ten_minutes(client, family, clock):
    headers, child = family
    body = await make_code(client, headers, child["id"])
    assert CODE_RE.match(body["code"])
    expires = datetime.fromisoformat(body["expires_at"])
    assert abs((expires - clock.now).total_seconds() - 600) < 5


async def test_codes_are_different_each_time(client, family):
    headers, child = family
    a = (await make_code(client, headers, child["id"]))["code"]
    b = (await make_code(client, headers, child["id"]))["code"]
    assert a != b


async def test_no_code_for_another_parents_child(client, family):
    _, child = family
    ben = await parent_headers(client, "token-ben")
    resp = await client.post(f"/api/v1/children/{child['id']}/link-codes", headers=ben)
    assert resp.status_code == 404


async def test_child_token_cannot_make_codes(client, family):
    _, child = family
    some = uuid.uuid4()
    token = issue_access_token(
        get_settings().jwt_secret, sub=some, kind="child", pid=some, sid=some
    )
    resp = await client.post(
        f"/api/v1/children/{child['id']}/link-codes",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


async def test_at_most_20_codes_per_parent_per_hour(client, family, clock):
    headers, child = family
    for _ in range(20):
        await make_code(client, headers, child["id"])
    url = f"/api/v1/children/{child['id']}/link-codes"
    assert (await client.post(url, headers=headers)).status_code == 429
    clock.advance(minutes=61)
    assert (await client.post(url, headers=headers)).status_code == 201


# --- Linking a device ------------------------------------------------------------


async def test_child_device_links_with_the_code(client, family):
    headers, child = family
    code = (await make_code(client, headers, child["id"]))["code"]

    resp = await link(client, code)
    assert resp.status_code == 200
    body = resp.json()
    assert body["me"] == {"kind": "child", "profile": as_child_sees(child)}
    assert body["refresh_token"]
    claims = jwt.decode(body["access_token"], options={"verify_signature": False})
    assert claims["kind"] == "child"
    assert claims["sub"] == child["id"]


async def test_code_is_forgiving_about_case_spaces_and_dash(client, family):
    headers, child = family
    code = (await make_code(client, headers, child["id"]))["code"]
    typed = " " + code.replace("-", " ").lower() + " "
    assert (await link(client, typed)).status_code == 200


async def test_code_works_only_once(client, family):
    headers, child = family
    code = (await make_code(client, headers, child["id"]))["code"]
    assert (await link(client, code)).status_code == 200
    again = await link(client, code)
    assert again.status_code == 401
    assert again.json() == {"detail": "Code not valid"}


async def test_code_expires_after_ten_minutes(client, family, clock):
    headers, child = family
    code = (await make_code(client, headers, child["id"]))["code"]
    clock.advance(minutes=11)
    assert (await link(client, code)).status_code == 401


async def test_new_code_cancels_the_previous_one(client, family):
    headers, child = family
    first = (await make_code(client, headers, child["id"]))["code"]
    second = (await make_code(client, headers, child["id"]))["code"]
    assert (await link(client, first)).status_code == 401
    assert (await link(client, second)).status_code == 200


@pytest.mark.parametrize("code", ["", "ABCD-EFGH", "nonsense", "1111-1111"])
async def test_wrong_code_refused(client, family, code):
    assert (await link(client, code)).status_code in (401, 422)


async def test_ten_wrong_codes_lock_out_that_address(client, family):
    headers, child = family
    for _ in range(10):
        assert (await link(client, "ABCD-EFGH")).status_code == 401
    code = (await make_code(client, headers, child["id"]))["code"]
    assert (await link(client, code)).status_code == 429


async def test_web_link_sets_the_refresh_cookie(client, family):
    headers, child = family
    code = (await make_code(client, headers, child["id"]))["code"]
    resp = await client.post(LINK, json={"code": code})
    assert resp.status_code == 200
    assert any(h.startswith("mb_refresh=") for h in resp.headers.get_list("set-cookie"))


# --- A linked device afterwards -------------------------------------------------


async def linked_child(client, family):
    headers, child = family
    code = (await make_code(client, headers, child["id"]))["code"]
    return child, (await link(client, code)).json()


async def test_me_on_a_linked_device_is_the_child(client, family):
    child, body = await linked_child(client, family)
    me = await client.get(
        "/api/v1/me", headers={"Authorization": f"Bearer {body['access_token']}"}
    )
    assert me.status_code == 200
    assert me.json() == {"kind": "child", "profile": as_child_sees(child)}


async def test_linked_device_refreshes_as_the_child(client, family):
    child, body = await linked_child(client, family)
    resp = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": body["refresh_token"]}
    )
    assert resp.status_code == 200
    assert resp.json()["me"] == {"kind": "child", "profile": as_child_sees(child)}


async def test_linked_device_stays_signed_in_far_longer_than_a_parent(
    client, family, clock
):
    _, body = await linked_child(client, family)
    clock.advance(days=150)  # a parent session would have expired after 60
    resp = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": body["refresh_token"]}
    )
    assert resp.status_code == 200


async def test_child_sees_renamed_profile(client, family):
    headers, child = family
    _, body = await linked_child(client, family)
    await client.patch(
        f"/api/v1/children/{child['id']}",
        json={"display_name": "Aaru"},
        headers=headers,
    )
    me = await client.get(
        "/api/v1/me", headers={"Authorization": f"Bearer {body['access_token']}"}
    )
    assert me.json()["profile"]["display_name"] == "Aaru"


# --- Small helpers ----------------------------------------------------------------


@pytest.mark.parametrize(
    "typed, expected",
    [
        ("7K4Q-9PXM", "7K4Q9PXM"),
        (" 7k4q 9pxm ", "7K4Q9PXM"),
        ("7K4Q9PXM", "7K4Q9PXM"),
        ("7K4Q-9PX", None),  # too short
        ("7K4Q-9PX0", None),  # 0 is never used
        ("", None),
    ],
)
def test_normalize_link_code(typed, expected):
    assert normalize_link_code(typed) == expected


@pytest.mark.parametrize(
    "user_agent, expected",
    [
        (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Chrome on Windows",
        ),
        (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
            "Edge on Windows",
        ),
        (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
            "(KHTML, like Gecko) Version/17.0 Safari/605.1.15",
            "Safari on Mac",
        ),
        (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 "
            "Firefox/132.0",
            "Firefox on Windows",
        ),
        ("", "Unknown device"),
        (None, "Unknown device"),
    ],
)
def test_friendly_device_name(user_agent, expected):
    assert friendly_device_name(user_agent) == expected


async def test_device_name_given_by_the_device_wins(client, family):
    # Stored for the device list (step 5); here we only check it is accepted.
    headers, child = family
    code = (await make_code(client, headers, child["id"]))["code"]
    resp = await link(client, code, device_name="Aarav's laptop")
    assert resp.status_code == 200
