import { describe, expect, it } from "vitest";
import { makeBody, type Posture } from "../body";
import { createFloorRise, hipLift } from "./floorRise";

let t = 0;
const frame = (posture: Posture) => ({ t: (t += 33), landmarks: makeBody(posture), aspect: 16 / 9 });
const hold = (g: ReturnType<typeof createFloorRise>, posture: Posture, seconds: number) => {
  for (let i = 0; i < seconds * 30; i++) g.update(frame(posture));
  return g.state;
};
/* stand to learn tall, sit on the floor and settle */
const toFloor = (g: ReturnType<typeof createFloorRise>) => {
  hold(g, { floor: 1 }, 1.2);
  hold(g, { floor: 0 }, 1.2);
};
/* rise over `seconds`, optionally with hands on the thighs mid-way */
const rise = (g: ReturnType<typeof createFloorRise>, seconds: number, hands?: "thighs") => {
  const n = seconds * 30;
  for (let i = 1; i <= n; i++) {
    const f = i / n;
    g.update(frame({ floor: f, hands: hands && f > 0.3 && f < 0.7 ? hands : undefined }));
  }
  return hold(g, { floor: 1 }, 0.5);
};

describe("hipLift", () => {
  it("is far higher standing than sitting on the floor", () => {
    expect(hipLift(frame({ floor: 1 }))!).toBeGreaterThan(hipLift(frame({ floor: 0 }))! * 5);
  });
});

describe("floor rise", () => {
  it("asks to stand first, then to get down", () => {
    const g = createFloorRise();
    expect(hold(g, { floor: 0 }, 1).phase).toBe("stand");
    expect(hold(g, { floor: 1 }, 1.2).phase).toBe("down");
    expect(hold(g, { floor: 0 }, 1.2).phase).toBe("ready");
  });

  it("times a rise from the floor", () => {
    const g = createFloorRise();
    toFloor(g);
    const s = rise(g, 3);
    expect(s.phase).toBe("done");
    expect(s.completed).toBe(true);
    expect(s.riseMs!).toBeGreaterThan(2200);
    expect(s.riseMs!).toBeLessThan(3000);
    expect(s.rungMs.every((r) => r !== null)).toBe(true);
    expect(s.thighsMs).toBe(0);
  });

  it("notices hands pushing on the thighs", () => {
    const g = createFloorRise();
    toFloor(g);
    const s = rise(g, 4, "thighs");
    expect(s.completed).toBe(true);
    expect(s.thighsMs).toBeGreaterThan(1000);
  });

  it("doesn't stop the clock on a lurch that falls back", () => {
    const g = createFloorRise();
    toFloor(g);
    g.update(frame({ floor: 0.5 }));
    g.update(frame({ floor: 0.95 }));
    g.update(frame({ floor: 0.5 }));
    expect(g.state.phase).toBe("rising");
  });

  it("gives up after the time limit", () => {
    const g = createFloorRise(2000);
    toFloor(g);
    hold(g, { floor: 0.4 }, 2.5);
    expect(g.state.phase).toBe("done");
    expect(g.state.completed).toBe(false);
    expect(g.state.riseMs).toBeNull();
  });
});
