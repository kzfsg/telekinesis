import { mid } from "../geometry";
import { J, type PoseFrame } from "../pose";

/* Chair rise, after the 30-second chair stand test: sit, arms crossed,
   and stand up fully as many times as you can in 30 seconds. The
   score is the number of full stands.

   ── WHAT IT WATCHES ─────────────────────────────────────
   A camera facing the participant sees a knee bend foreshortened, so
   knee angle alone is unreliable. What it does see plainly is how
   high the hips sit between the ankles and the shoulders. Seated,
   the hips drop toward the ankles; standing, they rise. That ratio is
   the signal, and it does not depend on how far away they sit.

   ── COUNTING ────────────────────────────────────────────
   The first second, seated, sets the baseline. A stand counts once
   the ratio climbs past STAND above it; the next can't count until
   it has fallen back below SIT. The gap between the two keeps a
   wobble halfway up from counting twice.

   ── ATTEMPTS ────────────────────────────────────────────
   A rise that gets well off the seat but sinks back before standing
   counts as a partial: in Duchenne, failed attempts say as much as
   successful ones. Each full stand also keeps how long it took, from
   leaving the seat to standing. */

export const STAND = 1.18;
export const SIT = 1.08;
/* off the seat, and far enough up to be an attempt */
export const LEAVE = 1.03;
export const ATTEMPT = 1.1;
const CALIBRATION_MS = 1000;

export type ChairRiseState = {
  phase: "finding" | "calibrating" | "seated" | "standing";
  reps: number;
  /* the seated ratio, once calibrated */
  baseline: number | null;
  /* the latest ratio over the baseline: 1 seated, about 1.3 standing */
  rise: number;
  /* when each stand was counted, ms after the first frame */
  standTimes: number[];
  /* how long each full stand took, seat to standing, in ms */
  riseMs: number[];
  /* rises that got off the seat and sank back without standing */
  partials: number;
};

/* the hips' height between ankles and shoulders: higher standing */
export function hipRatio(frame: PoseFrame): number | null {
  const p = frame.landmarks;
  if (!p) return null;
  const seen = [J.leftShoulder, J.rightShoulder, J.leftHip, J.rightHip, J.leftAnkle, J.rightAnkle].every((i) => (p[i].visibility ?? 1) > 0.5);
  if (!seen) return null;
  const shoulder = mid(p[J.leftShoulder], p[J.rightShoulder]).y;
  const hip = mid(p[J.leftHip], p[J.rightHip]).y;
  const ankle = mid(p[J.leftAnkle], p[J.rightAnkle]).y;
  const span = ankle - shoulder;
  if (span <= 0.05) return null;
  return (ankle - hip) / span;
}

export function createChairRise() {
  let state: ChairRiseState = { phase: "finding", reps: 0, baseline: null, rise: 1, standTimes: [], riseMs: [], partials: 0 };
  /* while seated: when the hips left the seat, and how high they got */
  let left: number | null = null;
  let peak = 1;
  let start: number | null = null;
  let calStart: number | null = null;
  let calSum = 0;
  let calN = 0;

  return {
    get state() {
      return state;
    },
    update(frame: PoseFrame): ChairRiseState {
      if (start === null) start = frame.t;
      const h = hipRatio(frame);
      if (h === null) {
        /* nobody in frame: hold the count, wait to find them again */
        if (state.baseline === null) state = { ...state, phase: "finding" };
        return state;
      }
      if (state.baseline === null) {
        if (calStart === null) calStart = frame.t;
        calSum += h;
        calN += 1;
        if (frame.t - calStart >= CALIBRATION_MS) {
          state = { ...state, phase: "seated", baseline: calSum / calN, rise: 1 };
        } else {
          state = { ...state, phase: "calibrating" };
        }
        return state;
      }

      const rise = h / state.baseline;
      if (state.phase === "seated") {
        if (rise > LEAVE) {
          left ??= frame.t;
          peak = Math.max(peak, rise);
        } else {
          if (peak > ATTEMPT) state = { ...state, partials: state.partials + 1 };
          left = null;
          peak = 1;
        }
      }
      if (state.phase === "seated" && rise > STAND) {
        const took = frame.t - (left ?? frame.t);
        left = null;
        peak = 1;
        state = { ...state, phase: "standing", reps: state.reps + 1, standTimes: [...state.standTimes, frame.t - start], riseMs: [...state.riseMs, took], rise };
      } else if (state.phase === "standing" && rise < SIT) {
        state = { ...state, phase: "seated", rise };
      } else {
        state = { ...state, rise };
      }
      return state;
    },
  };
}
