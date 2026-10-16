import { describe, expect, it } from "vitest";
import { makeBody } from "../body";
import type { PoseFrame } from "../pose";
import { createReach, TARGETS } from "./reach";

let t = 0;
const frame = (leftArm: number, rightArm: number): PoseFrame => ({ t: (t += 33), landmarks: makeBody({ leftArm, rightArm }), aspect: 16 / 9 });

describe("reach", () => {
  it("shows the first target and does not pop it with arms down", () => {
    const g = createReach();
    const s = g.update(frame(8, 8));
    expect(s.target?.side).toBe("left");
    expect(s.target?.deg).toBe(90);
    expect(s.hits).toBe(0);
  });

  it("pops a target when the wrist reaches it", () => {
    const g = createReach();
    g.update(frame(8, 8));
    const s = g.update(frame(90, 8));
    expect(s.hits).toBe(1);
    expect(s.target?.side).toBe("right");
  });

  it("does not pop a target with the wrong arm", () => {
    const g = createReach();
    expect(g.update(frame(8, 90)).hits).toBe(0);
  });

  it("does not pop a target the arm falls short of", () => {
    const g = createReach();
    g.update(frame(90, 8));
    g.update(frame(90, 90));
    /* the left 120 target, reached only to 85 */
    expect(g.update(frame(85, 8)).hits).toBe(2);
  });

  it("finishes after every target", () => {
    const g = createReach();
    for (const target of TARGETS) {
      g.update(target.side === "left" ? frame(target.deg, 8) : frame(8, target.deg));
    }
    expect(g.state.done).toBe(true);
    expect(g.state.hits).toBe(TARGETS.length);
  });

  it("keeps the highest abduction for each arm", () => {
    const g = createReach();
    g.update(frame(140, 60));
    g.update(frame(30, 110));
    const s = g.update(frame(10, 10));
    expect(s.best.left).toBeCloseTo(140, 0);
    expect(s.best.right).toBeCloseTo(110, 0);
  });

  it("waits when nobody is in frame", () => {
    const g = createReach();
    const s = g.update({ t: 0, landmarks: null, aspect: 16 / 9 });
    expect(s.target).toBeNull();
    expect(s.hits).toBe(0);
  });
});
