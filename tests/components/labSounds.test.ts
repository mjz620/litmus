import { describe, expect, it } from "vitest";

import {
  LAB_SOUND_MUTE_KEY,
  LabSoundGate,
  ProceduralLabSounds,
  type LabSoundCue
} from "../../src/components/lab/three/labSounds";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    values
  };
}

describe("procedural lab sound gate", () => {
  it("never permits sound before an explicit unlock gesture", () => {
    const gate = new LabSoundGate();
    expect(gate.allow("drop", 0)).toBe(false);
    gate.unlock();
    expect(gate.allow("drop", 1)).toBe(true);
  });

  it("persists mute for the browser session", () => {
    const storage = memoryStorage();
    const gate = new LabSoundGate(storage);
    gate.unlock();
    gate.setMuted(true);

    expect(gate.allow("valve", 100)).toBe(false);
    expect(storage.values.get(LAB_SOUND_MUTE_KEY)).toBe("true");
    expect(new LabSoundGate(storage).isMuted()).toBe(true);
  });

  it("limits drops to five per second and endpoints to once per session", () => {
    const gate = new LabSoundGate();
    gate.unlock();

    expect(gate.allow("drop", 0)).toBe(true);
    expect(gate.allow("drop", 199)).toBe(false);
    expect(gate.allow("drop", 200)).toBe(true);
    expect(gate.allow("endpoint", 300, "session-a")).toBe(true);
    expect(gate.allow("endpoint", 400, "session-a")).toBe(false);
    expect(gate.allow("endpoint", 400, "session-b")).toBe(true);
  });

  it("synthesizes corresponding cues only from gesture entrypoints", () => {
    const played: LabSoundCue[] = [];
    let nowMS = 1_000;
    const context = {
      state: "running",
      resume: () => Promise.resolve()
    } as unknown as AudioContext;
    const sounds = new ProceduralLabSounds({
      contextFactory: () => context,
      nowMS: () => nowMS,
      synthesize: (_context, cue) => played.push(cue)
    });

    expect(sounds.playFromGesture("valve")).toBe(true);
    nowMS += 200;
    expect(sounds.playFromGesture("drop")).toBe(true);
    nowMS += 200;
    expect(sounds.playFromGesture("endpoint", "session-a")).toBe(true);
    nowMS += 200;
    expect(sounds.playFromGesture("endpoint", "session-a")).toBe(false);
    expect(played).toEqual(["valve", "drop", "endpoint"]);
  });

  it("suppresses synthesis while session mute is enabled", () => {
    const storage = memoryStorage();
    const played: LabSoundCue[] = [];
    const context = {
      state: "running",
      resume: () => Promise.resolve()
    } as unknown as AudioContext;
    const sounds = new ProceduralLabSounds({
      storage,
      contextFactory: () => context,
      nowMS: () => 1_000,
      synthesize: (_context, cue) => played.push(cue)
    });

    sounds.setMuted(true);
    expect(sounds.playFromGesture("valve")).toBe(false);
    expect(played).toEqual([]);
    expect(storage.values.get(LAB_SOUND_MUTE_KEY)).toBe("true");
  });
});
