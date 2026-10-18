import { dist } from "../geometry";
import { H, type PoseFrame } from "../pose";

/* Tap, after the finger-tapping item of a Parkinson's motor exam:
   tap the index finger on the thumb, as fast and as wide as you can,
   for ten seconds. What a clinician looks for by eye is what this
   counts: how fast, how even, and whether the taps shrink or stall
   as they go on.

   ── THE OPENING ─────────────────────────────────────────
   The gap between the thumb tip and the index tip, over the length
   from the wrist to the middle knuckle. Measured against the hand
   itself, it reads the same near the camera or far from it.

   ── COUNTING ────────────────────────────────────────────
   A tap is the fingers closing: the opening falling under CLOSE
   after it was last over OPEN. The gap between the two keeps a
   shiver at the closed end from counting twice, and keeps a
   flutter that never really opens from counting at all. Each tap
   keeps the widest opening before it, its amplitude.

   ── TO CENTIMETRES ──────────────────────────────────────
   Wrist to middle knuckle is taken as 9 cm, about the adult average,
   good enough to compare a participant with themselves. */

export const CLOSE = 0.2;
export const OPEN = 0.38;
export const TAP_MS = 10000;
export const HAND_CM = 9;

export type Tap = { t: number; amp: number };

export type TapState = {
  phase: "finding" | "ready" | "tapping" | "done";
  taps: Tap[];
  /* the opening now, in hand lengths, or null with no hand in view */
  opening: number | null;
  /* when the first tap landed, which starts the ten seconds */
  start: number | null;
  /* the time of the latest frame read */
  now: number;
};

export type TapSummary = {
  taps: number;
  /* taps a second, across the run */
  hz: number | null;
  /* how uneven the gaps between taps are: their spread over their
     mean. Under 0.15 is metronome-even */
  irregularity: number | null;
  /* the average widest opening, in cm */
  amplitudeCm: number | null;
  /* how much the last taps shrank against the first, 0.3 is 30% */
  decrement: number | null;
  /* gaps more than twice the usual one: a stall mid-run */
  hesitations: number;
};

export function opening(frame: PoseFrame): number | null {
  const h = frame.hand;
  if (!h) return null;
  const size = dist(h[H.wrist], h[H.middleMcp], frame.aspect);
  if (size < 0.01) return null;
  return dist(h[H.thumbTip], h[H.indexTip], frame.aspect) / size;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function summarise(taps: Tap[]): TapSummary {
  const n = taps.length;
  const gaps = taps.slice(1).map((t, i) => t.t - taps[i].t);
  const span = n > 1 ? (taps[n - 1].t - taps[0].t) / 1000 : 0;
  const gapMean = gaps.length ? mean(gaps) : 0;
  const sd = gaps.length > 1 ? Math.sqrt(mean(gaps.map((g) => (g - gapMean) ** 2))) : 0;
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const amps = taps.map((t) => t.amp);
  const k = Math.min(3, Math.floor(n / 2));
  const first = k ? mean(amps.slice(0, k)) : 0;
  const last = k ? mean(amps.slice(-k)) : 0;
  const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
  return {
    taps: n,
    hz: span > 0 ? round((n - 1) / span, 1) : null,
    irregularity: gaps.length > 2 ? round(sd / gapMean) : null,
    amplitudeCm: n ? round(mean(amps) * HAND_CM, 1) : null,
    decrement: n >= 6 && first > 0 ? round((first - last) / first) : null,
    hesitations: gaps.filter((g) => g > median * 2).length,
  };
}

export function createTap(durationMs = TAP_MS) {
  let state: TapState = { phase: "finding", taps: [], opening: null, start: null, now: 0 };
  /* open since the last tap, and the widest it got */
  let open = false;
  let widest = 0;

  return {
    get state() {
      return state;
    },
    update(frame: PoseFrame): TapState {
      if (state.phase === "done") return state;
      if (state.start !== null && frame.t - state.start >= durationMs) {
        state = { ...state, phase: "done", now: frame.t };
        return state;
      }
      const o = opening(frame);
      if (o === null) {
        state = { ...state, opening: null, now: frame.t, phase: state.start === null ? "finding" : state.phase };
        return state;
      }
      let taps = state.taps;
      let start = state.start;
      if (!open && o > OPEN) {
        open = true;
        widest = o;
      } else if (open) {
        widest = Math.max(widest, o);
        if (o < CLOSE) {
          open = false;
          start ??= frame.t;
          taps = [...taps, { t: frame.t, amp: widest }];
        }
      }
      state = { phase: start === null ? "ready" : "tapping", taps, opening: o, start, now: frame.t };
      return state;
    },
  };
}
