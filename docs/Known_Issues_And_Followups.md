# Known Issues and Followups

When Codex notices something outside the active ticket, it should record it here rather than fixing it automatically.

## Template

```md
## KI-000 — Title

- Date:
- Found during ticket:
- Severity: low | medium | high
- Area:
- Description:
- Suggested follow-up ticket:
- Do not fix until:
```

## Current issues

None currently recorded.

## Resolved issues

## KI-001 — Root README fails the global Prettier check

- Date: 2026-07-15
- Found during ticket: T0003
- Severity: low
- Area: documentation / formatting
- Description: A repository-root `README.md` appeared outside T0003 and is not
  formatted according to the current Prettier configuration. It was preserved
  unchanged, so `npm run format:check` reports that file even though all
  T0003-owned files pass targeted formatting validation.
- Suggested follow-up ticket: documentation hygiene pass when root documentation
  ownership is next addressed.
- Do not fix until: the project owner explicitly includes the root README in a
  documentation ticket or requests the formatting change.
- Resolved: 2026-07-15. The project owner moved documentation to the repository
  root and explicitly requested a documentation update; `README.md` was then
  formatted and updated to describe the committed/local-reference split.

## Future followups already expected

- More advanced accessibility alternatives for all 3D actions.
- Offline IndexedDB write queue hardening.
- Calorimetry plugin after core demo is stable.
- Teacher-authored rubrics after MVP.
- Rich trend charts after MVP.
