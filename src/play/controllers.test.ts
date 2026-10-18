import { describe, expect, it } from "vitest";
import { makeBody } from "./body";
import { createController } from "./controllers";

describe("the rise controller", () => {
  it("stops counting when the 30 seconds are up", () => {
    const c = createController("chair-rise");
    /* seated to calibrate, then a stand every second, for 40 seconds */
    for (let t = 0; t <= 40000; t += 33) {
      const s = t / 1000;
      const rise = s < 1.5 ? 0 : (s - 1.5) % 1 < 0.5 ? 1 : 0;
      c.update({ t, landmarks: makeBody({ rise, crossed: true }), aspect: 16 / 9 }, t);
    }
    const r = c.record(true);
    const times = r.measures.stand_times_s as number[];
    expect(c.done).toBe(true);
    expect(times.every((x) => x <= 30)).toBe(true);
    expect(r.measures.rises).toBe(times.length);
    expect(times.length).toBeGreaterThanOrEqual(28);
    expect(times.length).toBeLessThanOrEqual(31);
  });
});

const flagsFor = (posture: (s: number) => Parameters<typeof makeBody>[0]) => {
  const c = createController("chair-rise");
  for (let t = 0; t <= 33000; t += 33) {
    const s = t / 1000;
    const rise = s < 1.5 ? 0 : (s - 1.5) % 2 < 1 ? 1 : 0;
    c.update({ t, landmarks: makeBody({ rise, ...posture(s) }), aspect: 16 / 9 }, t);
  }
  return Object.fromEntries((c.record(true).quality ?? []).map((f) => [f.id, f.ok]));
};

describe("the chair rise recording checks", () => {
  it("pass a clean recording", () => {
    const f = flagsFor(() => ({ crossed: true }));
    expect(Object.values(f).every(Boolean)).toBe(true);
  });

  it("flag arms that aren't crossed", () => {
    const f = flagsFor(() => ({}));
    expect(f.arms).toBe(false);
    expect(f["in-view"]).toBe(true);
  });

  it("flag a camera knocked partway through", () => {
    const f = flagsFor((s) => ({ crossed: true, shift: s > 8 ? { x: 0.08, y: 0 } : { x: 0, y: 0 } }));
    expect(f.steady).toBe(false);
  });

  it("flag feet cut off by the frame", () => {
    const f = flagsFor(() => ({ crossed: true, shift: { x: 0, y: 0.1 } }));
    expect(f["in-view"]).toBe(false);
  });
});
