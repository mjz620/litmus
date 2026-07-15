# 5. Information architecture and routes
```text
/
├── /experiments
├── /join/[classCode]
├── /lab/[experimentId]
│   ├── ?mode=practice
│   ├── ?mode=assignment
│   └── /report
├── /student
│   ├── /history
│   └── /sessions/[sessionId]
├── /teacher
│   ├── /classes
│   ├── /classes/[classId]
│   ├── /classes/[classId]/assignments/[assignmentId]
│   └── /classes/[classId]/students/[studentId]
├── /demo
│   ├── /student
│   ├── /teacher
│   └── /technical
└── /api
    ├── /coach
    ├── /evaluate
    ├── /realtime-token
    ├── /sessions/checkpoint
    └── /demo/reset
```

## 5.1 Route behavior

- `/` is a concise landing page with “Try a lab,” “Teacher dashboard,” and “Judge demo” entry points.
- `/experiments` is accessible to guests. Authentication is never required to try the core student experience.
- `/join/[classCode]` asks for Google sign-in only when the student wants their session attached to a class.
- `/lab/[experimentId]` loads the experiment plugin and shell. The chemistry route chunk is lazy-loaded.
- `/teacher/*` requires the teacher role except inside `/demo/teacher`.
- `/demo/*` never requires authentication and always shows a persistent role switcher and reset control.

---
