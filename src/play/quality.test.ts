import { describe, expect, it } from "vitest";
import { createQuality, type Check } from "./quality";

const check: Check = { id: "x", label: "X", fix: "Fix x", need: 0.8, test: (f) => f.aspect > 1 };

describe("recording quality", () => {
  it("passes a check most frames pass, and flags one they don't", () => {
    const q = createQuality([check], 15);
    for (let t = 0; t < 3000; t += 33) q.update({ t, landmarks: [], aspect: t < 2700 ? 2 : 0.5 });
    expect(q.flags().find((f) => f.id === "x")!.ok).toBe(true);
    const bad = createQuality([check], 15);
    for (let t = 0; t < 3000; t += 33) bad.update({ t, landmarks: [], aspect: t < 1500 ? 2 : 0.5 });
    expect(bad.flags().find((f) => f.id === "x")!.ok).toBe(false);
  });

  it("puts the fix on screen only while it's failing", () => {
    const q = createQuality([check], 15);
    for (let t = 0; t < 1000; t += 33) q.update({ t, landmarks: [], aspect: 0.5 });
    expect(q.live()).toBe("Fix x");
    for (let t = 1000; t < 2000; t += 33) q.update({ t, landmarks: [], aspect: 2 });
    expect(q.live()).toBeNull();
  });

  it("reads a repeated frame once", () => {
    const q = createQuality([check], 15);
    for (let i = 0; i < 50; i++) q.update({ t: 0, landmarks: [], aspect: 0.5 });
    q.update({ t: 33, landmarks: [], aspect: 2 });
    expect(q.flags().find((f) => f.id === "x")!.value).toBe(0.5);
  });

  it("flags a low frame rate", () => {
    const q = createQuality([], 15);
    for (let t = 0; t < 3000; t += 100) q.update({ t, landmarks: [], aspect: 1 });
    const fps = q.flags().find((f) => f.id === "frame-rate")!;
    expect(fps.ok).toBe(false);
    expect(fps.value).toBe(10);
  });

  it("flags a session where nobody was tracked", () => {
    const q = createQuality([], 15);
    for (let t = 0; t < 3000; t += 33) q.update({ t, landmarks: null, aspect: 1 });
    expect(q.flags().find((f) => f.id === "tracked")!.ok).toBe(false);
  });
});
