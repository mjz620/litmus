# 16. Performance and reliability budgets
## 16.1 Chromebook target

Target profile:

- 4 GB RAM,
- integrated graphics,
- 1366 × 768 display,
- Chrome,
- ordinary school Wi-Fi.

## 16.2 Graphics budgets

- Sustained ≥30 FPS in hero lab.
- Prefer <100 draw calls.
- Prefer <100k visible triangles.
- Texture dimensions generally ≤1024 px.
- No post-processing passes in P0.
- Avoid dynamic real-time shadows; use baked/simple lighting.
- Lazy-load experiment assets.
- Dispose geometry/materials on route exit.

## 16.3 Application budgets

- 3D route chunk lazy-loaded.
- First useful non-3D page interaction within 2 seconds on ordinary broadband.
- Lab loading screen shows progress and a useful tip.
- No main-thread task >50 ms during ordinary interaction where avoidable.
- Event buffers bounded.

## 16.4 AI latency and cost

- Perceived first response within 2 seconds by streaming status/text.
- Sim never blocks on a model call.
- Session coach-call cap configurable; suggested default 15 unsolicited/direct calls combined for demo.
- Input context bounded to recent events and compact summaries.
- Model selection in one server configuration file.
- Graceful “Coach unavailable” state.

## 16.5 Reliability

- All persistence writes idempotent.
- Unsynced event queue survives refresh when practical.
- Duplicate event submission does not duplicate teacher evidence.
- Demo data remains resettable and isolated.

---
