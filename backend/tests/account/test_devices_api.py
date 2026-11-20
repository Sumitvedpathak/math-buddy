"""Step 5: the parent sees each child's linked devices, renames and unlinks them,
and can cancel a link code that has not been used yet."""

import jwt
import pytest

from tests.account.helpers import add_child, link_device, make_code, parent_headers

CHROME_WINDOWS = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
)


@pytest.fixture(autouse=True)
def fresh_limits():
    from app.account.router import link_failures

    link_failures.clear()
    yield
    link_failures.clear()


@pytest.fixture
async def family(client):
    """Ana with one child, Aarav."""
    headers = await parent_headers(client)
    child = await add_child(client, headers, "Aarav", "7")
    return headers, child


async def devices(client, headers, child_id):
    resp = await client.get(f"/api/v1/children/{child_id}/devices", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def refresh(client, signed_in):
    return await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": signed_in["refresh_token"]}
    )


def session_id(signed_in):
    claims = jwt.decode(signed_in["access_token"], options={"verify_signature": False})
    return claims["sid"]


# --- Device list -------------------------------------------------------------------


async def test_no_devices_before_linking(client, family):
    headers, child = family
    assert await devices(client, headers, child["id"]) == []


async def test_linked_device_is_listed_with_a_friendly_name(client, family):
    headers, child = family
    signed_in = await link_device(client, headers, child["id"], CHROME_WINDOWS)

    [device] = await devices(client, headers, child["id"])
    assert set(device) == {"session_id", "device_name", "created_at", "last_used_at"}
    assert device["session_id"] == session_id(signed_in)
    assert device["device_name"] == "Chrome on Windows"


async def test_list_shows_only_this_childs_devices(client, family):
    headers, child = family
    sister = await add_child(client, headers, "Anya", "6")
    await link_device(client, headers, child["id"])
    await link_device(client, headers, child["id"])
    await link_device(client, headers, sister["id"])

    assert len(await devices(client, headers, child["id"])) == 2
    assert len(await devices(client, headers, sister["id"])) == 1


async def test_another_parent_cannot_see_the_devices(client, family):
    headers, child = family
    await link_device(client, headers, child["id"])
    ben = await parent_headers(client, "token-ben")
    resp = await client.get(f"/api/v1/children/{child['id']}/devices", headers=ben)
    assert resp.status_code == 404


async def test_device_unused_past_the_idle_limit_is_not_listed(client, family, clock):
    headers, child = family
    await link_device(client, headers, child["id"])
    clock.advance(days=181)
    headers = await parent_headers(client)  # the old access token has expired
    assert await devices(client, headers, child["id"]) == []


# --- Rename ------------------------------------------------------------------------


async def test_parent_renames_a_device(client, family):
    headers, child = family
    signed_in = await link_device(client, headers, child["id"])

    resp = await client.patch(
        f"/api/v1/devices/{session_id(signed_in)}",
        json={"device_name": "  Aarav's laptop "},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["device_name"] == "Aarav's laptop"
    [device] = await devices(client, headers, child["id"])
    assert device["device_name"] == "Aarav's laptop"


@pytest.mark.parametrize("name", ["", "   ", "x" * 61])
async def test_rename_needs_a_sensible_name(client, family, name):
    headers, child = family
    signed_in = await link_device(client, headers, child["id"])
    resp = await client.patch(
        f"/api/v1/devices/{session_id(signed_in)}",
        json={"device_name": name},
        headers=headers,
    )
    assert resp.status_code == 422


async def test_another_parent_cannot_rename(client, family):
    headers, child = family
    signed_in = await link_device(client, headers, child["id"])
    ben = await parent_headers(client, "token-ben")
    resp = await client.patch(
        f"/api/v1/devices/{session_id(signed_in)}",
        json={"device_name": "mine now"},
        headers=ben,
    )
    assert resp.status_code == 404


async def test_parents_own_sign_in_is_not_a_device(client, family):
    headers, _ = family
    own = await client.post(
        "/api/v1/auth/google", json={"id_token": "token-ana", "client": "native"}
    )
    url = f"/api/v1/devices/{session_id(own.json())}"
    resp = await client.patch(url, json={"device_name": "x"}, headers=headers)
    assert resp.status_code == 404
    assert (await client.delete(url, headers=headers)).status_code == 404


async def test_child_token_cannot_manage_devices(client, family):
    headers, child = family
    signed_in = await link_device(client, headers, child["id"])
    child_headers = {"Authorization": f"Bearer {signed_in['access_token']}"}
    resp = await client.delete(
        f"/api/v1/devices/{session_id(signed_in)}", headers=child_headers
    )
    assert resp.status_code == 403


# --- Unlink ------------------------------------------------------------------------


async def test_unlinked_device_is_signed_out(client, family):
    headers, child = family
    signed_in = await link_device(client, headers, child["id"])

    resp = await client.delete(
        f"/api/v1/devices/{session_id(signed_in)}", headers=headers
    )
    assert resp.status_code == 204
    assert await devices(client, headers, child["id"]) == []
    assert (await refresh(client, signed_in)).status_code == 401


async def test_unlink_leaves_other_devices_signed_in(client, family):
    headers, child = family
    first = await link_device(client, headers, child["id"])
    second = await link_device(client, headers, child["id"])

    await client.delete(f"/api/v1/devices/{session_id(first)}", headers=headers)

    assert (await refresh(client, first)).status_code == 401
    assert (await refresh(client, second)).status_code == 200


async def test_another_parent_cannot_unlink(client, family):
    headers, child = family
    signed_in = await link_device(client, headers, child["id"])
    ben = await parent_headers(client, "token-ben")

    resp = await client.delete(f"/api/v1/devices/{session_id(signed_in)}", headers=ben)
    assert resp.status_code == 404
    assert (await refresh(client, signed_in)).status_code == 200


# --- Linked count on the children list ----------------------------------------------


async def linked_count(client, headers):
    children = (await client.get("/api/v1/children", headers=headers)).json()
    return children[0]["linked_devices"]


async def test_children_show_how_many_devices_are_linked(client, family):
    headers, child = family
    assert child["linked_devices"] == 0
    assert await linked_count(client, headers) == 0

    first = await link_device(client, headers, child["id"])
    await link_device(client, headers, child["id"])
    assert await linked_count(client, headers) == 2
    me = (await client.get("/api/v1/me", headers=headers)).json()
    assert me["children"][0]["linked_devices"] == 2

    await client.post(
        "/api/v1/auth/logout", json={"refresh_token": first["refresh_token"]}
    )
    assert await linked_count(client, headers) == 1


async def test_child_device_does_not_see_the_device_count(client, family):
    headers, child = family
    signed_in = await link_device(client, headers, child["id"])
    assert "linked_devices" not in signed_in["me"]["profile"]


# --- Cancel a code -----------------------------------------------------------------


async def link_with(client, code):
    return await client.post("/api/v1/auth/link", json={"code": code, "client": "native"})


async def test_parent_cancels_an_unused_code(client, family):
    headers, child = family
    code = await make_code(client, headers, child["id"])
    resp = await client.delete(
        f"/api/v1/children/{child['id']}/link-codes", headers=headers
    )
    assert resp.status_code == 204
    assert (await link_with(client, code)).status_code == 401


async def test_another_parent_cannot_cancel_a_code(client, family):
    headers, child = family
    code = await make_code(client, headers, child["id"])
    ben = await parent_headers(client, "token-ben")
    resp = await client.delete(
        f"/api/v1/children/{child['id']}/link-codes", headers=ben
    )
    assert resp.status_code == 404
    assert (await link_with(client, code)).status_code == 200
