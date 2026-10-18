import { dist, mid } from "./geometry";
import { createChairRise, STAND } from "./games/chairRise";
import { createReach, TARGETS } from "./games/reach";
import { createTap, opening as tapOpening, summarise, TAP_MS, type Tap } from "./games/tap";
import { H, J, type Point, type PoseFrame } from "./pose";
import { createQuality, type Check } from "./quality";
import type { SessionRecord } from "./session";
import type { GameId } from "./simulated";
import { fit, heatRgb, toCanvas } from "./thermal";

/* Each game, wrapped for the screen: what to tell the participant
   right now, the numbers to show, anything to draw over the camera,
   and, once it's over, the record to keep. The games themselves only
   measure; these decide what the participant sees. */

export type Hud = {
  instruction: string;
  /* the one big number, and what it counts */
  big: string;
  bigLabel: string;
  /* small live readings */
  readouts: { label: string; value: string; unit?: string }[];
  /* 0..1, for a bar: time left, or how far through */
  progress: number | null;
  progressLabel?: string;
  /* 0..1 warmth for the meter beside the number */
  meter: number | null;
  meterLabel?: string;
  /* a recording problem to fix now, if there is one */
  alert?: string | null;
};

export type Controller = {
  update(frame: PoseFrame | null, now: number): Hud;
  overlay(ctx: CanvasRenderingContext2D, now: number): void;
  readonly done: boolean;
  record(demo: boolean): SessionRecord;
};

export type GameInfo = {
  name: string;
  /* the condition the game was built for, if one */
  condition?: string;
  mirrors: string;
  setup: string;
  measures: string;
  /* what the camera has to track */
  tracking: "pose" | "hand";
};

export const GAMES: Record<GameId, GameInfo> = {
  "chair-rise": {
    name: "Rise",
    condition: "Duchenne muscular dystrophy",
    mirrors: "30-second chair stand test",
    setup: "A sturdy chair without wheels, placed so the camera sees you from head to feet. Arms crossed over your chest.",
    measures: "Full stands, failed attempts, and whether the recording can be trusted",
    tracking: "pose",
  },
  reach: {
    name: "Reach",
    mirrors: "Range-of-motion exam",
    setup: "Stand facing the camera with room to lift both arms out to the side.",
    measures: "How high each shoulder lifts its arm",
    tracking: "pose",
  },
  tap: {
    name: "Tap",
    condition: "Parkinson's disease",
    mirrors: "Finger-tapping item of a motor exam",
    setup: "Sit facing the camera. Rest your elbow on a table and hold one hand up, palm toward the screen.",
    measures: "Tapping speed, rhythm, and whether the taps fade",
    tracking: "hand",
  },
};

