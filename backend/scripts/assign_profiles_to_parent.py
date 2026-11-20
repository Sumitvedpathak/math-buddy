"""Give the old email profiles (from before parent sign-in) to a parent. One-off.

The parent must have signed in on /parent once first. Run from backend/:

    uv run python scripts/assign_profiles_to_parent.py \
        --parent-email you@gmail.com \
        --profile-email son1@example.com --profile-email son2@example.com

All or nothing: a missing profile, or one that already belongs to another parent,
stops it before anything changes. Running it again is harmless. History (attempts,
lesson progress, Writing Coach) stays, because it hangs off the profile id.
Uses MATH_BUDDY_DATABASE_URL from backend/.env, like the app.
"""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.account.service import ClaimFailed, claim_legacy_profiles  # noqa: E402
from app.core.db import get_sessionmaker  # noqa: E402


async def run(parent_email: str, profile_emails: list[str]) -> int:
    async with get_sessionmaker()() as session:
        try:
            profiles = await claim_legacy_profiles(session, parent_email, profile_emails)
        except ClaimFailed as exc:
            print(f"Nothing changed: {exc}", file=sys.stderr)
            return 1
    for p in profiles:
        print(f"{p.display_name} (grade {p.grade}) now belongs to {parent_email}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--parent-email", required=True)
    parser.add_argument("--profile-email", action="append", required=True)
    args = parser.parse_args()
    return asyncio.run(run(args.parent_email, args.profile_email))


if __name__ == "__main__":
    sys.exit(main())
