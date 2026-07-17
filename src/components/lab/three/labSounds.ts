export type LabSoundCue =
  | "valve"
  | "drop"
  | "endpoint"
  | "rinse_fill"
  | "indicator";

export const LAB_SOUND_MUTE_KEY = "labbench.sound.muted";

interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ProceduralLabSoundsOptions {
  storage?: SessionStorageLike;
  contextFactory?: () => AudioContext | null;
  nowMS?: () => number;
  synthesize?: (context: AudioContext, cue: LabSoundCue) => void;
}

/** Pure autoplay/mute/debounce policy, separated from browser audio synthesis. */
export class LabSoundGate {
  private unlocked = false;
  private muted: boolean;
  private readonly lastCueAt = new Map<LabSoundCue, number>();
  private readonly endpointSessions = new Set<string>();
  private readonly listeners = new Set<() => void>();

  constructor(private readonly storage?: SessionStorageLike) {
    this.muted = storage?.getItem(LAB_SOUND_MUTE_KEY) === "true";
  }

  unlock(): void {
    this.unlocked = true;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.storage?.setItem(LAB_SOUND_MUTE_KEY, String(muted));
    for (const listener of this.listeners) listener();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  allow(cue: LabSoundCue, nowMS: number, sessionId?: string): boolean {
    if (!this.unlocked || this.muted) return false;
    if (cue === "endpoint" && sessionId) {
      if (this.endpointSessions.has(sessionId)) return false;
      this.endpointSessions.add(sessionId);
    }

    const debounceMS = cue === "drop" ? 200 : cue === "valve" ? 100 : 0;
    const previous = this.lastCueAt.get(cue);
    if (previous !== undefined && nowMS - previous < debounceMS) return false;
    this.lastCueAt.set(cue, nowMS);
    return true;
  }
}

export class ProceduralLabSounds {
  private readonly gate: LabSoundGate;
  private context: AudioContext | null = null;
  private readonly contextFactory?: () => AudioContext | null;
  private readonly nowMS: () => number;
  private readonly synthesize: (
    context: AudioContext,
    cue: LabSoundCue
  ) => void;

  constructor(options: ProceduralLabSoundsOptions = {}) {
    this.gate = new LabSoundGate(
      options.storage ??
        (typeof window === "undefined" ? undefined : window.sessionStorage)
    );
    this.contextFactory = options.contextFactory;
    this.nowMS = options.nowMS ?? (() => performance.now());
    this.synthesize = options.synthesize ?? synthesizeCue;
  }

  isMuted(): boolean {
    return this.gate.isMuted();
  }

  setMuted(muted: boolean): void {
    this.gate.setMuted(muted);
    if (!muted) this.ensureContextFromGesture();
  }

  subscribe(listener: () => void): () => void {
    return this.gate.subscribe(listener);
  }

  playFromGesture(cue: LabSoundCue, sessionId?: string): boolean {
    const context = this.ensureContextFromGesture();
    if (!context || !this.gate.allow(cue, this.nowMS(), sessionId)) {
      return false;
    }

    try {
      this.synthesize(context, cue);
      return true;
    } catch {
      return false;
    }
  }

  private ensureContextFromGesture(): AudioContext | null {
    this.gate.unlock();

    if (!this.context) {
      if (this.contextFactory) {
        this.context = this.contextFactory();
      } else if (typeof window === "undefined") {
        return null;
      } else {
        const AudioContextClass =
          window.AudioContext ??
          (
            window as typeof window & {
              webkitAudioContext?: typeof AudioContext;
            }
          ).webkitAudioContext;
        if (!AudioContextClass) return null;
        this.context = new AudioContextClass();
      }
    }

    if (this.context?.state === "suspended") void this.context.resume();
    return this.context;
  }
}

let singleton: ProceduralLabSounds | null = null;

export function getLabSounds(): ProceduralLabSounds {
  singleton ??= new ProceduralLabSounds();
  return singleton;
}

function synthesizeCue(context: AudioContext, cue: LabSoundCue): void {
  switch (cue) {
    case "valve":
      playTone(context, 420, 0.035, 0.1, "triangle");
      playNoise(context, 0.012, 2400, "highpass", 0.06);
      break;
    case "drop":
      playNoise(context, 0.06, 1800, "bandpass", 0.09);
      break;
    case "endpoint":
      playTone(context, 660, 0.11, 0.13, "sine");
      playTone(context, 880, 0.11, 0.13, "sine", 0.11);
      break;
    case "rinse_fill":
      playNoise(context, 0.18, 520, "lowpass", 0.07);
      break;
    case "indicator":
      playTone(context, 520, 0.03, 0.06, "sine");
      break;
  }
}

function playTone(
  context: AudioContext,
  frequency: number,
  durationS: number,
  peakGain: number,
  type: OscillatorType,
  delayS = 0
): void {
  const startAt = context.currentTime + delayS;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peakGain, startAt + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationS);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + durationS + 0.01);
}

function playNoise(
  context: AudioContext,
  durationS: number,
  frequency: number,
  filterType: BiquadFilterType,
  peakGain: number
): void {
  const frameCount = Math.ceil(context.sampleRate * durationS);
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.random() * 2 - 1;
  }

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const startAt = context.currentTime;
  source.buffer = buffer;
  filter.type = filterType;
  filter.frequency.setValueAtTime(frequency, startAt);
  filter.Q.setValueAtTime(filterType === "bandpass" ? 4 : 1, startAt);
  gain.gain.setValueAtTime(peakGain, startAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationS);
  source.connect(filter).connect(gain).connect(context.destination);
  source.start(startAt);
  source.stop(startAt + durationS + 0.01);
}
