import { describe, expect, it } from "vitest";
import { makeBody } from "./body";
import { abduction, angleAt, mid, reachPoint } from "./geometry";
import { J } from "./pose";

describe("angleAt", () => {
  it("reads a right angle", () => {
    expect(angleAt({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90);
  });
  it("reads a straight line as 180", () => {
    expect(angleAt({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(180);
  });
  it("corrects for the video's aspect", () => {
    /* 0.5625 across at 16:9 is as long as 1 down, so this is 45 degrees */
    expect(angleAt({ x: 0.5625, y: 0 }, { x: 0, y: 0 }, { x: 0.5625, y: 1 }, 16 / 9)).toBeCloseTo(45);
  });
});

describe("abduction", () => {
  it.each([0, 45, 90, 135, 170])("reads an arm raised to %i degrees", (deg) => {
    const aspect = 16 / 9;
    const b = makeBody({ leftArm: deg, rightArm: deg, aspect });
    const ms = mid(b[J.leftShoulder], b[J.rightShoulder]);
    const mh = mid(b[J.leftHip], b[J.rightHip]);
    expect(abduction(b[J.leftShoulder], b[J.leftWrist], ms, mh, aspect)).toBeCloseTo(deg, 1);
    expect(abduction(b[J.rightShoulder], b[J.rightWrist], ms, mh, aspect)).toBeCloseTo(deg, 1);
  });
});

describe("reachPoint", () => {
  it("puts a level left arm out to the image's right", () => {
    const p = reachPoint({ x: 0.5, y: 0.5 }, "left", 90, 0.2);
    expect(p.x).toBeCloseTo(0.7);
    expect(p.y).toBeCloseTo(0.5);
  });
  it("puts a raised right arm up and to the image's left", () => {
    const p = reachPoint({ x: 0.5, y: 0.5 }, "right", 180, 0.2);
    expect(p.x).toBeCloseTo(0.5);
    expect(p.y).toBeCloseTo(0.3);
  });
});