const rgb = (t: number, a: number) => {
  const [r, g, b] = heatRgb(t);
  return `rgba(${r | 0},${g | 0},${b | 0},${a})`;
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const seen = (p: Point) => (p.visibility ?? 1) > 0.5;
const inside = (p: Point) => p.x > 0.01 && p.x < 0.99 && p.y > 0.01 && p.y < 0.99;

/* ══ Rise ═════════════════════════════════════════════════
   The count is the chair stand's. On screen, a cold ring hangs over
   the participant's head and an ember sits on their shoulders; as
   the hips rise, the ember climbs toward the ring, warming, and a
   full stand bursts it. The ember is driven by the same signal the
   count is, so the ring breaks exactly when a stand counts, never
   because a head happened to reach a drawing. Each stand leaves a
   mark in the tally down the side, hotter the quicker the stand;
   a rise that sank back leaves a hollow one. */

const CHAIR_S = 30;

function riseChecks(): Check[] {
  let feet: Point | null = null;
  return [
    {
      id: "in-view",
      label: "Head and feet in view",
      fix: "Step back so your head and feet both show.",
      need: 0.9,
      test: (f) => {
        const p = f.landmarks;
        if (!p) return null;
        return [J.nose, J.leftAnkle, J.rightAnkle].every((i) => seen(p[i]) && inside(p[i]));
      },
    },
    {
      id: "close",
      label: "Close enough to measure",
      fix: "Move the camera a little closer.",
      need: 0.8,
      test: (f) => {
        const p = f.landmarks;
        if (!p || !seen(p[J.nose]) || !seen(p[J.leftAnkle])) return null;
        return mid(p[J.leftAnkle], p[J.rightAnkle]).y - p[J.nose].y > 0.42;
      },
    },
    {
      id: "light",
      label: "Clear enough to track",
      fix: "Turn on a light, or face a window.",
      need: 0.8,
      test: (f) => {
        const p = f.landmarks;
        if (!p) return null;
        const joints = [J.leftShoulder, J.rightShoulder, J.leftHip, J.rightHip, J.leftKnee, J.rightKnee, J.leftAnkle, J.rightAnkle];
        return joints.reduce((a, i) => a + (p[i].visibility ?? 1), 0) / joints.length > 0.75;
      },
    },
    {
      /* the feet stay put through a chair stand; when they move in the
         picture, the camera was knocked or the chair was moved */
      id: "steady",
      label: "Camera and chair stayed put",
      fix: "Keep the camera still, and your feet where they started.",
      need: 0.9,
      test: (f) => {
        const p = f.landmarks;
        if (!p || !seen(p[J.leftAnkle]) || !seen(p[J.rightAnkle])) return null;
        const at = mid(p[J.leftAnkle], p[J.rightAnkle]);
        feet ??= at;
        const span = Math.max(0.1, at.y - mid(p[J.leftShoulder], p[J.rightShoulder]).y);
        return dist(at, feet, f.aspect) < span * 0.12;
      },
    },
    {
      /* hands pushing on the knees or the chair make a stand easier;
         the test asks for them crossed over the chest */
      id: "arms",
      label: "Arms crossed over the chest",
      fix: "Keep your arms crossed over your chest.",
      need: 0.8,
      test: (f) => {
        const p = f.landmarks;
        if (!p || ![J.leftWrist, J.rightWrist, J.leftShoulder, J.rightShoulder, J.leftHip].every((i) => seen(p[i]))) return null;
        const top = Math.min(p[J.leftShoulder].y, p[J.rightShoulder].y) - 0.04;
        const bottom = mid(p[J.leftShoulder], p[J.rightShoulder]).y + (mid(p[J.leftHip], p[J.rightHip]).y - mid(p[J.leftShoulder], p[J.rightShoulder]).y) * 0.6;
        const half = Math.abs(p[J.leftShoulder].x - p[J.rightShoulder].x) * 0.75;
        const cx = mid(p[J.leftShoulder], p[J.rightShoulder]).x;
        return [J.leftWrist, J.rightWrist].every((i) => p[i].y > top && p[i].y < bottom && Math.abs(p[i].x - cx) < half);
      },
    },
  ];
}

function chairRise(): Controller {
  const game = createChairRise();
  const quality = createQuality(riseChecks(), 15);
  let go: number | null = null;
  let end: number | null = null;
  /* stands, timed from the moment the 30 seconds started */
  const stands: number[] = [];
  /* the tally: each full stand's quickness, or a partial */
  const marks: ({ kind: "stand"; ms: number } | { kind: "partial" })[] = [];
  let partials = 0;
  let body: Point[] | null = null;
  let aspect = 16 / 9;
  /* where the ring hangs: fixed when seated is first measured */
  let ring: { y: number; gap: number } | null = null;
  let popAt = -Infinity;
  let popPos: Point | null = null;
  return {
    get done() {
      return end !== null;
    },
    update(frame, now) {
      /* the count stops with the clock: once time is up, the game
         stops reading frames, so a stand during the closing pause
         can't be added to a 30-second score */
      if (go !== null && end === null && now - go >= CHAIR_S * 1000) end = go + CHAIR_S * 1000;
      if (end === null) quality.update(frame);
      if (frame?.landmarks) {
        body = frame.landmarks;
        aspect = frame.aspect;
      }
      const before = game.state.reps;
      const s = frame && end === null ? game.update(frame) : game.state;
      if (go === null && s.baseline !== null) go = now;
      if (ring === null && s.baseline !== null && body) {
        const nose = body[J.nose].y;
        const ankle = mid(body[J.leftAnkle], body[J.rightAnkle]).y;
        ring = { y: nose - (ankle - nose) * 0.28, gap: (ankle - nose) * 0.28 };
      }
      if (go !== null && s.reps > before) {
        stands.push(Math.round((now - go) / 100) / 10);
        marks.push({ kind: "stand", ms: s.riseMs[s.riseMs.length - 1] });
        popAt = now;
        popPos = body ? { x: body[J.nose].x, y: ring?.y ?? body[J.nose].y } : null;
      }
      while (partials < s.partials) {
        partials += 1;
        marks.push({ kind: "partial" });
      }
      const left = go === null ? CHAIR_S : Math.max(0, CHAIR_S - (now - go) / 1000);
      const instruction =
        s.phase === "finding"
          ? "Step back until the camera sees you head to feet, then sit on the chair."
          : s.phase === "calibrating"
            ? "Sit still, arms crossed over your chest."
            : end !== null
              ? "Time. Well done."
              : s.phase === "seated"
                ? "Stand all the way up. Break the ring."
                : "Now sit back down.";
      return {
        instruction,
        big: String(s.reps),
        bigLabel: s.reps === 1 ? "rise" : "rises",
        /* no knee angle here: from the front, a knee points at the
           camera and its angle can't be read honestly */
        readouts: [
          { label: "Left", value: `0:${String(Math.ceil(left)).padStart(2, "0")}` },
          { label: "Fell short", value: String(s.partials) },
        ],
        progress: go === null ? null : 1 - left / CHAIR_S,
        progressLabel: "Time",
        meter: s.baseline === null ? null : clamp01((s.rise - 1) / (STAND - 1)),
        meterLabel: "Rise",
        alert: s.phase === "finding" || end !== null ? null : quality.live(),
      };
    },
    overlay(ctx, now) {
      const s = game.state;
      const box = fit(ctx.canvas.width, ctx.canvas.height, aspect);
      const H = box.h;
      if (body && ring && s.baseline !== null && end === null) {
        const headX = body[J.nose].x;
        const [rx, ry] = toCanvas({ x: headX, y: ring.y }, box);
        const r = H * 0.06;
        const p = clamp01((s.rise - 1) / (STAND - 1));
        const standing = s.phase === "standing";
        /* the ring: cold and steady when ready, gone while standing */
        if (!standing) {
          const breathe = 1 + 0.05 * Math.sin(now / 260);
          ctx.strokeStyle = rgb(0.25 + p * 0.5, 0.55 + p * 0.4);
          ctx.lineWidth = Math.max(3, H * 0.007);
          ctx.setLineDash([H * 0.018, H * 0.012]);
          ctx.lineDashOffset = -now / 40;
          ctx.beginPath();
          ctx.ellipse(rx, ry, r * 1.6 * breathe, r * 0.5 * breathe, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        /* the ember: from the shoulders to the ring, by how far up the hips are */
        const [, sy] = toCanvas({ x: headX, y: mid(body[J.leftShoulder], body[J.rightShoulder]).y - 0.02 }, box);
        const ey = standing ? ry : sy + (ry - sy) * p;
        const er = H * (0.02 + 0.02 * p);
        const g = ctx.createRadialGradient(rx, ey, 0, rx, ey, er * 3);
        g.addColorStop(0, rgb(0.35 + p * 0.6, 0.95));
        g.addColorStop(0.35, rgb(0.3 + p * 0.55, 0.5));
        g.addColorStop(1, rgb(0.2, 0));
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(rx, ey, er * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      /* the burst: shards flung outward from where the ring broke */
      const since = now - popAt;
      if (popPos && since < 700) {
        const [x, y] = toCanvas(popPos, box);
        const u = since / 700;
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2 + i;
          const d = H * (0.05 + u * 0.22);
          ctx.fillStyle = rgb(0.95 - u * 0.4, 1 - u);
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * d * 1.6, y + Math.sin(a) * d * 0.7, H * 0.012 * (1 - u), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = `rgba(255,90,190,${1 - u})`;
        ctx.lineWidth = H * 0.008;
        ctx.beginPath();
        ctx.ellipse(x, y, H * 0.1 * (1 + u * 2), H * 0.03 * (1 + u * 2), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      /* the tally, down the left: a stand under a second is white-hot,
         one over three is barely warm */
      const x0 = ctx.canvas.width * 0.04;
      const step = Math.min(H * 0.05, (ctx.canvas.height * 0.7) / Math.max(12, marks.length));
      marks.forEach((m, i) => {
        const y = ctx.canvas.height * 0.82 - i * step;
        ctx.beginPath();
        ctx.arc(x0, y, step * 0.32, 0, Math.PI * 2);
        if (m.kind === "stand") {
          ctx.fillStyle = rgb(clamp01(1 - (m.ms - 700) / 2600) * 0.85 + 0.15, 0.95);
          ctx.fill();
        } else {
          ctx.strokeStyle = "rgba(233,237,251,0.6)";
          ctx.lineWidth = Math.max(2, step * 0.08);
          ctx.stroke();
        }
      });
    },
    record(demo) {
      const s = game.state;
      return {
        game: "chair-rise",
        at: new Date().toISOString(),
        duration_s: CHAIR_S,
        demo,
        measures: {
          rises: s.reps,
          partial_rises: s.partials,
          stand_times_s: stands,
          rise_durations_s: s.riseMs.map((ms) => Math.round(ms / 100) / 10),
        },
        quality: quality.flags(),
      };
    },
  };
}

const REACH_LIMIT_S = 60;

function reach(): Controller {
  const game = createReach();
  let aspect = 16 / 9;
  let first: number | null = null;
  let end: number | null = null;
  let popAt = -Infinity;
  let popPos: { x: number; y: number } | null = null;
  let hits = 0;
  return {
    get done() {
      return end !== null;
    },
    update(frame, now) {
      const before = game.state.target;
      if (frame) aspect = frame.aspect;
      const s = frame ? game.update(frame) : game.state;
      if (first === null && s.now) first = now;
      if (s.hits > hits) {
        hits = s.hits;
        popAt = now;
        popPos = before?.at ?? null;
      }
      const spent = first === null ? 0 : (now - first) / 1000;
      if (end === null && (s.done || spent >= REACH_LIMIT_S)) end = now;
      const t = s.target;
      const instruction = !s.now
        ? "Step back until the camera sees your arms and hips."
        : end !== null
          ? "That's the round. Well done."
          : t
            ? `Lift your ${t.side} arm out to the side and up to the light.`
            : "";
      return {
        instruction,
        big: String(s.hits),
        bigLabel: `of ${TARGETS.length} reached`,
        readouts: [
          { label: "Left best", value: String(Math.round(s.best.left)), unit: "°" },
          { label: "Right best", value: String(Math.round(s.best.right)), unit: "°" },
        ],
        progress: s.hits / TARGETS.length,
        progressLabel: "Targets",
        meter: null,
      };
    },
    overlay(ctx, now) {
      const t = game.state.target;
      const box = fit(ctx.canvas.width, ctx.canvas.height, aspect);
      const H = box.h;
      /* the target: a warm ring that breathes, hotter the higher it is */
      if (t && end === null) {
        const [x, y] = toCanvas(t.at, box);
        const r = H * 0.055 * (1 + 0.08 * Math.sin(now / 220));
        const [cr, cg, cb] = heatRgb(0.45 + (t.deg - 90) / 200);
        const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.8);
        g.addColorStop(0, `rgba(${cr | 0},${cg | 0},${cb | 0},0.75)`);
        g.addColorStop(1, `rgba(${cr | 0},${cg | 0},${cb | 0},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = Math.max(2, H * 0.004);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      /* a pop: a ring flung outward from where the last target was */
      const since = now - popAt;
      if (popPos && since < 450) {
        const [x, y] = toCanvas(popPos, box);
        ctx.strokeStyle = `rgba(255,90,190,${1 - since / 450})`;
        ctx.lineWidth = H * 0.008;
        ctx.beginPath();
        ctx.arc(x, y, H * 0.03 + since * 0.25, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
    record(demo) {
      const s = game.state;
      return {
        game: "reach",
        at: new Date().toISOString(),
        duration_s: first !== null && end !== null ? Math.round((end - first) / 100) / 10 : 0,
        demo,
        measures: {
          targets_reached: s.hits,
          left_abduction_deg: Math.round(s.best.left),
          right_abduction_deg: Math.round(s.best.right),
        },
      };
    },
  };
}

export function createController(id: GameId): Controller {
  return id === "chair-rise" ? chairRise() : id === "reach" ? reach() : tap();
}

/* ══ Tap ══════════════════════════════════════════════════
   A spark jumps between thumb and index, hotter the wider they part;
   each tap throws a ring from the fingertips, sized by how wide that
   tap opened, so taps that shrink are seen shrinking. Along the top,
   the ten seconds as a strip: a tick per tap, as tall as it opened,
   so the rhythm, and any stall or fade, is plain at a glance. */

function tapChecks(): Check[] {
  let wrist: Point | null = null;
  return [
    {
      id: "in-view",
      label: "Whole hand in view",
      fix: "Hold your hand up where the camera can see all of it.",
      need: 0.9,
      test: (f) => !!f.hand && f.hand.every(inside),
    },
    {
      id: "close",
      label: "Close enough to measure",
      fix: "Bring your hand a little closer to the camera.",
      need: 0.8,
      test: (f) => (f.hand ? dist(f.hand[H.wrist], f.hand[H.middleMcp], f.aspect) > 0.1 : null),
    },
    {
      /* the fingers should move, not the hand: a wandering wrist
         blurs the opening and suggests the elbow isn't resting */
      id: "steady",
      label: "Hand held in one place",
      fix: "Rest your elbow so your hand stays in one place.",
      need: 0.85,
      test: (f) => {
        const h = f.hand;
        if (!h) return null;
        const size = dist(h[H.wrist], h[H.middleMcp], f.aspect);
        wrist = wrist ? { x: wrist.x + (h[H.wrist].x - wrist.x) * 0.02, y: wrist.y + (h[H.wrist].y - wrist.y) * 0.02 } : h[H.wrist];
        return dist(h[H.wrist], wrist, f.aspect) < size * 0.5;
      },
    },
  ];
}

function tap(): Controller {
  const game = createTap();
  const quality = createQuality(tapChecks(), 20);
  let hand: Point[] | null = null;
  let aspect = 16 / 9;
  let end: number | null = null;
  let widest = 0.6;
  const rings: { at: number; pos: Point; amp: number }[] = [];
  let count = 0;
  /* the opening over time, for the strip */
  const trace: { t: number; o: number }[] = [];
  return {
    get done() {
      return end !== null;
    },
    update(frame, now) {
      if (end === null) quality.update(frame);
      hand = frame?.hand ?? (frame ? null : hand);
      if (frame) aspect = frame.aspect;
      const s = frame && end === null ? game.update(frame) : game.state;
      if (s.phase === "done" && end === null) end = now;
      if (s.opening !== null) {
        widest = Math.max(widest, s.opening);
        if (s.start !== null && end === null) trace.push({ t: s.now - s.start, o: s.opening });
      }
      while (count < s.taps.length) {
        const t = s.taps[count];
        count += 1;
        if (hand) rings.push({ at: now, pos: mid(hand[H.thumbTip], hand[H.indexTip]), amp: t.amp });
      }
      const recent = s.taps.slice(-6);
      const pace = recent.length > 2 ? ((recent.length - 1) * 1000) / (recent[recent.length - 1].t - recent[0].t) : null;
      const elapsed = s.start === null ? 0 : Math.min(TAP_MS, s.now - s.start);
      const left = (TAP_MS - elapsed) / 1000;
      const instruction =
        s.phase === "finding"
          ? "Hold one hand up to the camera, palm toward it."
          : s.phase === "ready"
            ? "Tap your index finger on your thumb, fast and wide."
            : s.phase === "done"
              ? "Time. Well done."
              : left < 3
                ? "Nearly there. Keep them wide."
                : "Keep going: as fast and as wide as you can.";
      return {
        instruction,
        big: String(s.taps.length),
        bigLabel: s.taps.length === 1 ? "tap" : "taps",
        readouts: [
          { label: "Left", value: `0:${String(Math.ceil(left)).padStart(2, "0")}` },
          { label: "Pace", value: pace ? pace.toFixed(1) : "–", unit: " a second" },
        ],
        progress: s.start === null ? null : elapsed / TAP_MS,
        progressLabel: "Time",
        meter: s.opening === null ? null : clamp01(s.opening / widest),
        meterLabel: "Opening",
        alert: s.phase === "done" ? null : quality.live(),
      };
    },
    overlay(ctx, now) {
      const W = ctx.canvas.width;
      const box = fit(W, ctx.canvas.height, aspect);
      const Hh = box.h;
      /* the spark between the fingertips */
      if (hand && end === null) {
        const o = tapOpening({ t: 0, landmarks: null, hand, aspect }) ?? 0;
        const heat = clamp01(o / widest);
        const [x1, y1] = toCanvas(hand[H.thumbTip], box);
        const [x2, y2] = toCanvas(hand[H.indexTip], box);
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.lineCap = "round";
        ctx.strokeStyle = rgb(0.3 + heat * 0.65, 0.9);
        ctx.shadowColor = rgb(0.3 + heat * 0.65, 1);
        ctx.shadowBlur = Hh * 0.03;
        ctx.lineWidth = Math.max(3, Hh * (0.006 + heat * 0.008));
        /* a little crackle, so it reads as a spark and not a ruler */
        const n = 7;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        for (let i = 1; i < n; i++) {
          const u = i / n;
          const jx = Math.sin(now / 37 + i * 2.1) * Hh * 0.006 * heat;
          const jy = Math.cos(now / 41 + i * 1.7) * Hh * 0.006 * heat;
          ctx.lineTo(x1 + (x2 - x1) * u + jx, y1 + (y2 - y1) * u + jy);
        }
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
      }
      /* a ring from each tap, as big as it opened */
      for (const r of rings) {
        const since = now - r.at;
        if (since > 600) continue;
        const u = since / 600;
        const [x, y] = toCanvas(r.pos, box);
        const k = clamp01(r.amp / widest);
        ctx.strokeStyle = rgb(0.35 + k * 0.6, 1 - u);
        ctx.lineWidth = Hh * 0.006 * (1 - u * 0.5);
        ctx.beginPath();
        ctx.arc(x, y, Hh * (0.02 + k * 0.1 * (0.3 + u)), 0, Math.PI * 2);
        ctx.stroke();
      }
      while (rings.length && now - rings[0].at > 600) rings.shift();

      /* the strip: ten seconds across the top */
      const s = game.state;
      if (s.start === null) return;
      const left = W * 0.18, right = W * 0.82, top = Hh * 0.05 + box.y, h = Hh * 0.12;
      const xAt = (t: number) => left + (right - left) * Math.min(1, t / TAP_MS);
      ctx.fillStyle = "rgba(10,18,51,0.55)";
      ctx.fillRect(left - 12, top - 10, right - left + 24, h + 20);
      ctx.strokeStyle = "rgba(233,237,251,0.14)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(left, top + h + 0.5);
      ctx.lineTo(right, top + h + 0.5);
      ctx.stroke();
      ctx.strokeStyle = "rgba(120,215,255,0.5)";
      ctx.lineWidth = Math.max(1.5, Hh * 0.003);
      ctx.beginPath();
      trace.forEach((p, i) => {
        const x = xAt(p.t), y = top + h - h * clamp01(p.o / widest);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.stroke();
      s.taps.forEach((t: Tap) => {
        const x = xAt(t.t - s.start!);
        const k = clamp01(t.amp / widest);
        ctx.strokeStyle = rgb(0.35 + k * 0.6, 0.95);
        ctx.lineWidth = Math.max(3, W * 0.003);
        ctx.beginPath();
        ctx.moveTo(x, top + h);
        ctx.lineTo(x, top + h - h * k);
        ctx.stroke();
      });
    },
    record(demo) {
      const s = game.state;
      const m = summarise(s.taps);
      return {
        game: "tap",
        at: new Date().toISOString(),
        duration_s: TAP_MS / 1000,
        demo,
        measures: {
          taps: m.taps,
          taps_per_s: m.hz,
          rhythm_irregularity: m.irregularity,
          amplitude_cm: m.amplitudeCm,
          amplitude_decrement: m.decrement,
          hesitations: m.hesitations,
          tap_times_s: s.start === null ? [] : s.taps.map((t) => Math.round((t.t - s.start!) / 10) / 100),
        },
        quality: quality.flags(),
      };
    },
  };
}
