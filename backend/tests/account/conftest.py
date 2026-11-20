import pytest

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
