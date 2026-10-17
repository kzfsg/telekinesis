import { abduction, dist, mid } from "../geometry";
import { J, type PoseFrame } from "../pose";

/* Steady hand, after a clinician's tremor rating: hold one arm out
   to the side, level with the shoulder, as still as you can. The
   measure is how much the wrist shakes, and how fast.

   ── FROM WRIST TO TREMOR ────────────────────────────────
   The wrist's path is resampled to an even 30 a second. Its slow
   drift, the arm sinking or swaying, is taken away by subtracting a
   moving average a little under half a second wide, which leaves
   anything faster than about 2.5 shakes a second: tremor lives
   there, typically 4 to 12. What is left gives the size (its root
   mean square) and the frequency (the strongest peak in its
   spectrum). A camera at 30 frames a second can see shakes up to
   15 a second, so the peak is looked for between 3 and 12.

   ── TO MILLIMETRES ──────────────────────────────────────
   Shoulder width is taken as 38 cm, the adult average, which turns
   the camera's units into real ones well enough to compare a
   participant with themselves week to week. */

export const SHOULDER_CM = 38;
export const HOLD_MS = 15000;
const RATE = 30;
const WINDOW_S = 0.4;

export type Sample = { t: number; x: number; y: number };
export type Tremor = { sizeMm: number; hz: number | null };

/* resample onto an even clock by straight lines between samples */
function resample(samples: Sample[], rate = RATE) {
  const out: { x: number; y: number }[] = [];
  if (samples.length < 2) return out;
  const t0 = samples[0].t, t1 = samples[samples.length - 1].t;
  let j = 0;
  for (let t = t0; t <= t1; t += 1000 / rate) {
    while (j < samples.length - 2 && samples[j + 1].t < t) j++;
    const a = samples[j], b = samples[j + 1];
    const f = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
    out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
  }
  return out;
}

/* each value minus the average of those around it */
function detrend(v: number[], half: number) {
  return v.map((x, i) => {
    let s = 0, n = 0;
    for (let k = Math.max(0, i - half); k <= Math.min(v.length - 1, i + half); k++) {
      s += v[k];
      n++;
    }
    return x - s / n;
  });
}

/* power at one frequency, by direct Fourier sum */
function power(v: number[], hz: number, rate: number) {
  let re = 0, im = 0;
  for (let i = 0; i < v.length; i++) {
    const a = (2 * Math.PI * hz * i) / rate;
    re += v[i] * Math.cos(a);
    im -= v[i] * Math.sin(a);
  }
  return (re * re + im * im) / v.length;
}

/* samples in square camera units; cmPerUnit turns them into cm */
export function analyseTremor(samples: Sample[], cmPerUnit: number): Tremor {
  const even = resample(samples);
  const half = Math.round((WINDOW_S * RATE) / 2);
  if (even.length < RATE * 2) return { sizeMm: 0, hz: null };
  /* the ends, where the average is lopsided, are left out */
  const xs = detrend(even.map((p) => p.x), half).slice(half, -half);
  const ys = detrend(even.map((p) => p.y), half).slice(half, -half);
  const rms = Math.sqrt(xs.reduce((s, x, i) => s + x * x + ys[i] * ys[i], 0) / xs.length);
  const sizeMm = rms * cmPerUnit * 10;

  let best = 0, bestHz = 0, total = 0;
  for (let hz = 3; hz <= 12; hz += 0.1) {
    const p = power(xs, hz, RATE) + power(ys, hz, RATE);
    total += p;
    if (p > best) {
      best = p;
      bestHz = hz;
    }
  }
  /* a real tremor stands well above the rest of the band; noise doesn't */
  const mean = total / 91;
  const hz = best > mean * 4 && sizeMm > 0.2 ? Math.round(bestHz * 10) / 10 : null;
  return { sizeMm: Math.round(sizeMm * 10) / 10, hz };
}

export type SteadyState = {
  phase: "finding" | "raise" | "holding" | "done";
  side: "left" | "right" | null;
  /* ms held so far */
  held: number;
  /* the last few seconds' shake, in mm, for the live display */
  wobble: number;
  result: Tremor | null;
};

export function createSteadyHand(holdMs = HOLD_MS) {
  let state: SteadyState = { phase: "finding", side: null, held: 0, wobble: 0, result: null };
  let samples: Sample[] = [];
  let cmPerUnit = 0;
  let startT = 0;

  return {
    get state() {
      return state;
    },
    update(frame: PoseFrame): SteadyState {
      if (state.phase === "done") return state;
      const p = frame.landmarks;
      const a = frame.aspect;
      if (!p || ![J.leftShoulder, J.rightShoulder, J.leftHip, J.rightHip, J.leftWrist, J.rightWrist].every((i) => (p[i].visibility ?? 1) > 0.5)) {
        if (state.phase !== "holding") state = { ...state, phase: "finding" };
        return state;
      }
      const ms = mid(p[J.leftShoulder], p[J.rightShoulder]);
      const mh = mid(p[J.leftHip], p[J.rightHip]);
      const left = abduction(p[J.leftShoulder], p[J.leftWrist], ms, mh, a);
      const right = abduction(p[J.rightShoulder], p[J.rightWrist], ms, mh, a);

      if (state.phase === "finding" || state.phase === "raise") {
        /* the hold starts once either arm is out near level */
        const side = left >= right ? "left" : "right";
        if (Math.max(left, right) > 65) {
          cmPerUnit = SHOULDER_CM / dist(p[J.leftShoulder], p[J.rightShoulder], a);
          samples = [];
          startT = frame.t;
          state = { phase: "holding", side, held: 0, wobble: 0, result: null };
        } else {
          state = { ...state, phase: "raise" };
          return state;
        }
      }

      const w = p[state.side === "left" ? J.leftWrist : J.rightWrist];
      samples.push({ t: frame.t, x: w.x * a, y: w.y });
      const held = frame.t - startT;
      /* the live reading uses the last 2.5 seconds: the analysis
         needs at least two before it will say anything */
      const recent = samples.filter((s) => s.t > frame.t - 2500);
      const wobble = analyseTremor(recent, cmPerUnit).sizeMm;
      if (held >= holdMs) {
        state = { ...state, phase: "done", held, wobble, result: analyseTremor(samples, cmPerUnit) };
      } else {
        state = { ...state, held, wobble };
      }
      return state;
    },
  };
}
