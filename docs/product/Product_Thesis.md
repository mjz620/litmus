# Product Thesis

## One-sentence positioning

LabBench AI is an AI-native virtual chemistry lab that prepares students for physical laboratory work by observing their simulated actions, diagnosing misconceptions, and giving teachers readiness evidence.

## Problem

Many students enter a chemistry lab having read the procedure but without understanding how specific actions affect the experiment. Teachers often discover procedural misconceptions only after students waste materials, produce unusable data, or become anxious at the bench.

This is especially important for under-resourced high schools where students may have limited access to chemicals, glassware, repeated practice, or individualized teacher support.

## Product promise

Students finish a session able to answer:

- What do I do next?
- Why does this action matter?
- Am I ready for the physical lab?

Teachers finish with:

- a reliable class readiness snapshot,
- concrete misconceptions to review,
- identifiable students who need additional support,
- evidence grounded in actions rather than model intuition.

## Differentiating loop

```text
Student action
  ↓
Deterministic chemistry engine
  ↓
Semantic event evidence
  ↓
AI coach diagnosis and hints
  ↓
Targeted retry scenario
  ↓
Persisted skill evidence
  ↓
Teacher readiness dashboard
```

The product is not "a 3D lab with a chatbot." The 3D lab is the instrument that collects evidence of student understanding.

## Educational position

LabBench AI prepares students for hands-on laboratory work; it does not replace physical labs, safety instruction, or teacher judgment. It should be marketed as pre-lab rehearsal, formative assessment, and teacher planning support.

## Primary Build Week success criteria

- Titration is polished end to end.
- Chemistry remains deterministic and local.
- Coach responds to meaningful mistakes and stays silent on routine success.
- Teacher analytics update from real persisted evidence.
- Judge can experience student, teacher, and technical modes from `/demo` with no auth.
- The hero path reaches the aha moment in under 60 seconds.
