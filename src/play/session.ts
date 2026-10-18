import type { QualityFlag } from "./quality";
import type { GameId } from "./simulated";

/* What a finished game sends: the measurements and nothing else.
   This build keeps sessions in the browser's own storage, standing
   in for the trial's server; the shape is what would be posted. */

export type SessionRecord = {
  game: GameId;
  at: string;
  duration_s: number;
  /* true when the simulated participant played, not a person */
  demo: boolean;
  measures: Record<string, number | number[] | string | null>;
  /* whether the recording itself can be trusted: framing, light,
     a steady camera. Separate from the measures, so a low score and
     a bad recording are never confused */
  quality?: QualityFlag[];
};

const KEY = "telekinesis.sessions";

export function saveSession(record: SessionRecord) {
  try {
    const all = loadSessions();
    all.push(record);
    localStorage.setItem(KEY, JSON.stringify(all.slice(-200)));
  } catch {
    /* private browsing can refuse storage; the result still shows */
  }
}

export function loadSessions(): SessionRecord[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as SessionRecord[];
  } catch {
    return [];
  }
}

/* the size of what would travel, in bytes */
export const payloadBytes = (record: SessionRecord) => new TextEncoder().encode(JSON.stringify(record)).length;
