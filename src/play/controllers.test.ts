import { describe, expect, it } from "vitest";
import { makeBody } from "./body";
import { createController } from "./controllers";

describe("the chair rise controller", () => {
  it("stops counting when the 30 seconds are up", () => {
    const c = createController("chair-rise");
    /* seated to calibrate, then a stand every second, for 40 seconds */
    for (let t = 0; t <= 40000; t += 33) {
      const s = t / 1000;
      const rise = s < 1.5 ? 0 : (s - 1.5) % 1 < 0.5 ? 1 : 0;
      c.update({ t, landmarks: makeBody({ rise }), aspect: 16 / 9 }, t);
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
