# Voice — Hold to Ask

## Purpose

Voice is useful because students may be interacting with virtual equipment while wanting to ask a question. The feature should feel like asking a lab instructor nearby.

## UX

- Microphone button in coach panel.
- Press and hold to record.
- Live recording state.
- Transcript appears in editable text box.
- Student can send, edit, or cancel.
- Text input remains available at all times.

## Pipeline

```text
Speech
  ↓
Transcription / Realtime API path
  ↓
Visible transcript
  ↓
/api/coach with transcript + current state
  ↓
Structured coach response
  ↓
Coach panel message
```

## Requirements

- Do not store raw audio by default.
- Do not rely on voice for required demo path; text fallback works.
- Voice uses same coach memory and context as text.
- Ephemeral token route only; no client API keys.
- Show clear permission/error states.

## Non-goals

- Fully spoken output.
- Always-on listening.
- Storing voice recordings.
- Voice-specific tutor behavior inconsistent with text behavior.
