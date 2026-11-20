from datetime import timedelta

import pytest

from app.core.db import utcnow
from tests.account.helpers import GOOGLE_CLAIMS


@pytest.fixture(autouse=True)
def fake_google(monkeypatch):
    calls = []

    def verify(token, request, audience):
        calls.append(audience)
        if token not in GOOGLE_CLAIMS:
            raise ValueError("Token signature is invalid")
        return GOOGLE_CLAIMS[token]

    monkeypatch.setattr("google.oauth2.id_token.verify_oauth2_token", verify)
    return calls


@pytest.fixture
def clock(monkeypatch):
    """Lets a test move the server's clock forward."""

    class Clock:
        now = utcnow()

        def advance(self, **kwargs):
            self.now += timedelta(**kwargs)

    c = Clock()
    monkeypatch.setattr("app.account.service.utcnow", lambda: c.now)
    return c
