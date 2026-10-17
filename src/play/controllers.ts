import { createChairRise } from "./games/chairRise";
import { createReach, TARGETS } from "./games/reach";
import { createSteadyHand, HOLD_MS } from "./games/steadyHand";
import type { PoseFrame } from "./pose";
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
};

export type Controller = {
  update(frame: PoseFrame | null, now: number): Hud;
  overlay(ctx: CanvasRenderingContext2D, now: number): void;
  readonly done: boolean;
  record(demo: boolean): SessionRecord;
};

export const GAMES: Record<GameId, { name: string; mirrors: string; setup: string; measures: string }> = {
  "chair-rise": {
    name: "Chair rise",
    mirrors: "30-second chair stand test",
    setup: "A sturdy chair without wheels, placed so the camera sees you from head to feet.",
    measures: "Full stands in 30 seconds",
  },
  reach: {
    name: "Reach",
    mirrors: "Range-of-motion exam",
    setup: "Stand facing the camera with room to lift both arms out to the side.",
    measures: "How high each shoulder lifts its arm",
  },
  "steady-hand": {
    name: "Steady hand",
    mirrors: "Clinician tremor rating",
    setup: "Stand or sit facing the camera, upper body and arms in view.",
    measures: "Tremor size and frequency",
  },
};

const CHAIR_S = 30;
const REACH_LIMIT_S = 60;

function chairRise(): Controller {
  const game = createChairRise();
  let go: number | null = null;
  let end: number | null = null;
  /* stands, timed from the moment the 30 seconds started */
  const stands: number[] = [];
  return {
    get done() {
      return end !== null;
    },
    update(frame, now) {
      /* the count stops with the clock: once time is up, the game
         stops reading frames, so a stand during the closing pause
         can't be added to a 30-second score */
      if (go !== null && end === null && now - go >= CHAIR_S * 1000) end = go + CHAIR_S * 1000;
      const before = game.state.reps;
      const s = frame && end === null ? game.update(frame) : game.state;
      if (go === null && s.baseline !== null) go = now;
      if (go !== null && s.reps > before) stands.push(Math.round((now - go) / 100) / 10);
      const left = go === null ? CHAIR_S : Math.max(0, CHAIR_S - (now - go) / 1000);
      const instruction =
        s.phase === "finding"
          ? "Step back until the camera sees you head to feet, then sit on the chair."
          : s.phase === "calibrating"
            ? "Sit still, arms crossed over your chest."
            : end !== null
              ? "Time. Well done."
              : s.phase === "seated"
                ? "Stand all the way up."
                : "Now sit back down.";
      return {
        instruction,
        big: String(s.reps),
        bigLabel: s.reps === 1 ? "rise" : "rises",
        /* no knee angle here: from the front, a knee points at the
           camera and its angle can't be read honestly */
        readouts: [{ label: "Left", value: `0:${String(Math.ceil(left)).padStart(2, "0")}` }],
        progress: go === null ? null : 1 - left / CHAIR_S,
        progressLabel: "Time",
        meter: s.baseline === null ? null : Math.min(1, Math.max(0, (s.rise - 1) / 0.3)),
        meterLabel: "Rise",
      };
    },
    overlay() {},
    record(demo) {
      const s = game.state;
      return {
        game: "chair-rise",
        at: new Date().toISOString(),
        duration_s: CHAIR_S,
        demo,
        measures: {
          rises: s.reps,
          stand_times_s: stands,
        },
      };
    },
  };
}

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

function steadyHand(): Controller {
  const game = createSteadyHand();
  return {
    get done() {
      return game.state.phase === "done";
    },
    update(frame) {
      const s = frame ? game.update(frame) : game.state;
      const instruction =
        s.phase === "finding"
          ? "Step back until the camera sees your arms and hips."
          : s.phase === "raise"
            ? "Lift one arm straight out to the side, level with your shoulder."
            : s.phase === "holding"
              ? "Hold it there, as still as you can."
              : "You can lower your arm.";
      const wobble = s.phase === "done" ? s.result?.sizeMm ?? 0 : s.wobble;
      return {
        instruction,
        big: s.phase === "holding" ? String(Math.max(0, Math.ceil((HOLD_MS - s.held) / 1000))) : s.phase === "done" ? "0" : "15",
        bigLabel: "seconds to hold",
        readouts: [
          { label: "Shake", value: wobble.toFixed(1), unit: " mm" },
          ...(s.result?.hz ? [{ label: "Tremor", value: s.result.hz.toFixed(1), unit: " Hz" }] : []),
        ],
        progress: s.phase === "holding" || s.phase === "done" ? Math.min(1, s.held / HOLD_MS) : null,
        progressLabel: "Hold",
        /* stillness is cold: the meter warms as the hand shakes */
        meter: s.phase === "holding" ? Math.min(1, wobble / 4) : null,
        meterLabel: "Shake",
      };
    },
    overlay() {},
    record(demo) {
      const s = game.state;
      return {
        game: "steady-hand",
        at: new Date().toISOString(),
        duration_s: HOLD_MS / 1000,
        demo,
        measures: {
          arm: s.side,
          tremor_mm: s.result?.sizeMm ?? null,
          tremor_hz: s.result?.hz ?? null,
        },
      };
    },
  };
}

export function createController(id: GameId): Controller {
  return id === "chair-rise" ? chairRise() : id === "reach" ? reach() : steadyHand();
}
