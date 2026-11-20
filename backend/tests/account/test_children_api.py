"""Step 3: a parent adds and edits their children (GET/POST /children, PATCH /children/{id})."""

import uuid

import pytest

from app.account.tokens import issue_access_token
from app.core.config import get_settings
from tests.account.helpers import TERMS

CHILDREN = "/api/v1/children"


async def parent_headers(client, id_token="token-ana"):
    resp = await client.post(
        "/api/v1/auth/google",
        json={
            "id_token": id_token,
            "accepted_terms_version": TERMS,
            "client": "native",
        },
    )
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


async def add_child(client, headers, name="Aarav", grade="7"):
    resp = await client.post(
        CHILDREN, json={"display_name": name, "grade": grade}, headers=headers
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_parent_adds_a_child(client):
    headers = await parent_headers(client)
    resp = await client.post(
        CHILDREN, json={"display_name": "  Aarav ", "grade": "7"}, headers=headers
    )
    assert resp.status_code == 201
    child = resp.json()
    assert set(child) == {"id", "display_name", "grade"}  # nothing else about a child
    assert child["display_name"] == "Aarav"
    assert child["grade"] == "7"


async def test_children_are_listed_oldest_first(client):
    headers = await parent_headers(client)
    first = await add_child(client, headers, "Aarav", "7")
    second = await add_child(client, headers, "Mira", "6")
    resp = await client.get(CHILDREN, headers=headers)
    assert resp.status_code == 200
    assert [c["id"] for c in resp.json()] == [first["id"], second["id"]]


async def test_me_lists_the_children(client):
    headers = await parent_headers(client)
    child = await add_child(client, headers)
    me = (await client.get("/api/v1/me", headers=headers)).json()
    assert me["children"] == [child]


async def test_sign_in_reply_lists_the_children(client):
    headers = await parent_headers(client)
    child = await add_child(client, headers)
    again = await client.post(
        "/api/v1/auth/google", json={"id_token": "token-ana", "client": "native"}
    )
    assert again.json()["me"]["children"] == [child]


async def test_new_parent_has_no_children(client):
    headers = await parent_headers(client)
    assert (await client.get(CHILDREN, headers=headers)).json() == []


async def test_parent_renames_a_child_and_changes_grade(client):
    headers = await parent_headers(client)
    child = await add_child(client, headers, "Aarav", "6")

    renamed = await client.patch(
        f"{CHILDREN}/{child['id']}", json={"display_name": "Aaru"}, headers=headers
    )
    assert renamed.status_code == 200
    assert renamed.json() == {**child, "display_name": "Aaru"}

    regraded = await client.patch(
        f"{CHILDREN}/{child['id']}", json={"grade": "7"}, headers=headers
    )
    assert regraded.json() == {**child, "display_name": "Aaru", "grade": "7"}


@pytest.mark.parametrize(
    "body",
    [
        {"display_name": "Aarav", "grade": "8"},
        {"display_name": "   ", "grade": "7"},
        {"display_name": "x" * 81, "grade": "7"},
        {"grade": "7"},
    ],
)
async def test_invalid_child_refused(client, body):
    headers = await parent_headers(client)
    assert (await client.post(CHILDREN, json=body, headers=headers)).status_code == 422


async def test_invalid_change_refused(client):
    headers = await parent_headers(client)
    child = await add_child(client, headers)
    url = f"{CHILDREN}/{child['id']}"
    assert (
        await client.patch(url, json={"grade": "5"}, headers=headers)
    ).status_code == 422
    assert (
        await client.patch(url, json={"display_name": " "}, headers=headers)
    ).status_code == 422


async def test_parents_cannot_see_or_change_each_others_children(client):
    ana = await parent_headers(client, "token-ana")
    ben = await parent_headers(client, "token-ben")
    anas_child = await add_child(client, ana, "Aarav")

    assert (await client.get(CHILDREN, headers=ben)).json() == []
    resp = await client.patch(
        f"{CHILDREN}/{anas_child['id']}", json={"display_name": "Mine"}, headers=ben
    )
    assert resp.status_code == 404
    # Unchanged for Ana.
    assert (await client.get(CHILDREN, headers=ana)).json() == [anas_child]


async def test_unknown_child_is_404(client):
    headers = await parent_headers(client)
    resp = await client.patch(
        f"{CHILDREN}/{uuid.uuid4()}", json={"display_name": "X"}, headers=headers
    )
    assert resp.status_code == 404


async def test_children_need_sign_in(client):
    assert (await client.get(CHILDREN)).status_code == 401
    assert (
        await client.post(CHILDREN, json={"display_name": "A", "grade": "7"})
    ).status_code == 401


async def test_child_token_cannot_manage_children(client):
    some_id = uuid.uuid4()
    child_token = issue_access_token(
        get_settings().jwt_secret, sub=some_id, kind="child", pid=some_id, sid=some_id
    )
    headers = {"Authorization": f"Bearer {child_token}"}
    assert (await client.get(CHILDREN, headers=headers)).status_code == 403


async def test_admin_page_lists_a_child_without_email(client, admin_token):
    headers = await parent_headers(client)
    child = await add_child(client, headers)
    resp = await client.get(
        "/api/v1/admin/profiles", headers={"X-Admin-Token": admin_token}
    )
    assert resp.status_code == 200
    listed = {p["id"]: p for p in resp.json()}
    assert listed[child["id"]]["email"] is None
