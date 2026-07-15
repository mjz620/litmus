# 17. Safety, privacy, and trust
## 17.1 Safety

- System prompt restricts tutor to the supported simulated experiment and approved high-school chemistry context.
- For real-world hazardous modifications, the tutor should direct the student to follow the teacher-approved protocol and supervision.
- No claims that the simulation guarantees physical laboratory safety.
- No instructions for unsupervised dangerous chemical preparation.

## 17.2 Privacy

- Minimize student personal data.
- Do not store raw voice audio.
- Make transcript retention explicit; default to session-only unless needed for educational evidence.
- Do not expose internal model chain-of-thought.
- Teacher view shows educational evidence, not hidden private model reasoning.
- Demo users are synthetic.

## 17.3 Explainability

Every teacher-facing insight should be traceable:

```text
Metric → skill estimate → evidence reason → semantic event → student action
```

Every report criterion should cite report or event evidence.

---
