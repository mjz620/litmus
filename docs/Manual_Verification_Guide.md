# Manual Verification Guide

Build passing is not enough. Each ticket must include manual verification.

## General verification for every ticket

1. Confirm only allowed files/folders changed.
2. Run formatting/lint/build as applicable.
3. Run relevant tests.
4. Open the affected route/UI if applicable.
5. Check browser console for errors.
6. Confirm the ticket did not implement future features.
7. Update `docs/Repo_Current_State.md`.
8. Move unrelated findings to `docs/Known_Issues_And_Followups.md`.

## Project skeleton tickets

- `npm install` succeeds.
- `npm run dev` starts.
- `npm run build` succeeds.
- Home page loads.
- Strict TypeScript enabled.

## Experiment core tickets

- Run `npm test -- titration` or equivalent.
- Inspect failing tests before allowing changes.
- Verify no React/Three/Supabase/OpenAI imports in engine files.
- Verify positive and negative event scenarios.

## Lab UI tickets

- Open `/lab/titration`.
- Dispatch at least one typed action.
- Confirm canvas/control UI reflects engine state.
- Confirm no chemistry duplicated in components.
- Use browser performance tools for obvious frame drops.

## Coach tickets

- Trigger known error event.
- Confirm response is contextual.
- Trigger controlled successful event.
- Confirm coach stays silent.
- Ask direct question.
- Confirm answer references current state and not made-up values.

## Persistence tickets

- Create session.
- Write event batch.
- Retry same checkpoint; confirm no duplicate rows.
- Refresh teacher dashboard; confirm data persists.
- Confirm guest/demo flow still works.

## Teacher dashboard tickets

- Load seeded class.
- Confirm metrics match fixture rows.
- Drill into student detail.
- Confirm common misconception links to evidence.
- Confirm no LLM-generated numbers.

## Demo tickets

- Open `/demo` in incognito.
- No login required.
- Student demo starts at 22.00 mL.
- Role switcher works.
- Judge session appears in teacher view.
- Reset only clears ephemeral judge data.

## Voice tickets

- Deny mic permission; text fallback still works.
- Allow mic permission; transcript appears.
- Edit transcript before sending.
- Confirm same `/api/coach` path is used.

## Performance tickets

- Test low-performance settings.
- Disable postprocessing.
- Confirm reduced-motion mode.
- Check bundle size regression.
- Verify 30 FPS target on constrained profile if available.
