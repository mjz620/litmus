# Chromebook Performance Profile

Status: implementation and reproducible profiling protocol complete; latest measurement is recorded below.

## Rendering budget

The titration scene is isolated in a client-only lazy chunk. It uses primitive/lathe geometry, a capped `[1, 1.5]` device-pixel ratio, antialiasing disabled, a `frameloop="demand"` canvas, a 16 × 12 sky dome, no post-processing, no downloaded models/textures, and no physics engine. High quality uses one 512² shadow map and a one-time procedural room environment. Reduced graphics disables transmission, that environment, and all shadows while retaining measurement marks and controls.

When the camera, hover effects, and liquid are settled, the scene does not chain invalidations. Camera movement, stopcock movement, and active liquid motion request frames only while they are changing.

## Reproducible constrained profile

Start the development server, then run:

```bash
npm run dev -- --hostname 127.0.0.1
npm run profile:lab
```

The profile uses headless Chromium at 1366 × 768, SwiftShader, and a 4× CPU throttle. It activates edge-pan for five seconds and records the real React Three Fiber scene callbacks through a development-only probe, alongside browser scheduling, slow-render-frame percentage, main-thread task utilization, and JavaScript heap use. The command fails below 25 actual rendered frames per second; the ticket target is approximately 30 FPS or a documented best effort.

## Latest local result

Measured 2026-07-17 on the repository host with the protocol above:

| Metric | Result |
| --- | ---: |
| Actual rendered frames | 133 / 145 / 170 over ~5.01 s each |
| Average actual render FPS | 26.54 / 28.88 / 33.88 (median 28.88) |
| Render intervals over 33.34 ms | 21.21% / 18.75% / 9.47% (median 18.75%) |
| Main-thread task utilization | 100% |
| JavaScript heap used | 23.92 / 19.21 / 18.63 MB (median 19.21 MB) |

Across three consecutive final runs, the scene sustained a median 28.88 actual render callbacks per second while continuously edge-panning under the imposed 4× CPU throttle and software WebGL path. Every run cleared the automated 25 FPS floor, and the median is approximately the ticket's 30 FPS target. The saturated main-thread reading makes this a deliberately conservative stress sample; the three-run spread is retained rather than selecting the fastest result.

## Interpretation and limits

This repeatable software profile is a conservative development signal, not a substitute for Chrome DevTools capture on representative school hardware. SwiftShader and host scheduling differ from an actual Chromebook GPU. Before a broad deployment, repeat the student demo on the lowest supported physical device, record thermals and input latency over a full session, and select reduced graphics by policy if needed.
