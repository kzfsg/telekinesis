import { reachPoint } from "./geometry";
import { J, type Point } from "./pose";

/* A body, built to order: where a front-facing camera would see each
   landmark for a given posture. The simulated participant moves this
   body through each game, and the tests feed it to the games, so the
   demo and the tests exercise the same shapes. */

export type Posture = {
  /* 0 seated on the chair, 1 standing tall */
  rise?: number;
  /* each arm's abduction in degrees: 0 hanging, 90 out level, 180 up */
  leftArm?: number;
  rightArm?: number;
  /* arms crossed over the chest, as the chair stand asks; overrides
     the arm angles */
  crossed?: boolean;
  /* for rising from the floor, overriding `rise`: 0 sitting on the
     floor, 0.5 crouched halfway up, 1 standing tall */
  floor?: number;
  /* where the hands are, overriding the arm angles: pressed on the
     thighs, as in a Gowers' manoeuvre, or flat on the floor */
  hands?: "thighs" | "floor";
  /* shifts the whole body across and down the frame, as a camera
     knocked or a participant drifting would */
  shift?: { x: number; y: number };
  /* the video's width over its height */
  aspect?: number;
};

const ARM = 0.25;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* floor to standing, by way of a crouch: nose, shoulder, hip, knee */
const FLOOR = [0.6, 0.7, 0.9, 0.86];
const CROUCH = [0.48, 0.58, 0.74, 0.82];
const TALL = [0.18, 0.3, 0.56, 0.74];

export function makeBody({ rise = 1, floor, hands, leftArm = 8, rightArm = 8, crossed = false, shift, aspect = 16 / 9 }: Posture = {}): Point[] {
  const cx = 0.5;
  /* heights down the frame, seated to standing; the ankles stay put */
  const y =
    floor === undefined
      ? {
          nose: lerp(0.32, 0.18, rise),
          shoulder: lerp(0.44, 0.3, rise),
          hip: lerp(0.7, 0.56, rise),
          knee: lerp(0.68, 0.74, rise),
          ankle: 0.92,
        }
      : (() => {
          const [a, b, f] = floor < 0.5 ? [FLOOR, CROUCH, floor * 2] : [CROUCH, TALL, floor * 2 - 1];
          const at = (i: number) => lerp(a[i], b[i], f);
          return { nose: at(0), shoulder: at(1), hip: at(2), knee: at(3), ankle: 0.92 };
        })();
  /* half-widths, in square units, turned into the video's x units */
  const w = (half: number) => half / aspect;
  const pts: Point[] = Array.from({ length: 33 }, () => ({ x: cx, y: y.shoulder, visibility: 0.2 }));
  const put = (i: number, x: number, yy: number) => (pts[i] = { x, y: yy, visibility: 0.98 });

  /* the participant's left appears on the image's right */
  put(J.nose, cx, y.nose);
  const ls = { x: cx + w(0.09), y: y.shoulder };
  const rs = { x: cx - w(0.09), y: y.shoulder };
  put(J.leftShoulder, ls.x, ls.y);
  put(J.rightShoulder, rs.x, rs.y);
  put(J.leftHip, cx + w(0.06), y.hip);
  put(J.rightHip, cx - w(0.06), y.hip);
  put(J.leftKnee, cx + w(0.07), y.knee);
  put(J.rightKnee, cx - w(0.07), y.knee);
  put(J.leftAnkle, cx + w(0.07), y.ankle);
  put(J.rightAnkle, cx - w(0.07), y.ankle);

  const arm = (s: Point, side: "left" | "right", deg: number, elbow: number, wrist: number) => {
    const e = reachPoint(s, side, deg, ARM * 0.52, aspect);
    const h = reachPoint(s, side, deg, ARM, aspect);
    put(elbow, e.x, e.y);
    put(wrist, h.x, h.y);
  };
  if (hands) {
    /* palms on the front of the thighs, or on the floor by the feet */
    const hy = hands === "thighs" ? (y.hip + y.knee) / 2 : y.ankle - 0.01;
    const hx = hands === "thighs" ? w(0.065) : w(0.16);
    put(J.leftWrist, cx + hx, hy);
    put(J.rightWrist, cx - hx, hy);
    put(J.leftElbow, cx + w(0.13), (y.shoulder + hy) / 2);
    put(J.rightElbow, cx - w(0.13), (y.shoulder + hy) / 2);
  } else if (crossed) {
    /* each hand on the other shoulder, elbows low and in front */
    put(J.leftElbow, cx + w(0.07), y.shoulder + 0.11);
    put(J.rightElbow, cx - w(0.07), y.shoulder + 0.11);
    put(J.leftWrist, cx - w(0.06), y.shoulder + 0.03);
    put(J.rightWrist, cx + w(0.06), y.shoulder + 0.03);
  } else {
    arm(ls, "left", leftArm, J.leftElbow, J.leftWrist);
    arm(rs, "right", rightArm, J.rightElbow, J.rightWrist);
  }
  return shift ? pts.map((p) => ({ ...p, x: p.x + shift.x, y: p.y + shift.y })) : pts;
}

export type HandPose = {
  /* the gap between thumb tip and index tip, in hand lengths
     (wrist to middle knuckle): 0 pinched, about 1 wide open */
  opening?: number;
  /* where the wrist sits in the frame, and the hand's length as a
     share of the frame's height */
  at?: { x: number; y: number };
  size?: number;
  aspect?: number;
};

/* A hand, held up with the palm to the camera, thumb and index free
   and the other fingers curled: the 21 points MediaPipe Hand reports,
   placed so the thumb-to-index gap is exactly `opening`. */
export function makeHand({ opening = 0.8, at = { x: 0.5, y: 0.72 }, size = 0.22, aspect = 16 / 9 }: HandPose = {}): Point[] {
  /* in hand lengths, x across and y down, from the wrist */
  const P = (x: number, y: number): Point => ({ x: at.x + (x * size) / aspect, y: at.y + y * size, visibility: 0.98 });
  const lerp2 = (a: [number, number], b: [number, number], t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  /* the thumb and index meet around here, along a slight lean */
  const c: [number, number] = [-0.5, -1.05];
  const d = Math.hypot(0.25, 1);
  const dir: [number, number] = [0.25 / d, -1 / d];
  const index: [number, number] = [c[0] + (dir[0] * opening) / 2, c[1] + (dir[1] * opening) / 2];
  const thumb: [number, number] = [c[0] - (dir[0] * opening) / 2, c[1] - (dir[1] * opening) / 2];
  const thumbBase: [number, number] = [-0.22, -0.22];
  const indexBase: [number, number] = [-0.26, -0.95];
  const curled = (mcp: [number, number]) => [P(mcp[0], mcp[1]), P(mcp[0], mcp[1] - 0.22), P(mcp[0], mcp[1] - 0.16), P(mcp[0], mcp[1] - 0.04)];
  return [
    P(0, 0),
    P(...thumbBase),
    P(...lerp2(thumbBase, thumb, 0.4)),
    P(...lerp2(thumbBase, thumb, 0.72)),
    P(...thumb),
    P(...indexBase),
    P(...lerp2(indexBase, index, 0.45)),
    P(...lerp2(indexBase, index, 0.75)),
    P(...index),
    ...curled([0, -1]),
    ...curled([0.22, -0.94]),
    ...curled([0.4, -0.82]),
  ];
}

/* the arm length the builder uses, for tests that need it */
export const BODY_ARM = ARM;
