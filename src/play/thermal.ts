import { dist, mid } from "./geometry";
import { BONES, GLOW_JOINTS, H, HAND_BONES, HAND_GLOW, J, type Point, type PoseFrame } from "./pose";

/* ══ The thermal view ════════════════════════════════════
   The participant as a heat camera would show them, if heat were
   movement: the room and the body cold, and each joint glowing in
   proportion to how fast it is moving right now, cooling as it
   slows. It is drawn mirrored, as people expect to see themselves.

   ── LAYERS ──────────────────────────────────────────────
   The video, desaturated and sunk into night, so the room reads as
   cold. The body as a soft blur of cool blue. Then the heat: a
   round glow per joint, blended with "screen" so glows that overlap
   pool brighter, the way the logo's strokes fuse, without adding up
   to white when the whole body moves at once, as it does standing.
   Last, the tracked skeleton, faint, on top.

   A hand is drawn the same way, scaled to the hand: its bones cool,
   its fingertips glowing as they move. */

/* the system's heat ramp, still (0) to moving most (1) */
const RAMP: [number, number, number][] = [
  [12, 44, 150],
  [40, 120, 245],
  [120, 215, 255],
  [255, 228, 100],
  [255, 150, 40],
  [255, 50, 60],
  [255, 90, 190],
];
export function heatRgb(t: number): [number, number, number] {
  const x = Math.min(0.9999, Math.max(0, t)) * (RAMP.length - 1);
  const i = Math.floor(x), f = x - i;
  const a = RAMP[i], b = RAMP[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
const rgba = ([r, g, b]: [number, number, number], a: number) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;

/* joint speed, in shoulder widths a second, that reads as full heat:
   about a brisk stand from a chair, so a joint doing real work glows
   orange and red, and a fidget only blue */
const FULL = 1.1;
/* and the speed below which a joint is still. Landmarks jitter a
   little from frame to frame even on a motionless body; without a
   floor, standing still would glow as if working */
const NOISE = 0.3;

export function createThermal() {
  const speed = new Map<number, number>();
  /* each joint's position, smoothed, so jitter isn't read as speed */
  const smooth = new Map<number, Point>();
  let prevT: number | null = null;

  /* how warm each joint is: the speed of its smoothed position, eased
     so heat builds and cools over a fraction of a second rather than
     flickering */
  const warm = (p: Point[], joints: number[], scale: number, t: number, aspect: number) => {
    const dt = prevT === null ? 0 : (t - prevT) / 1000;
    for (const j of joints) {
      const was = smooth.get(j);
      const now = was ? { x: was.x + (p[j].x - was.x) * 0.4, y: was.y + (p[j].y - was.y) * 0.4 } : { x: p[j].x, y: p[j].y };
      smooth.set(j, now);
      const v = was && dt > 0 ? dist(now, was, aspect) / scale / dt : 0;
      const old = speed.get(j) ?? 0;
      const k = v > old ? 0.35 : 0.08;
      speed.set(j, old + (Math.min(v, FULL * 1.5) - old) * k);
    }
    prevT = t;
  };

  const heatOf = (j: number) => Math.min(1, Math.max(0, ((speed.get(j) ?? 0) - NOISE) / (FULL - NOISE)));

  function draw(ctx: CanvasRenderingContext2D, frame: PoseFrame | null, video: HTMLVideoElement | null) {
    const { width: W, height: H } = ctx.canvas;
    const box = fit(W, H, frame?.aspect ?? ((video && video.videoWidth / video.videoHeight) || 16 / 9));
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    /* the room, cold */
    ctx.fillStyle = "#0a1233";
    ctx.fillRect(0, 0, W, H);
    if (video && video.readyState >= 2) {
      ctx.save();
      ctx.translate(box.x + box.w, box.y);
      ctx.scale(-1, 1);
      ctx.globalAlpha = 0.55;
      ctx.drawImage(video, 0, 0, box.w, box.h);
      ctx.restore();
      ctx.globalCompositeOperation = "saturation";
      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "#2a3a7a";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
    } else {
      /* no camera: a faint sensor grid stands in for the room */
      ctx.strokeStyle = "rgba(58,70,128,0.35)";
      ctx.lineWidth = 1;
      const step = Math.round(W / 40);
      for (let x = 0; x < W; x += step) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(W, y + 0.5);
        ctx.stroke();
      }
    }

    if (frame?.landmarks) {
      const p = frame.landmarks;
      warm(p, GLOW_JOINTS, dist(p[J.leftShoulder], p[J.rightShoulder], frame.aspect) || 0.1, frame.t, frame.aspect);
      const at = (pt: Point) => toCanvas(pt, box);
      const shoulderPx = dist(p[J.leftShoulder], p[J.rightShoulder], frame.aspect) * box.h;

      /* the body's own heat: cool and soft */
      ctx.save();
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(40,120,245,0.38)";
      ctx.lineWidth = shoulderPx * 0.42;
      ctx.shadowColor = "rgba(40,120,245,0.6)";
      ctx.shadowBlur = shoulderPx * 0.35;
      for (const [a, b] of BONES) {
        const [x1, y1] = at(p[a]);
        const [x2, y2] = at(p[b]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      const torso = at(mid(mid(p[J.leftShoulder], p[J.rightShoulder]), mid(p[J.leftHip], p[J.rightHip])));
      ctx.fillStyle = "rgba(12,44,150,0.45)";
      ctx.beginPath();
      ctx.ellipse(torso[0], torso[1], shoulderPx * 0.5, shoulderPx * 0.95, 0, 0, Math.PI * 2);
      ctx.fill();
      const [hx, hy] = at(p[J.nose]);
      ctx.beginPath();
      ctx.arc(hx, hy, shoulderPx * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      /* the heat of movement, pooling where joints are close */
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (const j of GLOW_JOINTS) {
        const h = heatOf(j);
        if (h < 0.08) continue;
        const [x, y] = at(p[j]);
        const r = shoulderPx * (0.2 + h * 0.36);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        /* faint heat stays faint: adding glows together over the blue
           body would otherwise wash a barely-moving joint to white */
        g.addColorStop(0, rgba(heatRgb(h), 0.8 * h ** 1.2));
        g.addColorStop(0.45, rgba(heatRgb(h * 0.8), 0.4 * h ** 1.2));
        g.addColorStop(1, rgba(heatRgb(0.15), 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      /* what the camera tracks, faint, on top */
      ctx.strokeStyle = "rgba(233,237,251,0.45)";
      ctx.lineWidth = Math.max(1.5, shoulderPx * 0.012);
      for (const [a, b] of BONES) {
        const [x1, y1] = at(p[a]);
        const [x2, y2] = at(p[b]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(233,237,251,0.85)";
      for (const j of GLOW_JOINTS) {
        const [x, y] = at(p[j]);
        ctx.beginPath();
        ctx.arc(x, y, Math.max(2.5, shoulderPx * 0.022), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (frame?.hand) {
      drawHand(ctx, frame.hand, frame, box);
    }
    ctx.restore();
  }

  function drawHand(ctx: CanvasRenderingContext2D, p: Point[], frame: PoseFrame, box: Fit) {
    const at = (pt: Point) => toCanvas(pt, box);
    const size = dist(p[H.wrist], p[H.middleMcp], frame.aspect) || 0.1;
    /* fingers move fast against a hand's length; a third as sensitive
       as the body keeps a brisk tap orange rather than every twitch */
    warm(p, HAND_GLOW, size * 3, frame.t, frame.aspect);
    const handPx = size * box.h;

    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(40,120,245,0.4)";
    ctx.lineWidth = handPx * 0.2;
    ctx.shadowColor = "rgba(40,120,245,0.6)";
    ctx.shadowBlur = handPx * 0.2;
    for (const [a, b] of HAND_BONES) {
      const [x1, y1] = at(p[a]);
      const [x2, y2] = at(p[b]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    const palm = at(mid(p[H.wrist], p[H.middleMcp]));
    ctx.fillStyle = "rgba(12,44,150,0.45)";
    ctx.beginPath();
    ctx.ellipse(palm[0], palm[1], handPx * 0.42, handPx * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const j of HAND_GLOW) {
      const h = heatOf(j);
      if (h < 0.08) continue;
      const [x, y] = at(p[j]);
      const r = handPx * (0.14 + h * 0.26);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(heatRgb(h), 0.8 * h ** 1.2));
      g.addColorStop(0.45, rgba(heatRgb(h * 0.8), 0.4 * h ** 1.2));
      g.addColorStop(1, rgba(heatRgb(0.15), 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.strokeStyle = "rgba(233,237,251,0.45)";
    ctx.lineWidth = Math.max(1.5, handPx * 0.012);
    for (const [a, b] of HAND_BONES) {
      const [x1, y1] = at(p[a]);
      const [x2, y2] = at(p[b]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(233,237,251,0.85)";
    for (let j = 0; j < p.length; j++) {
      const [x, y] = at(p[j]);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2, handPx * 0.018), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return { draw };
}

/* Where the camera's picture sits on the canvas: as large as fits,
   at its own shape, centred. Stretching a wide camera picture into a
   tall phone screen would squeeze the body, and a target that looks
   in reach would not be. */
export type Fit = { x: number; y: number; w: number; h: number };
export function fit(W: number, H: number, aspect: number): Fit {
  return W / H > aspect ? { w: H * aspect, h: H, x: (W - H * aspect) / 2, y: 0 } : { w: W, h: W / aspect, x: 0, y: (H - W / aspect) / 2 };
}

/* a point in the camera's normalised view, to pixels on the mirrored canvas */
export const toCanvas = (pt: Point, f: Fit) => [f.x + (1 - pt.x) * f.w, f.y + pt.y * f.h] as const;
