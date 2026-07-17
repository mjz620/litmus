# Demo Runbook

## Reliable local launch

1. Install dependencies with `npm install` and Chromium with `npx playwright install chromium`.
2. Copy `.env.example` to `.env.local`.
3. Leave `OPENAI_MOCK_MODE=1`; no account, database, or API key is required for the judge path.
4. Run `npm run dev` and open `http://localhost:3000/demo`.
5. Use **Reset demo** before a rehearsal.

The demo route uses the same experiment engine, store, coach contract, checkpoint contract, report evaluator contract, and analytics functions as the production-shaped routes. Mock mode replaces external calls, not chemistry or evidence generation.

## Three-minute route

- **Student:** begin from the deterministic 22.00 mL retry seed, add quickly to create endpoint-control evidence, ask why overshooting matters, submit the report, then retry dropwise.
- **Teacher:** show the fixed seeded roster and the highlighted “Your demo session” row derived from the latest live trace.
- **Technical:** expand the real state, semantic events, StudentModel, last coach request, last checkpoint, and eval table.
- **Reset:** clear only browser demo data and any demo-scoped backend rows available to the current configured repository.

The narrated timing is in [Demo_Script.md](Demo_Script.md).

## Fallbacks

- If OpenAI is unavailable, keep mock mode enabled. Responses remain schema-valid and labeled by behavior, while engine evidence stays real.
- If Supabase is unavailable, the non-blocking checkpoint queue reports its state and the demo trace remains local for the teacher/technical handoff.
- If WebGL is unavailable, the complete semantic 2D control path remains usable.
- If microphone permission is denied, type or edit the coach question and submit it normally.
- If audio is unavailable, visible/text state remains authoritative; synthesized sound is supplementary and can be muted.

## Pre-presentation check

Run:

```bash
npm run typecheck
npm test
npm run eval:coach
npm run build
npm run test:e2e
```

`npm run build` is the production gate and therefore requires the valid Supabase deployment values listed in `.env.example`. This does not add student authentication to the demo; use `npm run dev` for the credential-free local rehearsal when no backend is configured.

Then rehearse Student → Teacher → Technical once, confirm the browser console has no errors, and reset again.
