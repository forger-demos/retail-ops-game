import type {TimelineEvent} from '../sim/timeline';

export type SfxName = 'walk-in' | 'walkout' | 'tin-done' | 'van' | 'sale' | 'hum' | 'press' | 'refuse';

interface Note {
  hz: number;
  /** Seconds after the effect starts. */
  at: number;
  seconds: number;
}

const run = (hzs: readonly number[], seconds: number): readonly Note[] => hzs.map((hz, i) => ({hz, at: i * seconds, seconds}));

/** Square-wave phrases written for this project: a door chime up, a coin jingle down, a till chime, a low shaker hum, a van pulling away, a press blip and a refusal thud. */
export const EFFECTS: Readonly<Record<SfxName, readonly Note[]>> = {
  'walk-in': run([660, 880], 0.07),
  walkout: run([1175, 988, 784, 523], 0.06),
  'tin-done': run([988, 1319], 0.05),
  van: run([131, 165, 196, 262], 0.1),
  sale: run([784, 1047, 1319], 0.06),
  hum: run([98, 110, 98], 0.12),
  press: run([523], 0.04),
  refuse: run([196, 147], 0.06),
};

const VOLUME = 0.06;
/** A jump longer than this in one frame is a skip, not playback, so the events it passes over stay silent. */
export const MAX_PLAYBACK_STEP = 1;

/**
 * The effects that fall in (from, to] shop minutes, in order. A tin is done each
 * time an equal share of its order's mix has elapsed, and the shaker hums as each begins;
 * the till chimes when a walk-in is served; the van leaves at dispatch.
 */
export function effectsBetween(timeline: readonly TimelineEvent[], from: number, to: number): SfxName[] {
  if (to <= from || to - from > MAX_PLAYBACK_STEP) return [];
  const heard: {at: number; name: SfxName}[] = [];
  const hear = (at: number, name: SfxName): void => {
    if (at > from && at <= to) heard.push({at, name});
  };
  for (const e of timeline) {
    switch (e.type) {
      case 'walk-in-arrive':
        hear(e.at, 'walk-in');
        break;
      case 'walk-in-lost':
        hear(e.at, 'walkout');
        break;
      case 'walk-in-served':
        hear(e.at, 'sale');
        break;
      case 'hub-dispatch':
        hear(e.at, 'van');
        break;
      case 'mix-start':
        for (let tin = 1; tin <= e.tins; tin++) {
          hear(e.at + ((e.until - e.at) * (tin - 1)) / e.tins, 'hum');
          hear(e.at + ((e.until - e.at) * tin) / e.tins, 'tin-done');
        }
        break;
      default:
        break;
    }
  }
  return heard.sort((a, b) => a.at - b.at).map(h => h.name);
}

export interface OscillatorLike {
  type: string;
  frequency: {setValueAtTime(value: number, time: number): unknown};
  connect(node: unknown): unknown;
  start(time: number): void;
  stop(time: number): void;
}

export interface GainLike {
  gain: {setValueAtTime(value: number, time: number): unknown; linearRampToValueAtTime(value: number, time: number): unknown};
  connect(node: unknown): unknown;
}

/** The slice of AudioContext the effects use, so tests can stand in for it. */
export interface AudioLike {
  currentTime: number;
  destination: unknown;
  state?: string;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
  resume?(): Promise<unknown>;
}

export interface Sfx {
  readonly on: boolean;
  /** Flips the mute state and returns whether sound is now on; stays off when the browser has no audio. */
  toggle(): boolean;
  play(name: SfxName): void;
}

/**
 * Sound starts muted. The audio context is only made on the first unmute, which is always
 * inside a key press or tap, so browsers that gate audio on a gesture allow it.
 */
export function createSfx(makeContext: () => AudioLike | null): Sfx {
  let on = false;
  let ctx: AudioLike | null = null;

  const context = (): AudioLike | null => {
    if (ctx) return ctx;
    try {
      ctx = makeContext();
    } catch {
      ctx = null;
    }
    return ctx;
  };

  return {
    get on() {
      return on;
    },
    toggle() {
      if (on) {
        on = false;
        return on;
      }
      const c = context();
      if (!c) return on;
      void c.resume?.();
      on = true;
      return on;
    },
    play(name) {
      const c = on ? context() : null;
      if (!c) return;
      const t0 = c.currentTime;
      for (const note of EFFECTS[name]) {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(note.hz, t0 + note.at);
        gain.gain.setValueAtTime(VOLUME, t0 + note.at);
        gain.gain.linearRampToValueAtTime(0, t0 + note.at + note.seconds);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(t0 + note.at);
        osc.stop(t0 + note.at + note.seconds);
      }
    },
  };
}
