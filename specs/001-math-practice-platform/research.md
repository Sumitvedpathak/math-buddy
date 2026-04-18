# Research: Math Practice Platform for Kids

**Phase**: 0 — Outline & Research
**Date**: 2026-04-18
**Feature**: [plan.md](plan.md)

All NEEDS CLARIFICATION items resolved. Decisions documented below with rationale and
alternatives considered.

---

## Decision 1: Fun Facts Source — LLM-Generated at Session Start

**Context**: A contradiction existed between the spec assumption ("pre-curated pool embedded
in the application") and the tech stack document (a `fun_facts.txt` prompt template + loading
screen behaviour that says "fetched from the LLM once at session start").

**Decision**: Fun facts are **LLM-generated once at session start** via the
`prompts/fun_facts.txt` Jinja2 template. The generation call is made in the backend alongside
question generation — both are triggered when the student clicks Start Practice. The response
from `POST /api/v1/questions/generate` returns both `questions` and `fun_facts` arrays so the
frontend has everything it needs from one HTTP call.

**Rationale**:
- Avoids maintaining a static file of facts in the codebase.
- Gemini 2.0 Flash is fast enough that the combined call adds no perceptible extra latency.
- LLM-generated facts can be personalised to topic and age group if desired in future.
- Returning both from one endpoint keeps the frontend loading flow simple (single fetch,
  single state update, loading screen starts showing facts immediately).

**Alternatives considered**:
- Static JSON file shipped with the frontend: rejected — maintenance burden, facts stale over
  time, no variety between sessions.
- Separate `/api/v1/facts/generate` endpoint: rejected — requires two concurrent frontend
  fetches and more complex loading state management.

**Spec impact**: Assumption 3 ("pre-curated pool embedded in application") is superseded by
this decision. The spec will be treated as corrected to match the tech stack document.

---

## Decision 2: Sketch Canvas Resize — Export/Restore via react-sketch-canvas API

**Context**: FR-022 requires strokes to be preserved and proportionally scaled on browser
resize. `react-sketch-canvas` uses an SVG-backed canvas. The component's `width` and `height`
props are passed as SVG `width`/`height` attributes.

**Decision**: Use a `ResizeObserver` on the canvas container `div`. When the observed width
changes by more than a threshold (e.g., 4px):
1. Call `canvasRef.current.exportPaths()` to capture current stroke data as relative
   coordinate paths.
2. Update the container's measured `width` in component state (triggers re-render with new
   `width` prop passed to `ReactSketchCanvas`).
3. In a `useEffect` that fires after the width update, call
   `canvasRef.current.loadPaths(savedPaths)` to restore strokes.

Because `react-sketch-canvas` stores paths as percentage-normalised coordinates internally
(x/y as fractions of canvas dimensions), the restored strokes render correctly at the new
size without manual coordinate scaling.

**Rationale**: This is the approach documented in react-sketch-canvas issues for responsive
canvases. The export/load path round-trip is synchronous at the data level and imperceptible
to users. No third-party resize library is needed — `ResizeObserver` is available in all
target browsers.

**Alternatives considered**:
- CSS `transform: scale()` on the canvas container: rejected — scales the rendered bitmap,
  not the underlying SVG paths; interaction coordinates become misaligned.
- Fixed canvas size with CSS overflow: rejected — breaks the sketching experience on mobile
  and on narrow desktop windows.
- Rebuilding strokes from raw pixel coordinates: rejected — requires manual coordinate math
  and is fragile across DPI changes.

---

## Decision 3: Tailwind CSS Runtime Theming — CSS Custom Properties on a Theme Root Element

**Context**: FR-018 requires theme switching without a full page reload. Tailwind's default
JIT compilation produces static class names; runtime theme changes require a dynamic
mechanism.

**Decision**: Define all brand colours, typography, and border-radius values as CSS custom
properties (variables) scoped to `[data-theme="dandys-world"]` (or equivalent) on a wrapper
element. Tailwind's `tailwind.config.js` references these variables via `var(--color-*)` etc.
Each theme file (e.g., `dandysWorld.js`) exports a plain object of CSS variable name → value
pairs. A `setTheme(themeKey)` helper (called from a theme toggle button) applies the object
as inline style overrides on the root wrapper element. No page reload needed.

