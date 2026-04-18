# LLM Requirements Checklist: Math Practice Platform for Kids

**Purpose**: Developer self-check — validates the completeness, clarity, and scenario
coverage of LLM-related requirements across prompt templates, output validation, and
integration configuration before writing any backend service code. Child-safety requirements
are folded into prompt items. Accessibility is out of scope.
**Created**: 2026-04-18
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md) · [research.md](../research.md)
**Scope**: All three prompt templates + output validation + OpenRouter integration config
**Depth**: Lightweight (developer self-check, weighted Prompts > Validation > Config)

---

## Prompt — generate_questions.txt

- [x] CHK001 — Is the `{{ facts_count }}` template variable defined as a concrete constant or derived value somewhere in the codebase spec? The contract references it but no requirement specifies its value or where it is set. [Completeness, Gap]
- [x] CHK002 — Does the prompt specify the **exact JSON schema** that the LLM must return, with field names matching the Pydantic `GenerateQuestionsResponse` model precisely (`id`, `topic`, `problem_type`, `text`, `difficulty_tier`, `fun_facts`)? [Completeness, Spec §contracts/generate-questions.md]
- [x] CHK003 — Does the prompt define what "difficulty" means in concrete, measurable terms for the LLM? (e.g., number of operations, magnitude of operands, grade-level concept) Or is difficulty assignment left entirely to LLM discretion? [Clarity, Gap]
- [x] CHK004 — Does the prompt specify the curriculum calibration for each age group explicitly — i.e., "Age 9–10 → Grade 3–4 Canadian/NCERT; Age 11–12 → Grade 5–6" — in terms the LLM can act on? [Clarity, Spec §FR-007]
- [x] CHK005 — Does the prompt define the terms "Teen" (11–19) and "Reverse Teen" (two-digit number ending in 1: 11, 21, …, 91) explicitly so the LLM generates only valid Vedic Maths operands? [Clarity, Spec §FR-009]
- [x] CHK006 — Does the prompt instruct the LLM that **all four** Vedic Maths patterns must appear in the Vedic allocation, not just any one of the four? [Completeness, Spec §FR-009]
- [x] CHK007 — Does the prompt specify how the five mandatory problem types (multiplication, division, fractions, mixed_fractions, squares) should be distributed across the full question set when `question_count` is not evenly divisible by 5? [Completeness, Gap]
- [x] CHK008 — Does the prompt include an explicit child-safety instruction covering question text, and specifying appropriate age range (9–12), with a prohibition on adult themes, violence, and inappropriate language? [Completeness, Spec §FR-017 + constitution Audience & Safety]
- [x] CHK009 — Does the prompt instruct the LLM to return **only** the `fun_facts` items as part of the same JSON response (not in a separate call), and to produce at minimum the required count without repeats within the array? [Completeness, Spec §FR-005, research Decision 1]
- [x] CHK010 — Does the prompt specify child-safety and age-appropriateness criteria for fun facts (topics, tone, no adult content) with enough specificity for the LLM to self-check its own output? [Clarity, Spec §FR-005]
- [x] CHK011 — Is there a requirement specifying that the prompt must include a "Return ONLY valid JSON, no preamble, no markdown fences" instruction, or is this left as an implementation convention with no formal spec backing? [Completeness, research Decision 4, Gap]

---

## Prompt — evaluate_answers.txt

- [x] CHK012 — Does the prompt pass `{{ age_group }}` to the LLM and instruct it to calibrate marking leniency and feedback vocabulary to the student's age group? [Completeness, Gap]
- [x] CHK013 — Does the prompt define the 0/1/2 marking scheme with the same precision as the contracts spec? Specifically, is "1 mark for correct method but wrong final answer" distinguished from "1 mark for correct answer with no working"? [Clarity, Spec §contracts/evaluate-answers.md Marking Scheme]
- [x] CHK014 — Does the prompt specify what the LLM should do when a sketch is **illegible** or contains non-mathematical marks (e.g., scribbles)? Is there a requirement for how illegible work should be scored? [Coverage, Gap]
- [x] CHK015 — Does the prompt instruct the LLM on the expected **feedback length** and tone? (The contract says "1–2 sentences" — is this explicitly encoded in the prompt template spec?) [Clarity, Spec §contracts/evaluate-answers.md]
- [x] CHK016 — Does the prompt include a child-safety instruction for feedback text specifically — not just for questions but for evaluation responses that a child will read immediately after submitting? [Completeness, Spec §FR-016, constitution Audience & Safety]
- [x] CHK017 — Does the prompt specify the exact JSON output schema matching `QuestionResultSchema` (`{"marks": 0|1|2, "feedback": "..."}`) with field names identical to the Pydantic model? [Completeness, Spec §contracts/evaluate-answers.md]
- [x] CHK018 — Is there a requirement for how the evaluation prompt handles a sketch canvas that is technically non-empty (e.g., a single accidental mark) but functionally blank? Should it be scored as 0 or evaluated by the LLM? [Coverage, Edge Case, Gap]

