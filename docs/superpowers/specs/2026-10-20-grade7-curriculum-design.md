# Grade 7 Curriculum Tracking — Design

**Date:** 2026-10-20
**Status:** Approved, pending implementation plan

## 1. Goal

Turn the 8 extracted curriculum units (46 lessons, from `resources/*.pdf`) into a
structured, trackable study path inside Math Buddy, alongside the existing
ad-hoc topic practice. A grade 7 student should be able to pick any
unit/lesson, practice it, and have the app remember whether he's mastered it
— without being able to see his own historical trend. A parent gets a
separate, more detailed view across all their children.

Source curriculum (already extracted, see conversation history for full
per-lesson key words):

| Unit | Title | Lessons |
|---|---|---|
| 2 | Ratio and Rate | 2.1–2.5 (5) |
| 3 | Geometry and Measurement (Prisms) | 3.1–3.6 (6) |
| 4 | Fractions and Decimals | 4.1–4.9 (9) |
| 5 | Data Management | 5.1–5.6 (6) |
| 6 | Measuring Perimeter and Area | 6.1–6.4 (4) |
| 7 | Geometry (Transformations) | 7.1–7.5 (5) |
| 8 | Working with Percents | 8.1–8.5 (5) |
| 10 | Patterning and Algebra | 10.1–10.6 (6) |

Units 1 and 9 are not present in `resources/` and are **out of scope** for
this iteration — add them later by dropping the PDFs in and re-running the
same extraction (pypdf text extraction + lesson-header regex), no redesign
needed.

## 2. Non-goals (explicitly out of scope for this iteration)

- Real authentication (passwords, email verification, sessions) — both the
  child profile picker and the admin page use lightweight, non-cryptographic
  gates for now. Noted as future work.
- A kid-facing history/trend/calendar view — explicitly excluded per product
  decision; kids see only current lesson-completion status and their most
  recent attempt's score.
- DB-backed curriculum content — stays static JSON until there's a concrete
  need to edit lesson text from the admin page.
- Multi-device conflict resolution beyond normal DB writes (no offline mode,
  no merge logic) — not needed since Postgres is the single source of truth
  per profile.
- Units 1 and 9.

## 3. Data model (Postgres)

New tables, additive to the existing backend (which currently has no DB).

```sql
profiles
  id            uuid pk
  email         text unique not null
  display_name  text not null
  grade         text not null check (grade in ('6', '7'))
  created_at    timestamptz not null default now()

lesson_progress
  id              uuid pk
  profile_id      uuid not null references profiles(id)
  lesson_id       text not null            -- e.g. "10.3"
  best_score_pct  numeric not null default 0
  attempts_count  integer not null default 0
  completed       boolean not null default false   -- true once best_score_pct >= 95
  last_attempt_at timestamptz
  unique (profile_id, lesson_id)

practice_attempts
  id                  uuid pk
  profile_id          uuid not null references profiles(id)
  mode                text not null check (mode in ('curriculum', 'adhoc'))
  lesson_id           text                  -- set iff mode = 'curriculum'
  topic_id            text                  -- set iff mode = 'adhoc' (e.g. "algebra")
  question_count      integer not null
  score               numeric not null
  max_score           numeric not null
  questions_snapshot  jsonb not null
  evaluation_snapshot jsonb not null
  created_at          timestamptz not null default now()   -- full timestamp, not date-only
```

`practice_attempts` is the single append-only history table for **all**
practice — both curriculum lessons and the 4 existing ad-hoc topics write
here. `lesson_progress` is a derived summary, upserted after each
curriculum-mode attempt, and is what the child-facing lesson picker reads to
show completion badges.

`created_at` is a full timestamp everywhere (not date-only). "Daily
progress" is a query over `practice_attempts` (`GROUP BY DATE(created_at)`),
not a separate column — this is what powers the admin-only daily/calendar
view. It is deliberately **not exposed** to any child-facing endpoint.

## 4. API endpoints

### Child-facing (no admin token; same trust level as today's app)

```
GET  /api/v1/profiles/lookup?email=...   read-only existence check, no side effects
                                          -> { exists: true, profile } | { exists: false }
POST /api/v1/profiles                    { email, display_name, grade } -> profile
                                          only called after explicit user confirmation
                                          that a new profile should be created
GET  /api/v1/curriculum                  static unit/lesson content, optionally
                                          filtered by grade
POST /api/v1/attempts                    persists one attempt (curriculum or adhoc);
                                          upserts lesson_progress when mode=curriculum
GET  /api/v1/profiles/{id}/lesson-status current status per lesson only:
                                          { lesson_id, completed, best_score_pct }[]
                                          — mirrors lesson_progress directly; always the
                                          best score, never regresses if a later retry
                                          scores lower than an already-mastered lesson —
                                          no history, no timestamps
```

