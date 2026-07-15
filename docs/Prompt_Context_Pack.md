# Prompt Context Pack

Paste this compact context when opening a new ChatGPT/Codex thread.

## Project

LabBench AI is an AI-native virtual chemistry pre-lab app for high-school students and teachers, especially under-resourced schools with limited lab access and low-spec Chromebooks.

## Core loop

Student action → deterministic chemistry engine → semantic event → in-memory StudentModel → AI coach/evaluator → checkpoint to Supabase → teacher readiness dashboard → adaptive retry.

## Stack

Next.js + TypeScript + React Three Fiber + Zustand + Supabase + OpenAI server routes + Vitest/Playwright.

## Non-negotiables

- Chemistry deterministic and local.
- LLM never computes ground truth.
- UI never reimplements chemistry.
- All meaningful actions through experiment `step()`.
- Semantic events are shared evidence layer.
- StudentModel in memory, flushed at checkpoints.
- Teacher metrics deterministic from DB rows.
- Demo mode uses production logic.
- One ticket per Codex run.

## MVP surfaces

- Student titration lab.
- AI coach panel with text and voice question input.
- Report/evaluator and Adaptive Retry.
- Teacher readiness dashboard.
- `/demo` with Student, Teacher, Technical modes.
- Precipitation plugin as extensibility proof.

## First tickets

Start with `T0001` through `T0006`: project skeleton, docs in repo, experiment contract, titration engine import, truth tests, registry.
