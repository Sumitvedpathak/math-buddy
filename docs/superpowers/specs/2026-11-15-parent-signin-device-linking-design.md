# Parent Google sign-in and child device linking: design

Date: 2026-11-15
Status: draft for review
Scope: sign-in and device linking only. Payments, the parent dashboard redesign, co-parent invites, Sign in with Apple and the mobile apps are separate, later features.

---

## 1. Why

Math Buddy is moving from "my family's practice app" to a product that other parents will use (and later pay for) within a couple of months. Native Android and iOS apps will follow, so every capability must be a backend API that any client can call.

Today there is no real identity:
- A child "signs in" by typing an email (`GET /profiles/lookup`). Anyone who knows or guesses that email gets that child's profile id. The profile id is then trusted from the request body (`POST /attempts`) or a header (`X-Profile-Id`, Writing Coach).
- `POST /questions/generate` and `POST /answers/evaluate` are open to anyone. Every call spends LLM money.
- The parent view is a single shared secret in the URL (`/admin/<token>`).

This feature replaces that with the industry-standard model for apps used by children under 13.

## 2. Decisions made with the owner

1. **The parent owns the account.** Parents sign in with **Google**. Sign in with Apple will be added when the iOS app is built (Apple requires it whenever Google sign-in is offered).
2. **Children are profiles, not accounts.** A parent creates each child with a name and a grade. Children have **no email, no password, no Google account**.
3. **Children get in by linking their own device** (Scenario B). In the parent area the parent creates a short one-time code for a child. The child types the code on their own device. That device is then signed in as that child.
4. **A linked device stays signed in until the parent unlinks it.** (Safeguards in §6.)
5. **No profile switching on the parent's device** (Scenario A is out).
6. **The parent's sign-in works like ChatGPT/Claude.** Google vouches for the parent once. After that, Math Buddy keeps its own session on the device and Google is not involved again.
7. **Small modules.** This document covers sign-in and linking only. The existing parent views (progress, Writing Coach panel) are **not** moved or redesigned here.

The owner's own children use **Windows laptops, each with his own Windows user profile, through a web browser**. That browser is the first "child device" this must work well on.

## 3. Goals, non-goals, anti-goals

**Goals**
- A parent can sign in with Google on the web, add children (name + grade), make a link code, see the linked devices and unlink any of them.
- A child can link a browser with a code and then practise exactly as today, without ever signing in again.
- Every API call that touches a child's data or spends LLM money requires a valid Math Buddy token, and the token alone decides which child's data it can touch.
- The same auth endpoints work for a future native app, which keeps tokens in Keychain/Keystore instead of cookies.
- The owner's sons keep all their existing history.

**Non-goals (this feature)**
- Payments, plans, trials.
- Parent dashboard redesign; moving the progress/Writing Coach views behind the parent sign-in.
- Co-parent / second guardian invites.
- Sign in with Apple, Android/iOS apps.
- Email notifications (for example "a new device was linked").
- Deleting a child or a parent account (needed before public launch; a separate module, see §11).

**Anti-goals (would make this a failure even if it works)**
- A child can reach another child's data, the parent area, or anything other than practice.
- The child needs an email address or must ever type a password.
- A linked laptop gets signed out every few days and needs a parent to re-link it.
- Auth that only works for the web (e.g. logic that depends on cookies at the core rather than at the edge).
- Collecting more about children than a name and a grade.

## 4. How it works

### 4.1 Parent sign-in (Google → Math Buddy tokens)

```
Browser                         Google                     Math Buddy API
1. "Continue with Google" ───────►
2. parent picks account
   ◄──────── Google ID token (signed by Google, ~1h)
3. POST /api/v1/auth/google {id_token, client:"web"} ─────────►
                                    4. verify signature, aud, iss, exp, email_verified
                                       find parent by (provider="google", sub)
                                       or create one
                                    5. create auth_session (kind=parent)
   ◄──────── access token (JSON) + refresh token (httpOnly cookie)
6. every API call: Authorization: Bearer <access token>
7. access token expired → POST /api/v1/auth/refresh (cookie) → new pair
```