### Admin-only (require header `X-Admin-Token` matching a fixed backend secret)

```
GET /api/v1/admin/profiles                       list of children
GET /api/v1/admin/profiles/{id}/attempts          full attempt history, all timestamps
GET /api/v1/admin/profiles/{id}/progress/daily    attempts grouped by calendar day
GET /api/v1/admin/profiles/{id}/lesson-progress   full per-lesson detail, all 46 lessons
```

The admin frontend route is `/admin/<token>` — a permanent, randomly
generated (once) long token embedded directly in the bookmarked URL, **not**
regenerated per session. The token is also required as a header on every
admin API call, checked server-side with a constant-time compare — so
finding the admin API directly (bypassing the obscure URL) still requires
the token. An invalid or missing token returns a generic `404` (not `403`)
on all `/api/v1/admin/*` routes, so a wrong guess doesn't even confirm the
admin API exists.

The token is generated once (32 random bytes, hex/base64url-encoded, ~64
chars) and stored as `MATH_BUDDY_ADMIN_TOKEN` in GCP Secret Manager
(matching the existing per-app secret naming convention) and in the local
`.env`. It never auto-rotates. This is explicitly a placeholder for real
login later — swapping the token-check for a session check should only
touch one function (the admin auth dependency), not every endpoint.

## 5. Curriculum content representation

Static JSON, checked into the backend — `backend/app/data/curriculum.json`,
built once from the already-extracted unit/lesson/keyword data:

```json
{
  "units": [
    {
      "id": "unit-02", "number": 2, "title": "Ratio and Rate", "grade": "7",
      "lessons": [
        {
          "id": "2.1", "title": "What Is a Ratio?",
          "keywords": ["ratio", "part-to-whole ratio", "terms of a ratio"],
          "focus": "Understand what a ratio is and write ratios."
        }
      ]
    }
  ]
}
```

Loaded once at backend startup, served read-only via `GET /api/v1/curriculum`.
No DB table — editing it means editing the file and redeploying, which is
fine at this content size and update frequency.

Each lesson's `keywords`/`focus` are threaded into the existing
`generate_questions.txt` Jinja2 template (new optional template variables)
so LLM-generated questions are scoped to that specific lesson rather than a
generic topic name — this is a small, additive change to the existing
prompt, not a new prompt file.

## 6. Frontend UX flow

**Grade ↔ ageGroup mapping.** The existing `SessionContext` drives question
generation off `ageGroup` (`'9-10'` | `'11-12'`), not a grade number. The new
`profiles.grade` field maps 1:1: grade `'6'` → `ageGroup '9-10'`, grade `'7'`
→ `ageGroup '11-12'`. Once a profile is loaded, `ageGroup` is set
automatically from `profiles.grade` and the manual age-group selector on
`HomeScreen` is hidden — a loaded profile already encodes that choice.

**Profile entry** (new first screen, before `home`):
1. Email + display name + grade input.
2. `GET /api/v1/profiles/lookup?email=...`.
3. If found: load that profile, proceed to `home`.
4. If not found: show a confirmation dialog — *"No profile found for this
   email — check it again, or create a new profile?"* — only calls
   `POST /api/v1/profiles` on explicit "create" confirmation. This prevents a
   typo from silently spawning a phantom profile.
5. On successful load/create, cache `{ profileId, email }` (identity only,
   no progress data) in `localStorage` so reopening the app on the same
   browser auto-resumes the profile instead of re-prompting for email every
   time. A small header control allows switching profiles (e.g. a sibling
   using the same device), which overwrites the cached value.

**Topic selector** (`HomeScreen` / `TopicSelector`), grade-gated:
- Grade 6 → today's 4 cards unchanged (Vedic Maths, Word Problems, Algebra,
  Volumes).
- Grade 7 → those same 4 cards, plus 8 new unit cards sourced from
  `GET /api/v1/curriculum`. Clicking a unit expands/navigates to its lesson
  list; each lesson row shows title + a completed/not-completed badge
  (from `GET /lesson-status`) + a "Practice" button. Selecting a lesson sets
  `questionCount` to a fixed 25 (not user-editable) and tags the session as
  curriculum-mode with that `lesson_id`.

