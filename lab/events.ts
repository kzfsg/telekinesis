/* What the Lab tells the page, one event at a time, over SSE. */

export type LabEvent =
  | { kind: "status"; text: string }
  | { kind: "say"; text: string }
  | { kind: "tool"; name: string; detail: string }
  | { kind: "denied"; detail: string }
  | { kind: "check"; name: string; ok: boolean; output: string }
  | { kind: "ready"; game: Built | null; files: string[]; patch: string; ok: boolean }
  | { kind: "adopted" }
  | { kind: "error"; text: string };

export type Built = { gameId: string; name: string; summary: string };
