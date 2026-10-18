import { describe, expect, it } from "vitest";
import { makeHand } from "../body";
import type { PoseFrame } from "../pose";
import { createTap, opening, summarise, TAP_MS } from "./tap";

const frame = (t: number, open: number, at?: { x: number; y: number }): PoseFrame => ({ t, landmarks: null, hand: makeHand({ opening: open, at }), aspect: 16 / 9 });

/* a tap every `gap` ms, opening to `amp` hand lengths */
function taps(game: ReturnType<typeof createTap>, from: number, n: number, gap: number, amp: (i: number) => number = () => 0.9) {
  let t = from;
  for (let i = 0; i < n; i++) {
    game.update(frame(t, amp(i)));
    game.update(frame(t + gap / 2, 0.05));
    t += gap;
  }
  return t;
}

describe("opening", () => {
  it("reads the thumb-to-index gap in hand lengths", () => {
    expect(opening(frame(0, 0.8))!).toBeCloseTo(0.8, 2);
    expect(opening(frame(0, 0.1))!).toBeCloseTo(0.1, 2);
  });
  it("is the same near the camera or far", () => {
    const near = { t: 0, landmarks: null, hand: makeHand({ opening: 0.6, size: 0.35 }), aspect: 16 / 9 };
    const far = { t: 0, landmarks: null, hand: makeHand({ opening: 0.6, size: 0.12 }), aspect: 16 / 9 };
    expect(opening(near)!).toBeCloseTo(opening(far)!, 3);
  });
  it("is null with no hand", () => {
    expect(opening({ t: 0, landmarks: null, hand: null, aspect: 1 })).toBeNull();
  });
});

describe("tap", () => {
  it("waits for a hand, then for the first tap", () => {
    const g = createTap();
    expect(g.update({ t: 0, landmarks: null, aspect: 16 / 9 }).phase).toBe("finding");
    expect(g.update(frame(10, 0.9)).phase).toBe("ready");
  });

  it("counts each close after an opening once", () => {
    const g = createTap();
    taps(g, 0, 8, 250);
    expect(g.state.taps).toHaveLength(8);
    expect(g.state.phase).toBe("tapping");
  });

  it("does not count a flutter that never opens", () => {
    const g = createTap();
    for (let t = 0; t < 2000; t += 33) g.update(frame(t, t % 66 ? 0.25 : 0.05));
    expect(g.state.taps).toHaveLength(0);
  });

  it("stops after ten seconds from the first tap", () => {
    const g = createTap();
    taps(g, 0, 60, 250);
    expect(g.state.phase).toBe("done");
    expect(g.state.taps.length).toBeLessThanOrEqual(TAP_MS / 250 + 1);
  });

  it("keeps each tap's widest opening", () => {
    const g = createTap();
    g.update(frame(0, 0.5));
    g.update(frame(30, 0.95));
    g.update(frame(60, 0.7));
    g.update(frame(90, 0.05));
    expect(g.state.taps[0].amp).toBeCloseTo(0.95, 2);
  });
});

describe("summarise", () => {
  it("finds the pace and an even rhythm", () => {
    const g = createTap();
    taps(g, 0, 21, 200);
    const m = summarise(g.state.taps);
    expect(m.hz).toBeCloseTo(5, 1);
    expect(m.irregularity!).toBeLessThan(0.05);
    expect(m.hesitations).toBe(0);
    expect(m.decrement!).toBeCloseTo(0, 1);
  });

  it("finds taps that fade", () => {
    const g = createTap();
    taps(g, 0, 20, 250, (i) => 1 - i * 0.03);
    expect(summarise(g.state.taps).decrement!).toBeGreaterThan(0.4);
  });

  it("finds a stall", () => {
    const m = summarise([0, 250, 500, 750, 1800, 2050, 2300].map((t) => ({ t, amp: 0.9 })));
    expect(m.hesitations).toBe(1);
    expect(m.irregularity!).toBeGreaterThan(0.5);
  });

  it("says nothing it can't from too few taps", () => {
    const m = summarise([{ t: 0, amp: 0.8 }]);
    expect(m.hz).toBeNull();
    expect(m.irregularity).toBeNull();
    expect(m.decrement).toBeNull();
  });
});
