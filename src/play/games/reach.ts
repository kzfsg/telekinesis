import { abduction, dist, mid, reachPoint } from "../geometry";
import { J, type Point, type PoseFrame } from "../pose";

/* Reach, after a range-of-motion exam: targets appear at the edge of
   the participant's reach, one arm at a time, a little higher each
   round. Touching a target with the wrist pops it. The measure is the
   highest each shoulder lifts its arm out to the side (abduction),
   which the game tracks the whole time, not only at the targets.

   Targets sit at a given angle and at the participant's own arm
   length from the shoulder, so they land within reach whatever the
   participant's size or distance from the camera. */

export type Side = "left" | "right";
export type Target = { side: Side; deg: number };

export const TARGETS: Target[] = [
  { side: "left", deg: 90 },
  { side: "right", deg: 90 },
  { side: "left", deg: 120 },
  { side: "right", deg: 120 },
  { side: "left", deg: 150 },
  { side: "right", deg: 150 },
  { side: "left", deg: 170 },
  { side: "right", deg: 170 },
];

/* how close the wrist must come, as a share of the arm's length */
export const HIT = 0.22;

export type ReachState = {
  index: number;
  hits: number;
  done: boolean;
  /* where the current target is in the frame, if the body is seen */
  target: (Target & { at: Point }) | null;
  /* the highest abduction seen for each arm so far */
  best: Record<Side, number>;
  /* the current abduction of each arm */
  now: Record<Side, number> | null;
};

const ARM: Record<Side, [number, number, number]> = {
  left: [J.leftShoulder, J.leftElbow, J.leftWrist],
  right: [J.rightShoulder, J.rightElbow, J.rightWrist],
};

export function createReach(targets: Target[] = TARGETS) {
  let state: ReachState = { index: 0, hits: 0, done: false, target: null, best: { left: 0, right: 0 }, now: null };

  return {
    get state() {
      return state;
    },
    update(frame: PoseFrame): ReachState {
      const p = frame.landmarks;
      const needed = [J.leftShoulder, J.rightShoulder, J.leftHip, J.rightHip, J.leftWrist, J.rightWrist, J.leftElbow, J.rightElbow];
      if (!p || !needed.every((i) => (p[i].visibility ?? 1) > 0.5)) {
        state = { ...state, target: null, now: null };
        return state;
      }
      const a = frame.aspect;
      const ms = mid(p[J.leftShoulder], p[J.rightShoulder]);
      const mh = mid(p[J.leftHip], p[J.rightHip]);
      const angle = (side: Side) => abduction(p[ARM[side][0]], p[ARM[side][2]], ms, mh, a);
      const now = { left: angle("left"), right: angle("right") };
      const best = { left: Math.max(state.best.left, now.left), right: Math.max(state.best.right, now.right) };

      if (state.done) {
        state = { ...state, best, now };
        return state;
      }
      const t = targets[state.index];
      const [s, e, w] = ARM[t.side];
      const arm = dist(p[s], p[e], a) + dist(p[e], p[w], a);
      const at = reachPoint(p[s], t.side, t.deg, arm, a);
      if (dist(p[w], at, a) < arm * HIT) {
        const index = state.index + 1;
        const done = index >= targets.length;
        const next = done ? null : targets[index];
        const [ns, ne, nw] = next ? ARM[next.side] : [s, e, w];
        const nextArm = dist(p[ns], p[ne], a) + dist(p[ne], p[nw], a);
        state = {
          index,
          hits: state.hits + 1,
          done,
          target: next ? { ...next, at: reachPoint(p[ns], next.side, next.deg, nextArm, a) } : null,
          best,
          now,
        };
      } else {
        state = { ...state, target: { ...t, at }, best, now };
      }
      return state;
    },
  };
}
