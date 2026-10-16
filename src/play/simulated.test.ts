import { describe, expect, it, vi } from "vitest";
import { createChairRise } from "./games/chairRise";
import { createReach, TARGETS } from "./games/reach";
import { createSteadyHand } from "./games/steadyHand";
import type { PoseFrame } from "./pose";
import { simulate, type GameId } from "./simulated";

/* run a source for `seconds` at 30 frames a second, from a fixed clock */
function run<S>(game: GameId, seconds: number, update: (f: PoseFrame) => S) {
  vi.spyOn(performance, "now").mockReturnValue(0);
  const src = simulate(game);
  let last!: S;
  for (let t = 0; t <= seconds * 1000; t += 1000 / 30) last = update(src.read(t)!);
  vi.restoreAllMocks();
  return last;
}

describe("the simulated participant", () => {
  it("does a believable 30-second chair stand", () => {
    const g = createChairRise();
    const s = run("chair-rise", 31.6, (f) => g.update(f));
    expect(s.reps).toBeGreaterThanOrEqual(11);
    expect(s.reps).toBeLessThanOrEqual(15);
  });

  it("reaches every target", () => {
    const g = createReach();
    const s = run("reach", TARGETS.length * 2.2 + 1, (f) => g.update(f));
    expect(s.done).toBe(true);
    expect(s.best.left).toBeGreaterThan(165);
  });

  it("holds with a tremor the analysis can find", () => {
    const g = createSteadyHand(10000);
    const s = run("steady-hand", 13, (f) => g.update(f));
    expect(s.phase).toBe("done");
    expect(s.result?.hz).toBeCloseTo(5.2, 0);
  });
});
