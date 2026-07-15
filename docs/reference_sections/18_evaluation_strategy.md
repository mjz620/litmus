# 18. Evaluation strategy
## 18.1 Chemistry truth tests

Unit and property tests run without React, 3D, network, database, or LLM.

Required categories:

- known-answer chemistry tests,
- monotonicity/invariant tests,
- boundary/tolerance tests,
- seed validity tests,
- serialization tests,
- nonphysical state rejection.

## 18.2 Coach eval harness

The harness replays seeded event sequences headlessly and checks structured outputs.

### Metrics

- Intervention recall: percentage of seeded mistakes that receive an appropriate intervention.
- False-intervention rate: percentage of routine successful transitions that incorrectly trigger coaching.
- Skill-address accuracy: whether the response addresses the intended skill.
- Hint-level correctness.
- Repetition rate.
- Schema validity.
- Unsafe/off-topic refusal behavior.

### Initial scenarios

| Scenario | Expected | Must not do |
|---|---|---|
| Burette rinsed with water | Ask/prompt about residual water and titrant concentration | State arbitrary numerical answer immediately |
| Fast addition near endpoint | Address rate/control | Discuss unrelated setup |
| Endpoint overshoot | Connect excess volume to bias | Claim experiment is impossible to learn from |
| Correct dropwise addition | Stay silent or minimal stage transition | Interrupt with redundant praise |
| Accurate meniscus read | Remain silent | Re-teach meniscus reading |
| Student asks contextual question | Answer using current state | Ignore current measurements |
| Student asks off-topic question | Brief redirect | Continue long unrelated conversation |
| Repeated unresolved misconception | Escalate hint level | Repeat identical hint |

### Example output table

```text
Scenario                         Expected behavior       Result
----------------------------------------------------------------
Burette rinsed with water        Diagnose dilution      PASS
Endpoint overshot                Prompt reflection      PASS
Wrong meniscus reading           Graduated hint         PASS
Controlled dropwise addition     Remain silent          PASS
Routine successful action        Remain silent          PASS
```

## 18.3 Evaluator tests

- Correct report receives high scores.
- Numerically correct answer with unsupported precision loses sig-fig credit.
- Wrong final value with sound procedure receives partial credit.
- Feedback cites only provided evidence.
- Repeated runs remain acceptably consistent.

## 18.4 End-to-end tests

1. Guest starts titration and completes it without auth.
2. Signed-in student joins class and session appears in teacher dashboard.
3. Network loss does not freeze lab.
4. Pending events sync after reconnection.
5. Judge student session appears in demo teacher dashboard.
6. Demo reset restores initial state.
7. Adaptive retry links to parent session and updates evidence.

---
