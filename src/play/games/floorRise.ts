import { dist, mid } from "../geometry";
import { J, type Point, type PoseFrame } from "../pose";

/* Floor rise, after the timed rise from the floor in the North Star
   Ambulatory Assessment: start sitting on the floor, and stand up as
   quickly as you safely can. The measure is the time from the first
   lift off the floor to standing tall, and how the participant got
   there: in Duchenne, hands pressed on the thighs to push the body
   upright (a Gowers' manoeuvre) are a classic sign of weak hips.

   ── WHAT IT WATCHES ─────────────────────────────────────
   How high the hips sit above the ankles, in shoulder widths. From
   the front, shoulder width barely changes between sitting on the
   floor and standing, so it is a ruler that comes along through the
   whole rise. The participant stands first, which sets what tall
   means for them; every threshold after is a share of that.

   ── THE RISE ────────────────────────────────────────────
   Down to the floor, settled for a second, then the clock starts as
   the hips lift clear of where they sat. It stops once they reach
   most of standing height and stay there for a moment, so a lurch
   that falls back doesn't stop it early. Rungs on the way up, a
   third and two thirds of the way, are timed too: where a rise
   slows is part of the picture. */

export const DOWN = 0.3;
export const LIFT = 0.12;
export const RUNGS = [0.33, 0.66];
export const TALL = 0.88;
/* hands on the thighs only count below this: standing, arms hanging
   at the sides put the wrists at the thighs anyway */
const HANDS_BELOW = 0.75;
const CAL_MS = 1000;
const SETTLE_MS = 1000;
const HOLD_MS = 300;
export const LIMIT_MS = 30000;

export type FloorRiseState = {
  phase: "finding" | "stand" | "down" | "settling" | "ready" | "rising" | "done";
  /* standing hip height, in shoulder widths, once measured */
  tall: number | null;
  /* hip height now, as a share of standing: 0 on the floor, 1 tall */
  height: number;
  /* when the rise started, and how long it took, ms */
  start: number | null;
  riseMs: number | null;
  completed: boolean;
  /* time from the start to passing each rung, ms */
  rungMs: (number | null)[];
  /* time spent with the hands on the thighs, or on the floor, while rising */
  thighsMs: number;
  floorMs: number;
  /* whether hands are on the thighs this frame, for the screen */
  handsOnThighs: boolean;
};

const seen = (p: Point) => (p.visibility ?? 1) > 0.5;

/* hip height above the ankles, in shoulder widths */
export function hipLift(frame: PoseFrame): number | null {
  const p = frame.landmarks;
  if (!p || ![J.leftShoulder, J.rightShoulder, J.leftHip, J.rightHip, J.leftAnkle, J.rightAnkle].every((i) => seen(p[i]))) return null;
  const sw = dist(p[J.leftShoulder], p[J.rightShoulder], frame.aspect);
  if (sw < 0.02) return null;
  return (mid(p[J.leftAnkle], p[J.rightAnkle]).y - mid(p[J.leftHip], p[J.rightHip]).y) / sw;
}

/* a wrist on the front of a thigh: between hip and knee, and over
   the legs. Arms hanging at the sides also reach thigh height seen
   from the front, but out at shoulder width; a hand pushing on a
   thigh is in over it, inside the width of the hips */
function onThighs(p: Point[]) {
  const half = Math.abs(p[J.leftHip].x - p[J.rightHip].x) * 0.65;
  const cx = mid(p[J.leftHip], p[J.rightHip]).x;
  const top = Math.min(p[J.leftHip].y, p[J.rightHip].y) - 0.02;
  const bottom = Math.max(p[J.leftKnee].y, p[J.rightKnee].y) + 0.03;
  return [J.leftWrist, J.rightWrist].some((i) => seen(p[i]) && p[i].y > top && p[i].y < bottom && Math.abs(p[i].x - cx) < half);
}

/* a wrist down by the feet */
function onFloor(p: Point[]) {
  const ankle = mid(p[J.leftAnkle], p[J.rightAnkle]).y;
  return [J.leftWrist, J.rightWrist].some((i) => seen(p[i]) && p[i].y > ankle - 0.06);
}

export function createFloorRise(limitMs = LIMIT_MS) {
  let state: FloorRiseState = {
    phase: "finding",
    tall: null,
    height: 0,
    start: null,
    riseMs: null,
    completed: false,
    rungMs: RUNGS.map(() => null),
    thighsMs: 0,
    floorMs: 0,
    handsOnThighs: false,
  };
  let calStart: number | null = null;
  let calSum = 0;
  let calN = 0;
  let settleStart: number | null = null;
  let settleSum = 0;
  let settleN = 0;
  /* where the hips sat on the floor, as a share of tall */
  let base = 0;
  let tallSince: number | null = null;
  let lastT: number | null = null;

  return {
    get state() {
      return state;
    },
    update(frame: PoseFrame): FloorRiseState {
      if (state.phase === "done") return state;
      const dt = lastT === null ? 0 : Math.max(0, frame.t - lastT);
      lastT = frame.t;
      if (state.phase === "rising" && state.start !== null && frame.t - state.start >= limitMs) {
        state = { ...state, phase: "done", completed: false };
        return state;
      }
      const lift = hipLift(frame);
      if (lift === null) {
        if (state.tall === null) state = { ...state, phase: "finding" };
        return state;
      }

      /* standing first, to learn how tall is */
      if (state.tall === null) {
        if (lift < 1.2) {
          calStart = null;
          calSum = calN = 0;
          state = { ...state, phase: "stand" };
          return state;
        }
        calStart ??= frame.t;
        calSum += lift;
        calN += 1;
        state = frame.t - calStart >= CAL_MS ? { ...state, phase: "down", tall: calSum / calN, height: 1 } : { ...state, phase: "stand" };
        return state;
      }

      const height = lift / state.tall;
      const p = frame.landmarks!;

      if (state.phase === "down" || state.phase === "settling") {
        if (height > DOWN) {
          settleStart = null;
          settleSum = settleN = 0;
          state = { ...state, phase: "down", height };
          return state;
        }
        settleStart ??= frame.t;
        settleSum += height;
        settleN += 1;
        if (frame.t - settleStart >= SETTLE_MS) {
          base = settleSum / settleN;
          state = { ...state, phase: "ready", height };
        } else {
          state = { ...state, phase: "settling", height };
        }
        return state;
      }

      if (state.phase === "ready") {
        state = height > base + LIFT ? { ...state, phase: "rising", start: frame.t, height } : { ...state, height };
        return state;
      }

      /* rising */
      const since = frame.t - state.start!;
      const rungMs = state.rungMs.map((r, i) => (r === null && height >= RUNGS[i] ? since : r));
      const thighs = height < HANDS_BELOW && onThighs(p);
      const thighsMs = state.thighsMs + (thighs ? dt : 0);
      const floorMs = state.floorMs + (height < 0.5 && onFloor(p) ? dt : 0);
      if (height >= TALL) {
        tallSince ??= frame.t;
        if (frame.t - tallSince >= HOLD_MS) {
          state = { ...state, phase: "done", height, rungMs, thighsMs, floorMs, handsOnThighs: false, completed: true, riseMs: tallSince - state.start! };
          return state;
        }
      } else {
        tallSince = null;
      }
      state = { ...state, height, rungMs, thighsMs, floorMs, handsOnThighs: thighs };
      return state;
    },
  };
}
