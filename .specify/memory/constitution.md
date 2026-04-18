<!--
Sync Impact Report
- Version change: 0.0.0 -> 1.0.0
- Modified principles:
	- [PRINCIPLE_1_NAME] -> I. Code Quality Is Non-Negotiable
	- [PRINCIPLE_2_NAME] -> II. Enforced Layer Boundaries
	- [PRINCIPLE_3_NAME] -> III. Test Evidence Before Merge
	- [PRINCIPLE_4_NAME] -> IV. Consistent and Accessible User Experience
	- [PRINCIPLE_5_NAME] -> V. Performance Budgets Are Release Gates
- Added sections:
	- Architecture and Folder Conventions
	- Delivery Workflow and Quality Gates
- Removed sections:
	- None
- Templates requiring updates:
	- .specify/templates/plan-template.md: ✅ updated
	- .specify/templates/spec-template.md: ✅ updated
	- .specify/templates/tasks-template.md: ✅ updated
	- .specify/templates/commands/*.md: ⚠ pending (directory not present)
	- README.md: ✅ updated
- Follow-up TODOs:
	- None
-->

# Math Buddy Constitution

## Core Principles

### I. Code Quality Is Non-Negotiable
All production code MUST be readable, typed where supported, and statically checked.
Backend Python changes MUST pass linting and type checks (for example, ruff and mypy), and
frontend changes MUST pass linting and type checks (for example, eslint and tsc). Pull
requests MUST include concise documentation for non-obvious logic and MUST avoid dead code,
duplicated logic, and hidden side effects.

Rationale: Code quality is the fastest path to long-term delivery speed and lower defect rate.

### II. Enforced Layer Boundaries
Application layers MUST remain separated by responsibility. Route handlers MUST orchestrate
request/response flow only, business rules MUST live in services, and external providers MUST
be isolated behind integration wrappers. Frontend UI components MUST consume API helpers, not
perform direct network calls. Violations are constitutional defects and MUST be refactored
before merge.

Rationale: Strong boundaries reduce coupling, simplify testing, and prevent architecture drift.

### III. Test Evidence Before Merge
Every change MUST include automated test evidence at the appropriate level: unit tests for
logic, integration tests for cross-layer behavior, and contract tests for API/schema changes.
Bug fixes MUST include a regression test that fails before the fix and passes after it.
Uncovered critical paths are not releasable.

Rationale: Reliable test evidence is required to protect behavior while iterating quickly.

### IV. Consistent and Accessible User Experience
Frontend changes MUST use shared UI patterns, design tokens, and standardized error/loading
states. User journeys MUST remain consistent across screens for navigation, forms, feedback,
and validation messaging. New interfaces MUST meet accessibility requirements (WCAG 2.2 AA or
project-approved equivalent), including keyboard navigation, semantic structure, and sufficient
contrast.

Rationale: Consistency and accessibility directly improve usability, trust, and supportability.

### V. Performance Budgets Are Release Gates
Features MUST define measurable performance targets before implementation and MUST verify them
before release. For frontend, key rendering and interaction paths SHOULD meet explicit budgets
(for example, Web Vitals and interaction latency). For backend Python services, API latency,
throughput, and resource use MUST remain within agreed limits for the feature scope.
Unjustified regressions against baseline are release blockers.

Rationale: Performance is a core quality attribute, not a post-release enhancement.

## Architecture and Folder Conventions

- All API route handlers MUST live under `backend/app/api/v1/` only.
- Business logic MUST live in `backend/app/services/` and MUST NOT be implemented in routes.
- Third-party API wrappers MUST live in `backend/app/integrations/`.
- New database models MUST live in `backend/app/models/`.
- Data validation and serialization schemas MUST live in `backend/app/schemas/`.
- Frontend API calls MUST go through `src/lib/api/`; raw `fetch()` in components is forbidden.

## Delivery Workflow and Quality Gates

- Each feature plan MUST include explicit quality, test, UX, and performance acceptance criteria.
- Each pull request MUST document architecture-boundary compliance and test evidence.
- Reviewers MUST block merges when constitutional checks fail.
- CI pipelines MUST enforce linting, typing, tests, and performance checks where applicable.
- Exceptions MUST include written rationale, risk assessment, owner, and expiration date.

## Governance

This constitution overrides conflicting local conventions and historical practices.
Amendments require: (1) a documented proposal, (2) reviewer approval from project maintainers,
and (3) updates to affected templates and delivery guidance in the same change.

Versioning policy for this constitution uses semantic versioning:
- MAJOR: Backward-incompatible governance changes or removal/redefinition of principles.
- MINOR: New principle/section or materially expanded mandatory guidance.
- PATCH: Clarifications, wording improvements, and non-semantic refinements.

Compliance review is mandatory during plan review, pull request review, and release readiness
checks. Any unresolved violation MUST be tracked with an owner and due date before release.

**Version**: 1.0.0 | **Ratified**: 2026-04-18 | **Last Amended**: 2026-04-18

## Audience & Safety
- All content is for children aged 9–11. No adult themes, violence, or
  inappropriate content in any generated text, facts, or UI copy.
- LLM prompts must explicitly instruct the model to keep all output
  child-safe and age-appropriate at all times.

## Question Difficulty
- Progressive difficulty within every session is a hard architectural
  constraint — the question generator must sort or generate by difficulty
  tier before returning the set.