- The parent is identified by Google's stable `sub`, **not by email**, because a Google account's email can change. Email is stored for display and contact.
- **First sign-in = sign-up.** Before the parent account is created, the client must send `accepted_terms_version`. The parent ticks "I am the parent or legal guardian and agree to the Terms and Privacy Policy". We store the version and the time. This is the minimum consent record we need before other parents join; the policy text itself is not part of this feature. *(Design call:)* the tick box links to placeholder `/terms` and `/privacy` pages marked "draft". The current version is a setting, `MATH_BUDDY_TERMS_VERSION` (default `2026-11-draft`). The backend records whatever current version the client accepted and does not ask for re-consent yet. Real policy text is required before other parents are invited, and asking for re-consent when the version changes comes with it. If the parent account does not exist yet and the field is missing, the API answers `409 {"error":"consent_required"}` and the client shows the tick box, then calls again.
- On the web, use the **Google Identity Services** script (`accounts.google.com/gsi/client`) directly, not an npm wrapper, so no new frontend package is needed. A native app later uses the platform Google Sign-In SDK and sends the same ID token to the same endpoint (with `client:"native"`).

### 4.2 Linking a child's device

```
Parent area: child "Aarav" → [Link a device]
  POST /api/v1/children/{id}/link-codes  → { code: "7K4Q-9PXM", expires_at }   (shown big, with a 10-min countdown)

Child's browser: start screen → "I'm a kid" → enter 7K4Q-9PXM
  POST /api/v1/auth/link {code, client:"web", device_name?}
  → creates auth_session (kind=child, child_profile_id=Aarav)
  → access token (JSON) + refresh token (cookie), same as a parent
  → the app opens Aarav's practice home
```

