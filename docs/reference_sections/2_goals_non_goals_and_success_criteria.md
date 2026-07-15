# 2. Goals, non-goals, and success criteria
## 2.1 Product goals

### G1. Make procedural understanding observable
Capture meaningful student actions such as conditioning glassware, controlling addition rate, reading a meniscus, choosing an indicator, and interpreting measurements.

### G2. Keep scientific truth deterministic
All chemistry calculations, state transitions, tolerances, and hidden ground truth execute locally through pure TypeScript functions. GPT-5.6 never computes pH, endpoint volume, precipitate identity, heat transfer, or grading ground truth.

### G3. Provide context-aware tutoring without becoming annoying
The tutor should react only to semantic transitions, repeated confusion, or direct student questions. Routine successful actions should usually produce silence.

### G4. Personalize practice
When a student demonstrates a meaningful gap, the system should create a short seeded retry scenario focused on that skill rather than forcing a full experiment restart.

### G5. Give teachers actionable evidence
Teacher metrics must be traceable to persisted sessions, events, skill estimates, and reports. The LLM may summarize data but may not fabricate percentages or mastery scores.

### G6. Run on the hardware schools actually have
The laboratory must remain usable on a 4 GB Chromebook with integrated graphics and an ordinary trackpad.

### G7. Be immediately demoable
A judge must reach the product’s “aha” moment without authentication, onboarding, or waiting through a full experiment.

## 2.2 Non-goals for the Build Week version

- Full rigid-body or fluid physics.
- Freeform manipulation of every object in the room.
- Photorealistic graphics.
- Multiplayer laboratory sessions.
- High-stakes summative grading.
- Replacing teacher safety instruction.
- A comprehensive chemistry curriculum.
- An unconstrained general-purpose chatbot.
- Letting the LLM directly write simulation state or database rows.
- Building three separate experiment applications; all experiments must use one shared plugin framework.

## 2.3 Success criteria

The build is successful when all of the following are true:

1. A student can complete the hero titration from setup through report feedback.
2. The chemistry remains functional when OpenAI or Supabase is unavailable.
3. A meaningful mistake produces a relevant coaching intervention within a perceived two seconds.
4. A routine successful action does not produce unnecessary coaching.
5. A completed session updates real persisted teacher analytics.
6. Adaptive Retry can launch from a valid intermediate experiment seed.
7. The judge can experience student, teacher, and technical views from `/demo` without logging in.
8. The hero path sustains at least 30 FPS on the target Chromebook profile.
9. Seeded-error evals report intervention recall and false-intervention behavior.
10. A second experiment proves that the plugin architecture generalizes without duplicating the shell, coach, evaluator, or persistence layer.

---