**Rationale**: CSS custom properties are the only mechanism for runtime theme switching
compatible with Tailwind's static class model. Scoping to a wrapper element means the
variables can be swapped atomically in a single DOM write — all Tailwind classes reading those
variables update instantly. New themes require only a new JS object file in `src/themes/`.

**Alternatives considered**:
- Tailwind dark mode (`darkMode: 'class'`): rejected — only supports two themes (light/dark);
  insufficient for a full Dandy's World palette.
- CSS-in-JS (e.g., styled-components): rejected — conflicts with Tailwind utility class model
  and adds a heavy dependency.
- Full CSS file swap via `<link>` element replacement: rejected — causes a flash of unstyled
  content and is harder to encapsulate in a React context.

---

## Decision 4: OpenRouter Structured JSON Output — response_format + Prompt Enforcement

**Context**: Question generation and evaluation must return structured JSON that can be parsed
reliably into Pydantic models. LLM free-text responses are not acceptable.

**Decision**: All LLM calls via the `openrouter.py` integration wrapper pass
`response_format={"type": "json_object"}` to the OpenRouter API (supported by Gemini 2.0 Flash
via OpenRouter). Every prompt template also includes an explicit JSON schema example and the
instruction "Return ONLY valid JSON matching this schema, no preamble, no markdown fences."
The service layer validates the parsed JSON against the corresponding Pydantic response model
before returning it to the route handler.

**Rationale**: `json_object` response format guarantees a parseable JSON string is returned.
Combining it with explicit schema in the prompt reduces hallucinated field names to near zero.
Pydantic validation as the final check means malformed responses raise a clear error before
any downstream state is affected.

**Alternatives considered**:
- Prompt-only JSON instruction (no response_format): rejected — non-deterministic; occasional
  markdown fences or preamble text break `json.loads()`.
- Function calling / tool use: rejected — OpenRouter's support varies by model; adds
  complexity for no benefit here since we control both ends.

---

## Decision 5: CORS Configuration — Environment-Driven Allow-Origins

**Context**: Vite dev server runs on `http://localhost:5173` by default; production origin
will differ. FastAPI's `CORSMiddleware` requires an explicit `allow_origins` list.

**Decision**: `config.py` reads a `CORS_ORIGINS` environment variable (comma-separated list
of allowed origins, defaulting to `http://localhost:5173` for development). This value is
passed to FastAPI's `CORSMiddleware` at app startup. Docker Compose sets `CORS_ORIGINS` for
the backend service.

**Rationale**: Hardcoding `localhost:5173` in application code would require a code change
for every deployment target. Environment-driven configuration keeps the app portable.

**Alternatives considered**:
- Wildcard `allow_origins=["*"]`: rejected — OWASP-incompatible for an API that could receive
  session data; security risk.
- Separate CORS config file: unnecessary complexity for a two-value setting.

---

## Decision 6: Gemini 2.0 Flash Vision Input — OpenAI-Compatible data URI Format

**Context**: FR-014 requires sketch canvas images to be sent to the LLM as base64 PNG for
handwriting recognition during evaluation. Gemini 2.0 Flash supports vision input via
OpenRouter.

**Decision**: Each sketch answer is sent as an OpenAI-compatible vision message part:
```json
{
  "type": "image_url",
  "image_url": {
    "url": "data:image/png;base64,<base64_string>"
  }
}
```
This format is the standard used by OpenRouter for all vision-capable models including
Gemini 2.0 Flash. The `evaluate_answers.txt` prompt template includes instructions for the
model to read the handwritten working in the image and assess correctness of method and answer.

**Rationale**: OpenRouter normalises vision inputs into this format across all providers;
using the standard data URI avoids provider-specific handling in `openrouter.py`.

**Alternatives considered**:
- Uploading images to cloud storage and passing URLs: rejected — adds infrastructure, latency,
  and a storage dependency that contradicts the zero-persistence constraint.
- Sending as multipart form data: rejected — OpenRouter's LLM endpoints use JSON bodies; 
  multipart is not supported for the chat completions endpoint.
