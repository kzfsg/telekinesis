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
  /* an offset added to the right wrist, for tremor */
  wobble?: { x: number; y: number };
  /* the video's width over its height */
  aspect?: number;
};

const ARM = 0.25;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function makeBody({ rise = 1, leftArm = 8, rightArm = 8, wobble, aspect = 16 / 9 }: Posture = {}): Point[] {
  const cx = 0.5;
  /* heights down the frame, seated to standing; the ankles stay put */
  const y = {
    nose: lerp(0.32, 0.18, rise),
    shoulder: lerp(0.44, 0.3, rise),
    hip: lerp(0.7, 0.56, rise),
    knee: lerp(0.68, 0.74, rise),
    ankle: 0.92,
  };
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
  arm(ls, "left", leftArm, J.leftElbow, J.leftWrist);
  arm(rs, "right", rightArm, J.rightElbow, J.rightWrist);
  if (wobble) {
    pts[J.rightWrist] = { ...pts[J.rightWrist], x: pts[J.rightWrist].x + wobble.x / aspect, y: pts[J.rightWrist].y + wobble.y };
  }
  return pts;
}

/* the arm length the builder uses, for tests that need it */
export const BODY_ARM = ARM;
