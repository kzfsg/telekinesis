import { makeBody, makeHand } from "./body";
import { TARGETS } from "./games/reach";
import type { PoseFrame, PoseSource } from "./pose";

/* A participant who isn't there: the same body the tests use, moved
   through each game at a believable pace, so the games can be shown
   and tried without a camera. Small jitter keeps it from looking
   drawn, and gives the heat something to show even when still.
   Tapping moves a hand rather than a body. */

export type GameId = "chair-rise" | "floor-rise" | "reach" | "tap";

const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

/* a cycle's shape: rest at 0, rise to 1, hold, come back */
const pulse = (u: number) => (u < 0.4 ? smooth(u / 0.4) : u < 0.55 ? 1 : 1 - smooth((u - 0.55) / 0.4));

export function simulate(game: GameId): PoseSource {
  const start = performance.now();
  const jitter = () => (Math.random() - 0.5) * 0.001;

  const posture = (s: number) => {
    if (game === "chair-rise") {
      /* seated for the calibration, then a stand every 2.1 seconds or so,
         a little slower as the half minute goes on */
      if (s < 1.6) return { rise: 0, crossed: true };
      const period = 2.1 + (s - 1.6) * 0.012;
      const cycle = Math.floor((s - 1.6) / period);
      const u = ((s - 1.6) % period) / period;
      /* the seventh try runs out of strength halfway and sinks back:
         a partial rise, as Duchenne often shows late in a set */
      const reach = cycle === 6 ? 0.5 : 1;
      return { rise: reach * pulse(u), crossed: true };
    }
    if (game === "floor-rise") {
      /* stands to be measured, gets down, sits, then rises the way a
         boy with Duchenne often does: hands to the floor, then walked
         up the thighs to push the body upright, slowing midway */
      if (s < 1.5) return { floor: 1 };
      if (s < 3.5) return { floor: 1 - smooth((s - 1.5) / 2) };
      if (s < 5) return { floor: 0 };
      const u = Math.min(1, (s - 5) / 6);
      const f = u < 0.5 ? 0.6 * smooth(u / 0.5) : 0.6 + 0.4 * smooth((u - 0.5) / 0.5);
      return { floor: f, hands: f < 0.3 ? ("floor" as const) : f < 0.75 ? ("thighs" as const) : undefined };
    }
    if (game === "reach") {
      /* each target in turn, an arm swinging up a little past it */
      const per = 2.2;
      const i = Math.floor(s / per);
      const target = TARGETS[i % TARGETS.length];
      const lift = 8 + (target.deg + 4 - 8) * pulse((s % per) / per);
      return target.side === "left" ? { leftArm: lift, rightArm: 8 } : { leftArm: 8, rightArm: lift };
    }
    return {};
  };

  /* Tapping, Parkinson's-like: brisk and wide at first, then slower
     and smaller as the ten seconds go on, with the odd uneven gap and
     one short stall: the decrement the analysis should find. */
  let tapClock = 0;
  let tapPhase = 0;
  let lastS = 0;
  const hand = (s: number) => {
    const dt = s - lastS;
    lastS = s;
    if (s < 1.2) return makeHand({ opening: 0.7 });
    const run = s - 1.2;
    /* 4.4 taps a second falling to 3.2, a stall near five seconds */
    const rate = 4.4 - Math.min(1.2, run * 0.12);
    const stalled = run > 5 && run < 5.5;
    tapClock += stalled ? 0 : dt * rate * (1 + 0.12 * Math.sin(run * 7.3));
    tapPhase = tapClock % 1;
    const amp = 1.05 - Math.min(0.45, run * 0.045);
    /* closed for the first fifth of each cycle, then open and back */
    const shape = tapPhase < 0.2 ? 0 : Math.sin(((tapPhase - 0.2) / 0.8) * Math.PI);
    return makeHand({ opening: 0.04 + amp * shape, at: { x: 0.5 + Math.sin(s * 0.7) * 0.004, y: 0.72 } });
  };

  return {
    video: null,
    read(now: number): PoseFrame {
      const s = (now - start) / 1000;
      if (game === "tap") {
        return { t: now, landmarks: null, hand: hand(s).map((p) => ({ ...p, x: p.x + jitter(), y: p.y + jitter() })), aspect: 16 / 9 };
      }
      /* the floor rise is framed a little higher, as a camera set low
         for it would be, so its feet sit clear of the instruction */
      const body = makeBody({ ...posture(s), ...(game === "floor-rise" ? { shift: { x: 0, y: -0.1 } } : {}) });
      return { t: now, landmarks: body.map((p) => ({ ...p, x: p.x + jitter(), y: p.y + jitter() })), aspect: 16 / 9 };
    },
    stop() {},
  };
}