---

## Prompt — fun_facts.txt

- [x] CHK019 — Is `fun_facts.txt` specified as a **separate** Jinja2 template file, or is it integrated into `generate_questions.txt`? The plan.md lists it as a separate file, but research Decision 1 says generation is a single LLM call — are these two prompts composed or is one file actually used? [Clarity, Gap, plan.md vs research Decision 1]
- [x] CHK020 — Does the `fun_facts.txt` template (or its combined form) accept `{{ topics }}` and `{{ age_group }}` as variables so facts can be topically relevant to the session, or are facts always generic? [Completeness, Gap]
- [x] CHK021 — Is the minimum count for fun facts encoded as a template variable (`{{ facts_count }}`) or as a hardcoded instruction in the prompt? Is this consistent with how `generate_questions.txt` references `{{ facts_count }}`? [Consistency, Gap]

---

## LLM Output Validation

- [x] CHK022 — Is the maximum retry count for evaluation (evaluate_answers) specified? The generate-questions contract specifies "max 2 retries" explicitly — is an equivalent rule documented for evaluation? [Consistency, Spec §contracts/generate-questions.md, Gap]
- [x] CHK023 — Is the behaviour when Pydantic validation rejects a parsed LLM response specified? Does validation failure trigger a retry (counted toward the retry limit) or a direct 503? [Completeness, Gap]
- [x] CHK024 — Is there a requirement specifying what happens when a **subset** of the 30 concurrent evaluation LLM calls fail (e.g., 28 succeed, 2 fail)? Does the service return partial results, retry only the failed calls, or fail the entire request? [Coverage, Edge Case, Gap]
- [x] CHK025 — Is a timeout requirement defined for individual LLM calls? Without a timeout, a stalled OpenRouter call could block `asyncio.gather` indefinitely. [Completeness, Gap]
- [x] CHK026 — Is the "malformed base64 PNG URI treated as unanswered (score 0)" rule traceable back to a spec requirement, or is it only documented in the contracts file with no corresponding FR? [Traceability, Spec §contracts/evaluate-answers.md, Gap]
- [x] CHK027 — Is the Pydantic `response_format={"type":"json_object"}` requirement documented as a formal integration requirement, or only captured in research Decision 4 as an implementation note with no FR or CA requirement backing it? [Traceability, research Decision 4, Gap]

---

## LLM Integration & Configuration

- [x] CHK028 — Is there a formal requirement (FR or CA) prohibiting hardcoding of `OPENROUTER_API_KEY` in source code, or is this only an implied convention? [Completeness, Gap]
- [x] CHK029 — Is the default value for `OPENROUTER_MODEL` (`google/gemini-2.0-flash`) specified in a `.env.example` file requirement, and is there a requirement that it must be overridable without code changes? [Completeness, quickstart.md, Gap]
- [x] CHK030 — Is model fallback behaviour specified if the model configured in `OPENROUTER_MODEL` is unavailable or returns a 404 from OpenRouter? [Coverage, Edge Case, Gap]
- [x] CHK031 — Is a rate-limiting or throttling requirement defined for the 30 concurrent evaluation calls to OpenRouter? Without it, a 30-question session could exceed per-minute token or request limits. [Completeness, Gap]
- [x] CHK032 — Is the `CORS_ORIGINS` environment variable default (`http://localhost:5173`) documented in a formal requirement, or only in research Decision 5 and quickstart.md with no spec traceability? [Traceability, research Decision 5, Gap]