**Practice/evaluate flow** — `PracticePage`, `LoadingScreen`, and the
evaluating screen are unchanged. After evaluation:
- `POST /api/v1/attempts` fires with the result. If it fails, retry once
  automatically; if that also fails, show a non-blocking "progress may not
  have saved" banner rather than blocking further use.
- `Dashboard.jsx` shows the score as it does today — this is the child's
  "latest result" view, unaffected by the no-history rule. In curriculum
  mode: score ≥ 95% shows a "Lesson mastered! ✓" state and updates the
  lesson picker's badge; below 95% shows a "keep practicing" prompt offering
  an immediate retry with a **fresh** set of 25 LLM-generated questions (not
  the same set repeated).

**Admin page** (`/admin/<token>`) — entirely separate route tree, not linked
from anywhere a child would navigate. Profile list → select a child → daily
progress calendar (via `/progress/daily`), full attempt history table,
per-lesson mastery grid across all 46 lessons.

## 7. Error handling

- Profile lookup/creation and curriculum-fetch failures reuse the existing
  `ErrorBanner` + retry pattern already used for question generation and
  evaluation — no new UX pattern.
- `POST /api/v1/attempts` failure after a completed lesson: retry once in
  the background; on continued failure, show a non-blocking banner. Never
  block the child from continuing because a save failed.
- Admin token mismatch/missing → `404` on all `/api/v1/admin/*` routes.

## 8. Testing

**Backend (pytest):**
- Profile lookup vs. create split, including that lookup never creates.
- Attempt-save → `lesson_progress` upsert math, especially the ≥95%
  threshold edge cases (exactly 95.0%, 24/25 vs. 23/25).
- Admin token check: valid / invalid / missing header, all return 404 on
  failure.

**Frontend (Vitest):**
- Topic selector grade-gating (6 vs. 7 shows the right cards).
- Lesson picker completion badges render correctly from `/lesson-status`.
- Email-not-found confirmation dialog flow (does not auto-create).
- `questionCount` is fixed at 25 and non-editable when a curriculum lesson
  is selected.

## 9. Implementation phasing (for the implementation plan)

Two phases: the entire backend first, then the entire frontend. Phase 1 is
complete (and testable via pytest + `/docs`) before any frontend work starts,
so Phase 2 builds against a stable, finished API.

### Phase 1 — Backend

1. **Database foundation** — Postgres connection config, schema + migrations
   for `profiles`, `lesson_progress`, `practice_attempts`.
2. **Profile endpoints** — `GET /profiles/lookup` (read-only) and
   `POST /profiles`.
3. **Curriculum content** — convert the already-extracted unit/lesson data
   into `backend/app/data/curriculum.json`, load at startup, serve via
   `GET /api/v1/curriculum` (grade filter).
4. **Lesson-scoped question generation** — extend `generate_questions.txt`
   and the generate request schema with optional lesson context
   (`lesson_id` → keywords/focus).
5. **Attempts + lesson status** — `POST /api/v1/attempts` (curriculum and
   adhoc modes, `lesson_progress` upsert with the ≥95% rule) and
   `GET /profiles/{id}/lesson-status`.
6. **Admin API** — generate `MATH_BUDDY_ADMIN_TOKEN` (local `.env` + GCP
   Secret Manager), single admin auth dependency (constant-time compare,
   404 on failure), and the four `/api/v1/admin/*` endpoints.
7. **Backend tests** — everything listed in §8 Backend.

### Phase 2 — Frontend

1. **API client + context** — new `api.js` functions for every Phase 1
   endpoint; extend `SessionContext` with profile, curriculum-mode
   `lesson_id`, and grade → `ageGroup` mapping.
2. **Profile entry screen** — lookup → confirm-before-create dialog,
   `localStorage` identity caching, header profile switcher.
3. **Grade-gated topic selector + lesson picker** — 4 existing cards for
   grade 6; plus 8 unit cards, lesson list, and completion badges for
   grade 7; fixed 25 questions in curriculum mode.
4. **Attempt saving** — `POST /api/v1/attempts` after every evaluation
   (curriculum and ad-hoc), retry once, non-blocking failure banner.
5. **Dashboard mastery messaging** — "Lesson mastered" state at ≥95%,
   "keep practicing" retry with a fresh set of questions.
6. **Admin page** — `/admin/<token>` route tree: profile list, daily
   progress calendar, attempt history table, per-lesson mastery grid.
7. **Frontend tests** — everything listed in §8 Frontend.
