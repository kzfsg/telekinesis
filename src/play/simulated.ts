import { makeBody } from "./body";
import { TARGETS } from "./games/reach";
import type { PoseFrame, PoseSource } from "./pose";

/* A participant who isn't there: the same body the tests use, moved
   through each game at a believable pace, so the games can be shown
   and tried without a camera. Small jitter keeps it from looking
   drawn, and gives the heat something to show even when still. */

export type GameId = "chair-rise" | "reach" | "steady-hand";

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
      if (s < 1.6) return { rise: 0 };
      const period = 2.1 + (s - 1.6) * 0.012;
      return { rise: pulse(((s - 1.6) % period) / period) };
    }
    if (game === "reach") {
      /* each target in turn, an arm swinging up a little past it */
      const per = 2.2;
      const i = Math.floor(s / per);
      const target = TARGETS[i % TARGETS.length];
      const lift = 8 + (target.deg + 4 - 8) * pulse((s % per) / per);
      return target.side === "left" ? { leftArm: lift, rightArm: 8 } : { leftArm: 8, rightArm: lift };
    }
    /* steady hand: the right arm comes up level, then holds with a
       fine five-a-second tremor and a slow sink */
    const up = smooth((s - 0.8) / 1.2);
    const shake = s > 2 ? 0.0022 : 0;
    return {
      rightArm: 8 + 84 * up - Math.max(0, s - 2) * 0.25,
      wobble: { x: shake * Math.sin(2 * Math.PI * 5.2 * s), y: shake * 0.6 * Math.cos(2 * Math.PI * 5.2 * s) },
    };
  };

  return {
    video: null,
    read(now: number): PoseFrame {
      const s = (now - start) / 1000;
      const body = makeBody(posture(s));
      return { t: now, landmarks: body.map((p) => ({ ...p, x: p.x + jitter(), y: p.y + jitter() })), aspect: 16 / 9 };
    },
    stop() {},
  };
}
