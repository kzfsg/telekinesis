import { describe, expect, it } from "vitest";
import { makeBody } from "../body";
import type { PoseFrame } from "../pose";
import { analyseTremor, createSteadyHand, type Sample } from "./steadyHand";

/* a wrist shaking at `hz` with `amp` units of peak, on a slow drift,
   sampled unevenly around 30 a second like a real camera */
function shake(hz: number, amp: number, seconds = 10): Sample[] {
  const out: Sample[] = [];
  let t = 0;
  while (t < seconds * 1000) {
    const s = t / 1000;
    out.push({ t, x: 0.5 + 0.01 * s + amp * Math.sin(2 * Math.PI * hz * s), y: 0.4 + 0.004 * Math.sin(s) + amp * 0.5 * Math.cos(2 * Math.PI * hz * s) });
    t += 30 + ((t * 7) % 7);
  }
  return out;
}

describe("analyseTremor", () => {
  it.each([4, 5.5, 8])("finds a %d Hz tremor", (hz) => {
    expect(analyseTremor(shake(hz, 0.002), 100).hz).toBeCloseTo(hz, 0);
  });

  it("measures a bigger shake as bigger", () => {
    const small = analyseTremor(shake(5, 0.001), 100).sizeMm;
    const big = analyseTremor(shake(5, 0.004), 100).sizeMm;
    expect(big).toBeGreaterThan(small * 3);
  });

  it("puts a size on it in millimetres", () => {
    /* 0.002 units at 100 cm a unit is 2 mm of peak in x and 1 in y;
       the root mean square of that is about 1.6 mm */
    expect(analyseTremor(shake(5, 0.002), 100).sizeMm).toBeCloseTo(1.6, 0);
  });

  it("finds no tremor in a slow drift", () => {
    const drift: Sample[] = Array.from({ length: 300 }, (_, i) => ({ t: i * 33, x: 0.5 + i * 0.0001, y: 0.4 }));
    const r = analyseTremor(drift, 100);
    expect(r.hz).toBeNull();
    expect(r.sizeMm).toBeLessThan(0.1);
  });

  it("needs a couple of seconds before it says anything", () => {
    expect(analyseTremor(shake(5, 0.002, 1), 100)).toEqual({ sizeMm: 0, hz: null });
  });
});

describe("steady hand", () => {
  const frame = (t: number, rightArm: number, wobble?: { x: number; y: number }): PoseFrame => ({
    t,
    landmarks: makeBody({ rightArm, wobble }),
    aspect: 16 / 9,
  });

  it("waits for an arm to come up before timing", () => {
    const g = createSteadyHand(2000);
    expect(g.update(frame(0, 10)).phase).toBe("raise");
    expect(g.update(frame(33, 90)).phase).toBe("holding");
    expect(g.state.side).toBe("right");
  });

  it("shows a live shake reading while holding", () => {
    const g = createSteadyHand(10000);
    for (let t = 0; t <= 3500; t += 33) {
      g.update(frame(t, 90, { x: 0.003 * Math.sin(2 * Math.PI * 6 * (t / 1000)), y: 0 }));
    }
    expect(g.state.phase).toBe("holding");
    expect(g.state.wobble).toBeGreaterThan(1);
  });

  it("measures the held arm's tremor once the time is up", () => {
    const g = createSteadyHand(4000);
    for (let t = 0; t <= 4100; t += 33) {
      const s = t / 1000;
      g.update(frame(t, 90, { x: 0.003 * Math.sin(2 * Math.PI * 6 * s), y: 0 }));
    }
    expect(g.state.phase).toBe("done");
    expect(g.state.result?.hz).toBeCloseTo(6, 0);
    expect(g.state.result!.sizeMm).toBeGreaterThan(1);
  });
});
