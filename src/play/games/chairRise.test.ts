import { describe, expect, it } from "vitest";
import { makeBody } from "../body";
import type { PoseFrame } from "../pose";
import { createChairRise, hipRatio } from "./chairRise";

const frame = (t: number, rise: number): PoseFrame => ({ t, landmarks: makeBody({ rise }), aspect: 16 / 9 });

/* feed a run of postures at 30 frames a second */
function play(rises: number[], startT = 0) {
  const game = createChairRise();
  rises.forEach((r, i) => game.update(frame(startT + (i * 1000) / 30, r)));
  return game.state;
}
const hold = (rise: number, seconds: number) => Array(Math.round(seconds * 30)).fill(rise);

describe("hipRatio", () => {
  it("is higher standing than seated", () => {
    expect(hipRatio(frame(0, 1))!).toBeGreaterThan(hipRatio(frame(0, 0))! * 1.2);
  });
  it("is null when nobody is in frame", () => {
    expect(hipRatio({ t: 0, landmarks: null, aspect: 1 })).toBeNull();
  });
});

describe("chair rise", () => {
  it("calibrates on the first second seated", () => {
    const s = play(hold(0, 1.2));
    expect(s.phase).toBe("seated");
    expect(s.baseline).not.toBeNull();
    expect(s.reps).toBe(0);
  });

  it("counts each full stand once", () => {
    const s = play([...hold(0, 1.2), ...hold(1, 0.6), ...hold(0, 0.6), ...hold(1, 0.6), ...hold(0, 0.6), ...hold(1, 0.6)]);
    expect(s.reps).toBe(3);
    expect(s.standTimes).toHaveLength(3);
  });

  it("does not count a half rise", () => {
    expect(play([...hold(0, 1.2), ...hold(0.35, 1)]).reps).toBe(0);
  });

  it("does not count a wobble near the top twice", () => {
    /* up, a dip that never gets back to seated, up again */
    const s = play([...hold(0, 1.2), ...hold(1, 0.5), ...hold(0.75, 0.3), ...hold(1, 0.5)]);
    expect(s.reps).toBe(1);
  });

  it("counts a rise that sinks back as a partial, not a stand", () => {
    const s = play([...hold(0, 1.2), ...hold(0.45, 0.6), ...hold(0, 0.6), ...hold(1, 0.6), ...hold(0, 0.6)]);
    expect(s.reps).toBe(1);
    expect(s.partials).toBe(1);
  });

  it("does not count shuffling on the seat as a partial", () => {
    expect(play([...hold(0, 1.2), ...hold(0.12, 0.5), ...hold(0, 0.5)]).partials).toBe(0);
  });

  it("times each stand from leaving the seat", () => {
    /* a slow stand: up over a second, in 30 small steps */
    const up = Array.from({ length: 30 }, (_, i) => (i + 1) / 30);
    const s = play([...hold(0, 1.2), ...up, ...hold(1, 0.3)]);
    expect(s.reps).toBe(1);
    expect(s.riseMs[0]).toBeGreaterThan(400);
    expect(s.riseMs[0]).toBeLessThan(1000);
  });

  it("keeps the count through a moment out of frame", () => {
    const game = createChairRise();
    const seq = [...hold(0, 1.2), ...hold(1, 0.6), ...hold(0, 0.6)];
    seq.forEach((r, i) => game.update(frame((i * 1000) / 30, r)));
    game.update({ t: 3000, landmarks: null, aspect: 16 / 9 });
    expect(game.state.reps).toBe(1);
    expect(game.state.phase).toBe("seated");
  });
});
