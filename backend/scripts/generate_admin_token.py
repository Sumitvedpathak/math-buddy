"""Generate the permanent admin token (32 random bytes, hex-encoded = 64 chars).

    python scripts/generate_admin_token.py              # print the token
    python scripts/generate_admin_token.py --write-env  # append it to backend/.env
                                                        # without echoing it

Store the same value in GCP Secret Manager as MATH_BUDDY_ADMIN_TOKEN. The admin
URL is then /admin/<token>. The token never auto-rotates.
"""

import secrets
import sys
from pathlib import Path

ENV_PATH = Path(__file__).parent.parent / ".env"
KEY = "MATH_BUDDY_ADMIN_TOKEN"


def main() -> int:
    token = secrets.token_hex(32)
    if "--write-env" not in sys.argv:
        print(token)
        return 0

    existing = ENV_PATH.read_text(encoding="utf-8") if ENV_PATH.exists() else ""
    if any(line.startswith(f"{KEY}=") for line in existing.splitlines()):
        print(f"{KEY} already set in {ENV_PATH}; not overwriting.", file=sys.stderr)
        return 1
    sep = "" if existing.endswith("\n") or not existing else "\n"
    with ENV_PATH.open("a", encoding="utf-8") as f:
        f.write(f"{sep}{KEY}={token}\n")
    print(f"Wrote {KEY} to {ENV_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