- Codes: 8 characters from a 31-character alphabet with no look-alike characters (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ` minus `O/0/I/1`), shown as `XXXX-XXXX`. Entry is case-insensitive and ignores the dash and spaces. They are single use and expire after 10 minutes. Making a new code for a child cancels that child's previous unused code. Only the hash is stored.
- `device_name` is taken from the browser's user agent ("Chrome on Windows"). The parent can rename it later in the device list.
- A browser holds **one** session at a time. If a parent session already exists in that browser and a code is redeemed, the client warns ("This will sign the parent out of this browser") and then replaces it.

### 4.3 Who can call what

Two kinds of access token, distinguished by a `kind` claim:

| Endpoint | Parent token | Child token | No token |
|---|---|---|---|
| `POST /auth/google`, `/auth/link`, `/auth/refresh`, `/auth/logout` | n/a | n/a | yes |
| `GET /me` (who am I: parent with children, or child profile) | yes | yes | – |
| `GET/POST /children`, `PATCH /children/{id}` (rename, change grade) | own children | – | – |
| `POST /children/{id}/link-codes` | own children | – | – |
| `GET /children/{id}/devices`, `PATCH`/`DELETE /devices/{session_id}` | own children | – | – |
| `POST /questions/generate`, `POST /answers/evaluate` | – | yes | – |
| `GET /curriculum` | yes | yes | – |
| `POST /attempts` | – | yes (profile **from token**) | – |
| `GET /me/lesson-status` (replaces `/profiles/{id}/lesson-status`) | – | yes | – |
| `/admin/*` (existing, `X-Admin-Token`) | unchanged in this feature | | |

- A child token **never** chooses a profile through a body field, path or header. The profile comes from the token. `profile_id` is removed from the `POST /attempts` request body.
- A parent asking for another parent's child gets **404** (not 403), so ids cannot be probed.
- Parent tokens cannot generate or evaluate questions in this feature (parents do not practise).
- **Removed:** `GET /profiles/lookup`, `POST /profiles`, `GET /profiles/{id}/lesson-status`.
- **Writing Coach** is on `origin/main` (PRs #6, #7) and live in production. This feature replaces its `X-Profile-Id` student dependency with "child token required" (backend dependency in `app/writing_coach/api.py`, and `wcApi.js` sends the bearer token instead of the header). The grade 7 check stays, now read from the token's profile. Its parent routes stay on `X-Admin-Token` until the dashboard module. Work on the unmerged `feature/wc-teacher-rubric` branch rebases onto this.

## 5. Data model (new Alembic migration `0003`, after Writing Coach's `0002`, on `origin/main`)

```
parents
  id                uuid pk
  email             text not null            -- latest from Google, display/contact only
  display_name      text not null
  accepted_terms_version text not null
  accepted_terms_at timestamptz not null
  created_at, last_login_at

auth_identities                              -- room for Apple later
  id uuid pk, parent_id fk → parents
  provider text  ('google' now; 'apple' later)
  subject  text  (Google 'sub')
  email_at_signin text
  created_at
  unique(provider, subject)

profiles  (existing table = children)
  + parent_id  uuid fk → parents, NULL only for legacy rows not yet claimed
  ~ email      becomes NULLABLE (new children have none; legacy rows keep theirs)
  grade check unchanged ('6','7')

auth_sessions                                -- one row per signed-in device
  id                uuid pk
  kind              'parent' | 'child'
  parent_id         fk → parents      (set for both kinds: the owning parent)
  child_profile_id  fk → profiles     (set only for kind='child')
  refresh_hash      text   -- sha256 of current refresh token
  prev_refresh_hash text   -- sha256 of the one before (see rotation)
  rotated_at        timestamptz
  current_used_at   timestamptz null  -- see rotation rules in §6
  device_name       text
  user_agent        text
  created_at, last_used_at, idle_expires_at
  revoked_at        timestamptz null
  index on refresh_hash, prev_refresh_hash

link_codes
  id uuid pk
  child_profile_id fk, parent_id fk
  code_hash text unique
  expires_at, used_at null, created_at
```

## 6. Tokens and safety

**Access token:** a JWT (HS256, secret `MATH_BUDDY_JWT_SECRET`), valid **15 minutes**. Claims: `sub` (parent id or child profile id), `kind`, `sid` (session id), `pid` (owning parent id), `iat`, `exp`, `iss`, `aud`. No database lookup per request. Revocation takes effect within 15 minutes at most.

**Refresh token:** 32 random bytes, sent only to `/auth/refresh` and `/auth/logout`. The database stores only its SHA-256.

| | Parent session | Child (linked device) session |
|---|---|---|
| Idle expiry (pushed forward on every refresh) | 60 days | 180 days |
| Absolute expiry | none | none: lasts until unlinked |

**Rotation with reuse detection:** every refresh issues a new refresh token. The old hash moves to `prev_refresh_hash`. The session also has `current_used_at` (null until the newest token has been presented once).
- If the **current** token is presented: set `current_used_at`, rotate normally.
- If the **previous** token is presented **within 30 seconds** of the rotation: this is two tabs refreshing at the same moment. Return `409 {"error":"refresh_race"}`. The client retries once; on the web the browser already holds the new cookie, so the retry succeeds.
- If the **previous** token is presented after 30 seconds **and the newest token has never been used** (`current_used_at` is null): the reply to the last refresh was lost (lid closed, Wi-Fi dropped). Accept it and rotate again from it. *(Owner-approved intent: a linked laptop must not be signed out by a lost reply. Design call: this tolerance.)*
- If the **previous** token is presented after the newest one **has** been used, or any older token is presented: treat it as theft. **Revoke the session** and return 401. The device must sign in or link again.
- Revoked, idle-expired or unknown token: 401.

**Web delivery:**
- Refresh token in a cookie `mb_refresh`: `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`. (`Secure` may be relaxed for `localhost` in dev via a setting.)
- Access token kept **in memory only** (not localStorage). It is lost on page reload and immediately recovered by calling `/auth/refresh` on app start.
- `/auth/refresh` and `/auth/logout` also require the header `X-Requested-With: mathbuddy` and an `Origin` in `CORS_ORIGINS`, as a CSRF guard on top of SameSite.

**Native delivery (future):** with `client:"native"`, the refresh token is returned in the JSON body instead of a cookie, and is sent back in the body of `/auth/refresh`. Same rules otherwise.

**Same-origin API (required for the cookie):** today the frontend (`math-buddy-app-…run.app`) calls the API on a different `run.app` host. Browsers treat these as different sites and increasingly block cookies between them (Safari already does). So the production frontend's nginx must proxy `/api/` to the backend service (exactly like the Vite dev proxy already does), and the production build uses a relative API base. The browser then only ever talks to one site. A custom domain is not needed.

**Abuse limits:**
- `POST /auth/link`: 10 failed attempts per IP per 15 minutes. In-memory per instance is acceptable: a code has ~40 bits of entropy and lives 10 minutes, so guessing is infeasible even across instances. Log every failure.
- `POST /children/{id}/link-codes`: 20 per parent per hour.
- `POST /auth/google`: no extra limit (Google verification is the gate).

**Other rules:**
- Google ID tokens are verified with the `google-auth` library against an allow-list of our OAuth client IDs (`MATH_BUDDY_GOOGLE_CLIENT_IDS`, comma-separated: web now, Android/iOS later). `email_verified` must be true.
- All failures from `/auth/*` give a generic message; details go to the logs.
- Logs never contain tokens, codes or ID tokens; they may contain session ids and parent/profile ids.
- Without `MATH_BUDDY_DATABASE_URL`, auth cannot work. Therefore `generate`/`evaluate` now also need the database (this changes the "Postgres is optional" note in CLAUDE.md).

## 7. API summary (all under `/api/v1`)

```
POST   /auth/google        {id_token, client, accepted_terms_version?} → {access_token, expires_in, me}  (+cookie | refresh_token)
POST   /auth/link          {code, client, device_name?}                → same shape, kind=child
POST   /auth/refresh       (cookie | {refresh_token})                  → same shape (rotated)
POST   /auth/logout        (cookie | {refresh_token})                  → 204, revokes this session
GET    /me                                                             → {kind:"parent", parent, children[]} | {kind:"child", profile}
GET    /children                                                       → children of this parent
POST   /children           {display_name, grade}                       → child
PATCH  /children/{id}      {display_name?, grade?}                     → child
POST   /children/{id}/link-codes                                       → {code, expires_at}
GET    /children/{id}/devices                                          → [{session_id, device_name, created_at, last_used_at}]
PATCH  /devices/{session_id}  {device_name}                            → device
DELETE /devices/{session_id}                                           → 204 (unlink = revoke)
GET    /me/lesson-status                                               → as today's lesson-status
POST   /attempts           (profile_id removed from body)              → as today
POST   /questions/generate, /answers/evaluate, GET /curriculum         → as today, now token-protected
```

`me` in the auth responses is the same object `GET /me` returns, so a client knows where to go after any sign-in.

## 8. Frontend (web)

- **Start screen** replaces today's email `profile` screen and has two choices:
  - "I'm a parent": consent tick box if needed, then Google button.
  - "I'm a kid": code box.
- **On app load:** call `/auth/refresh`.
  - Child session: go to that child's practice home (grade sets the age group exactly as today).
  - Parent session: go to the parent area.
  - No session: start screen.
- **Parent area (minimal, not the future dashboard):** list of children → add child (name, grade 6 or 7) → per child: "Link a device" (code + countdown), linked devices (name, last used, rename, **Unlink** with confirm). Plus "Sign out".
- **Child:** no sign-out button. The parent unlinks from the parent area. (If the device is unlinked, the next refresh fails and the start screen appears.)
- **`api.js`:** attaches the bearer token. On a 401, it does a **single shared refresh** (one in-flight promise per tab; across tabs, the 409 race rule covers it), then retries once. If refresh fails, it clears the session and shows the start screen.
- `localStorage` key `mathBuddy.profile` is removed. Nothing auth-related goes in `localStorage`.
- All new screens use the existing EduSpark tokens. The visuals are kept simple; the dashboard redesign is a later module.

## 9. Existing data

The sons' profiles exist today with an email and no parent. A one-off script `backend/scripts/assign_profiles_to_parent.py --parent-email <google email> --profile-email <email> [...]` attaches legacy profiles to a parent after that parent has signed in once. History (attempts, lesson progress, Writing Coach) is untouched because it hangs off `profiles.id`. Unclaimed legacy profiles stay in the database but cannot be reached by anyone until claimed.

## 10. Build order (each a small, testable module)

1. **Auth core (backend):** tables `parents`, `auth_identities`, `auth_sessions`; `/auth/google`, `/auth/refresh`, `/auth/logout`, `/me`; token issue/verify; rotation and reuse detection. Tests mock Google verification.
2. **Children and linking (backend):** `profiles.parent_id`, `link_codes`; `/children*`, `/auth/link`, devices list/rename/unlink; rate limits.
3. **Lock down existing endpoints (backend):** the token rules in §4.3; `/attempts` takes the profile from the token; remove the old profile endpoints; legacy assign script.
4. **Web client:** nginx `/api` proxy and relative API base; `api.js` token handling; start screen, parent area, kid link screen; remove the old profile screen.
5. **Deploy:** create the Google OAuth web client (authorised JavaScript origin = the frontend URL plus `http://localhost:5173`); secrets `MATH_BUDDY_JWT_SECRET`, `MATH_BUDDY_GOOGLE_CLIENT_IDS`; `alembic upgrade head`; deploy backend and frontend **together** (3 breaks the old frontend); claim the sons' profiles; link both laptops.

Modules 1–4 can merge to `main` one by one only if 3 and 4 ship in the same deploy.

## 11. Later features this sets up (not built here)
- Email when a device is linked; co-parent invite (both need an email provider).
- Delete a child (with all their data) and delete the parent account: required before public launch.
- Move the progress and Writing Coach parent views from `/admin/<token>` behind the parent sign-in, then redesign the dashboard.
- Sign in with Apple (`auth_identities.provider='apple'`), Android/iOS apps (`client:"native"`).
- Payments, attached to `parents`.

## 12. Left to the builder
- Library choices within the stack (e.g. PyJWT for JWTs; `google-auth` is decided).
- Exact screen layouts within the EduSpark tokens.
- Test structure, following the existing pytest/Vitest patterns (DB tests on in-memory SQLite).
- How the user-agent string is turned into a friendly device name.

## 13. Backend file layout (owner decision)

The backend is organised by feature (done on branch `refactor/feature-layout`, before this feature is built). Each feature folder has `router.py` (HTTP only), `service.py` (logic), `schemas.py` and `models.py`; shared plumbing is in `app/core/`; `main.py` includes one router per feature. This feature adds:

**`backend/app/account/`: everything about signing in and who can sign in**
- `router.py`: `POST /auth/google`, `/auth/link`, `/auth/refresh`, `/auth/logout`; `GET /me`; `GET/POST /children`, `PATCH /children/{id}`; `POST /children/{id}/link-codes`; `GET /children/{id}/devices`, `PATCH`/`DELETE /devices/{session_id}`
- `service.py`: Google check, sessions, refresh rotation, children, link codes, devices
- `tokens.py`: JWT issue/verify and refresh-token hashing (pure functions, no database, easy to unit test)
- `schemas.py`, `models.py` (`Parent`, `AuthIdentity`, `AuthSession`, `LinkCode`)

**Changes to existing features**
- `app/core/deps.py` gains `require_parent`, `require_child` and `require_signed_in`.
- `app/profiles/`: the lookup and create routes are removed (children are made through `/children`); `models.py` gets `parent_id` and a nullable `email`.
- `app/results/`: `POST /attempts` takes the profile from the token; `GET /profiles/{id}/lesson-status` becomes `GET /me/lesson-status`.
- `app/practice/` and `app/curriculum/`: routes gain the token checks from §4.3.
- `app/writing_coach/router.py`: `current_profile` reads the child token instead of `X-Profile-Id`.
- `alembic/env.py` imports `app.account.models`.

Tests: `tests/account/` (API flow and `tokens.py` unit tests). The frontend client gets the matching calls in `lib/api.js`.
