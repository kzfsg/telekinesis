import type { PoseFrame } from "./pose";

/* Recording quality: not how well the participant moved, but whether
   the recording can be trusted to say. Each check asks one thing of
   every frame (is the whole body in view? is it close enough?) and
   the session keeps the share of frames that passed. A check that
   passed too rarely is flagged on the result, so a study team can
   tell a low score from a bad recording.

   While the game runs, a check failing over the last second or so
   puts its fix on screen, one at a time, most important first. */

export type Check = {
  id: string;
  /* what passing means, for the result: "Whole body in view" */
  label: string;
  /* what to do about it, for the screen: "Step back so your feet show" */
  fix: string;
  /* null when the frame can't say, which counts neither way */
  test(frame: PoseFrame): boolean | null;
  /* the share of frames that must pass for the session to be clean */
  need: number;
};

export type QualityFlag = {
  id: string;
  label: string;
  ok: boolean;
  /* the share of frames that passed, 0..1, or the rate for frame rate */
  value: number;
};

/* how many recent frames decide what shows on screen */
const RECENT = 24;

export function createQuality(checks: Check[], minFps: number) {
  const pass = new Map<string, number>();
  const seen = new Map<string, number>();
  const recent = new Map<string, boolean[]>();
  let lastT: number | null = null;
  let firstT: number | null = null;
  let frames = 0;
  /* frames with nobody in them: a session that never saw anyone is
     not a clean one */
  let empty = 0;

  return {
    /* reads a frame once; the camera repeats a frame until the next
       is ready, and repeats would weight the shares */
    update(frame: PoseFrame | null) {
      if (!frame || frame.t === lastT) return;
      lastT = frame.t;
      firstT ??= frame.t;
      frames += 1;
      if (!frame.landmarks && !frame.hand) empty += 1;
      for (const c of checks) {
        const r = c.test(frame);
        if (r === null) continue;
        seen.set(c.id, (seen.get(c.id) ?? 0) + 1);
        if (r) pass.set(c.id, (pass.get(c.id) ?? 0) + 1);
        const q = recent.get(c.id) ?? [];
        q.push(r);
        if (q.length > RECENT) q.shift();
        recent.set(c.id, q);
      }
    },
    /* the fix for the first check failing most of the last second */
    live(): string | null {
      for (const c of checks) {
        const q = recent.get(c.id);
        if (q && q.length >= RECENT / 2 && q.filter((r) => !r).length > q.length / 2) return c.fix;
      }
      return null;
    },
    fps() {
      return firstT !== null && lastT !== null && lastT > firstT ? ((frames - 1) * 1000) / (lastT - firstT) : 0;
    },
    flags(): QualityFlag[] {
      const out: QualityFlag[] = checks.map((c) => {
        const n = seen.get(c.id) ?? 0;
        const share = n ? (pass.get(c.id) ?? 0) / n : 0;
        return { id: c.id, label: c.label, ok: n > 0 && share >= c.need, value: Math.round(share * 100) / 100 };
      });
      const fps = this.fps();
      out.push({ id: "frame-rate", label: `Steady video, ${minFps}+ frames a second`, ok: fps >= minFps, value: Math.round(fps) });
      out.push({ id: "tracked", label: "Someone tracked most of the time", ok: frames > 0 && empty / frames <= 0.2, value: frames ? Math.round((1 - empty / frames) * 100) / 100 : 0 });
      return out;
    },
  };
}

/* the share a flag reports, as words for the result */
export const flagValue = (f: QualityFlag) => (f.id === "frame-rate" ? `${f.value} fps` : `${Math.round(f.value * 100)}%`);
