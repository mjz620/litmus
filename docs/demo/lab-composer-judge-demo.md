# Lab Composer Judge Demo

## Demo goal

The demo proves that LabBench can translate an open teacher objective into a bounded, validated lab and then carry real student evidence through coaching and teacher analytics. It must use production authoring/validation/runtime contracts with seeded deterministic inputs where reliability requires them.

## `/demo` entry point

Add a primary `/demo` card:

**Generate a lab with Lab Composer**

“Describe a learning goal, inspect how it is validated, then preview the lab as a student.”

The existing persistent role switcher remains visible:

```text
DEMO MODE   [Composer] [Student] [Teacher] [Technical]   [Reset demo]
```

No demo route requires auth. Reset clears only the current ephemeral judge workflow/session and restores deterministic seed data.

## Seeded composer flow

The composer opens with this editable prompt:

> Create a 7-minute acid-base titration pre-lab focused on endpoint control and meniscus reading.

The visible flow is:

1. **Extract objective.** Show canonical `endpoint_control` and `meniscus_reading` skill chips and `family.acid_base_titration.v1`.
2. **Generate structured draft.** The Lab Authoring Agent produces a visible `LabWorkflowSpec` summary: two focused steps, verified component/reagent/engine references, coach triggers, rubric, and retry.
3. **Run hard validation.** The validator panel shows individual pass/fail checks for schema, IDs, compatibility, safety, event flags, seed replay, runnability, and Chromebook profile.
4. **Show Judge Agent critique.** A separate panel scores alignment, pedagogy, clarity, rubric, triggers, safety/appropriateness, teacher usability, and under-resourced-school suitability.
5. **Revise when needed.** The seeded demo critique should find one safe, deterministic pedagogy issue—for example, a rubric initially missing meniscus evidence. The Authoring Agent adds an evidence-backed criterion and revalidation passes. Do not seed a fake chemistry or safety failure merely for drama.
6. **Teacher review.** Show `runnable`, pinned versions/hash, and enabled **Preview as student**. Accept/edit/regenerate/reject remain visible; edit returns the spec to unvalidated.

The production path may call real agents. For a reliable live judge presentation, a known seed/request may use schema-valid cached agent outputs labeled as seeded, but validation, runtime assembly, engine events, StudentModel updates, and dashboard writes must be real. The demo must not display screenshots or hand-built fake event objects as live output.

## Validator panel

Display:

- final status and preview/assignment eligibility;
- spec hash, validator version, and registry snapshots in an expandable detail;
- passed checks in calm language;
- warnings separately from errors;
- exact issue path, code, and suggested supported IDs for failures;
- an explicit note that the validator is deterministic and authoritative.

For the hero seed, the final pass list includes schema validity, exact registry resolution, component/action compatibility, reagent/engine compatibility, no restricted components, event-flag compatibility, deterministic near-endpoint seed replay, and runtime assembly eligibility.

## Judge Agent critique panel

Display:

- “AI critique — advisory” label;
- eight dimension scores with short rationales;
- blocker/medium/low issues linked to spec sections;
- strengths and final recommendation;
- before/after revision summary;
- a note that critique cannot override hard validation.

Avoid anthropomorphic debate between agents. The useful story is independent responsibilities and a traceable revision.

## Preview as student

Preview launches the exact validated workflow version through the normal student runtime with a preview-scoped session. The judge:

1. reads the initial burette meniscus;
2. approaches the endpoint;
3. intentionally uses excessive flow or overshoots;
4. sees the deterministic engine emit `flow_rate_high_near_endpoint` and/or `endpoint_overshoot`;
5. receives a contextual Student Coach reflection/hint tied to that event;
6. records/submits the compact report or completes the seeded step.

The coach does not calculate pH/equivalence. Correct dropwise behavior in the retry remains a positive stay-silent case.

## Teacher dashboard continuation

Switching to Teacher shows the preview/demo identity highlighted in a seeded class. The dashboard updates from persisted semantic events and deterministic aggregates:

- completion/progress;
- endpoint-control and meniscus-reading evidence;
- misconception flag;
- coach intervention;
- report/retry evidence if completed.

Generated workflow title/version should be visible so the teacher knows which assignment produced the evidence.

## Technical inspector

The Technical view shows real, redactable objects in sequence:

1. teacher request and extracted canonical skills;
2. authored `LabWorkflowSpec` revision and hash;
3. hard `ValidationResult`;
4. `JudgeCritique` bound to the hash;
5. runtime assembly resolution (engine/components/actions);
6. typed student action;
7. engine-emitted semantic event log;
8. in-memory StudentModel before/after update;
9. coach request/structured response;
10. checkpoint/teacher aggregate provenance.

Do not expose model chain-of-thought, secrets, raw hidden prompts, or student-private data.

## Three-minute script

### 0:00–0:20 — problem and bounded thesis

Open `/demo` → **Generate a lab with Lab Composer**.

Say: “Teachers think in learning goals, but virtual labs are usually fixed. LabBench lets a teacher ask openly, then assembles only what our deterministic platform can actually run: AI-authored workflows over verified lab primitives.”

### 0:20–0:55 — generate and validate

- Submit the prefilled seven-minute titration prompt.
- Point to extracted skills, selected family, components, two steps, and rubric.
- Open validator checks and emphasize exact registry resolution, safety, event compatibility, and seed replay.

Say: “The author can write pedagogy; it cannot invent chemistry or mark itself runnable.”

### 0:55–1:20 — independent critique and revision

- Show the Judge Agent's advisory critique that the first rubric underweights meniscus evidence.
- Run the seeded revision.
- Show the new hash and revalidation pass.

Say: “A second model challenges the lesson quality, while deterministic validation remains authoritative.”

### 1:20–2:05 — preview and make a mistake

- Click **Preview as student**.
- Record/read the meniscus.
- Add titrant too quickly near endpoint or deliberately overshoot.
- Show the engine flag and contextual coach question.

Say: “The running lab is not generated code. It is the same verified titration engine, and the coach reacts to semantic evidence from the student's action.”

### 2:05–2:30 — teacher evidence

- Switch to Teacher.
- Highlight the judge session and endpoint-control/meniscus evidence.
- Open the misconception/evidence row.

Say: “The teacher gets readiness evidence tied to the exact generated workflow and actual student behavior.”

### 2:30–2:55 — technical proof

- Switch to Technical.
- Trace spec → validation → critique → runtime action → event → StudentModel → dashboard.
- Briefly show the unsupported-request test row for aspirin synthesis.

Say: “Unsupported labs stay unsupported. We never hallucinate a new engine.”

### 2:55–3:00 — impact

Say: “This gives under-resourced classrooms more targeted practice on Chromebook-class hardware, while teachers and deterministic science remain in control.”

## Demo acceptance checklist

- Composer entry is obvious from `/demo`; no auth or setup.
- The prefilled prompt completes with a schema-valid, hash-bound result.
- Validator and Judge Agent authority are visually distinct.
- A revision invalidates the old validation and produces a new hash/result.
- Preview is enabled only for the final runnable spec.
- The intentional mistake emits a real engine event and coach intervention.
- Teacher evidence updates through the production persistence/analytics path.
- Technical inspector shows real objects with no chain-of-thought/secrets.
- Reset restores the known flow without changing global/production rows.
- Hero path remains usable on Chromebook-class hardware and has a rehearsed cached-agent fallback.
