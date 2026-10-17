import type { Point } from "./pose";

/* Distances are measured with x stretched by the video's aspect, so
   a unit across means the same length as a unit down. */

export const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export const dist = (a: Point, b: Point, aspect = 1) => Math.hypot((a.x - b.x) * aspect, a.y - b.y);

/* the angle at b, between the rays to a and to c, in degrees */
export function angleAt(a: Point, b: Point, c: Point, aspect = 1) {
  const ux = (a.x - b.x) * aspect, uy = a.y - b.y;
  const vx = (c.x - b.x) * aspect, vy = c.y - b.y;
  const n = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  if (n === 0) return 0;
  const cos = Math.min(1, Math.max(-1, (ux * vx + uy * vy) / n));
  return (Math.acos(cos) * 180) / Math.PI;
}

/* How far an arm is raised out to the side: the angle between the
   trunk's midline, pointing down (mid-shoulder to mid-hip), and the
   arm, from its shoulder to its wrist. 0 is the arm hanging, 90 level
   with the shoulder, 180 straight up. A goniometer reads abduction
   against the trunk's midline too; the line to the hip on the same
   side would lean in, because hips are narrower than shoulders. */
export function abduction(shoulder: Point, wrist: Point, midShoulder: Point, midHip: Point, aspect = 1) {
  const down = { x: shoulder.x + (midHip.x - midShoulder.x), y: shoulder.y + (midHip.y - midShoulder.y) };
  return angleAt(down, shoulder, wrist, aspect);
}

/* where an arm of the given length would put the wrist, raised to
   `deg` of abduction, for the participant's left or right arm in the
   camera's unmirrored view (their left appears on the image's right) */
export function reachPoint(shoulder: Point, side: "left" | "right", deg: number, armLength: number, aspect = 1): Point {
  const r = (deg * Math.PI) / 180;
  const sx = side === "left" ? 1 : -1;
  return { x: shoulder.x + (sx * Math.sin(r) * armLength) / aspect, y: shoulder.y + Math.cos(r) * armLength };
}
