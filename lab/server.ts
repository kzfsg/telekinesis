import { execFile } from "node:child_process";
import { existsSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import {
  AutonomyLevel,
  createSession,
  DroidMessageType,
  OutputFormatType,
  ToolConfirmationOutcome,
  ToolConfirmationType,
} from "@factory/droid-sdk/node";
import type { Built, LabEvent } from "./events.ts";

/* The Lab: a study team describes a motor test in words, and Droid
   builds it into a playable game. Each run gets its own git worktree,
   so Droid never edits the app that's running. Droid may edit files
   inside that worktree and run the tests, the type check and the lint,
   nothing else. When it's done, the server checks its work itself,
   and only then offers the change for adding to the app. */

const run = promisify(execFile);
const ROOT = resolve(import.meta.dirname, "..");
const GUIDE = readFileSync(join(ROOT, "lab", "GUIDE.md"), "utf8");
const ALLOWED = /^(npx\s+)?(vitest(\s+run)?|tsc\s+-b|tsc\s+--noEmit|oxlint)(\s+[\w./@:=-]+)*$/;

export type { LabEvent };

type Run = {
  id: string;
  brief: string;
  dir: string;
  events: LabEvent[];
  listeners: Set<(e: LabEvent) => void>;
  finished: boolean;
  patch: string | null;
};

const runs = new Map<string, Run>();

const emit = (r: Run, e: LabEvent) => {
  r.events.push(e);
  for (const l of r.listeners) l(e);
};

export function labStatus() {
  return { key: !!process.env.FACTORY_API_KEY, runs: [...runs.values()].map((r) => ({ id: r.id, brief: r.brief, finished: r.finished })) };
}

export function startRun(brief: string): string {
  if (!process.env.FACTORY_API_KEY) throw new Error("FACTORY_API_KEY is not set.");
  const slug = brief.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24).replace(/^-|-$/g, "") || "game";
  const id = `${slug}-${Date.now().toString(36)}`;
  const r: Run = { id, brief, dir: join(ROOT, ".lab", id), events: [], listeners: new Set(), finished: false, patch: null };
  runs.set(id, r);
  void build(r)
    .catch((e: unknown) => emit(r, { kind: "error", text: e instanceof Error ? e.message : String(e) }))
    .finally(async () => {
      r.finished = true;
      /* the change is kept as a patch, so the copy can go */
      await run("git", ["worktree", "remove", "--force", r.dir], { cwd: ROOT }).catch(() => {});
    });
  return id;
}

export function subscribe(id: string, listener: (e: LabEvent) => void): (() => void) | null {
  const r = runs.get(id);
  if (!r) return null;
  for (const e of r.events) listener(e);
  r.listeners.add(listener);
  return () => r.listeners.delete(listener);
}

/* Apply the run's change to the app's own working tree. Vite sees the
   new files and reloads, and the game is in the picker. */
export async function adopt(id: string) {
  const r = runs.get(id);
  if (!r?.patch) throw new Error("Nothing to add from this run.");
  const file = join(tmpdir(), `telekinesis-${r.id}.patch`);
  writeFileSync(file, r.patch);
  await run("git", ["apply", "--3way", file], { cwd: ROOT });
  emit(r, { kind: "adopted" });
}

async function build(r: Run) {
  emit(r, { kind: "status", text: "Making a separate copy of the app for Droid to work in" });
  await run("git", ["worktree", "add", "--detach", r.dir, "HEAD"], { cwd: ROOT });
  /* the copy shares the app's packages, so tests run without an install */
  if (!existsSync(join(r.dir, "node_modules"))) symlinkSync(join(ROOT, "node_modules"), join(r.dir, "node_modules"), "dir");

  const inside = (path: string) => !relative(r.dir, resolve(r.dir, path)).startsWith("..");

  emit(r, { kind: "status", text: "Droid is reading the codebase" });
  const session = await createSession({
    cwd: r.dir,
    autonomyLevel: AutonomyLevel.Low,
    systemPrompt: { type: "preset", preset: "droid", append: GUIDE },
    /* anything Low autonomy doesn't already allow comes here: only the
       checks run, and only files in the worktree change */
    permissionHandler({ toolUses }) {
      const ok = toolUses.every(({ details }) => {
        if (details.type === ToolConfirmationType.Execute) return ALLOWED.test(details.fullCommand.trim());
        if (details.type === ToolConfirmationType.Edit || details.type === ToolConfirmationType.Create) return inside(details.filePath);
        return false;
      });
      if (!ok) emit(r, { kind: "denied", detail: toolUses.map((u) => describe(u.details)).join(", ") });
      return ok ? ToolConfirmationOutcome.ProceedOnce : ToolConfirmationOutcome.Cancel;
    },
  });

  let game: Built | null = null;
  try {
    const prompt = `The study team's brief:\n\n"""${r.brief}"""\n\nAdd this as a new game, following the guide in your instructions.`;
    for await (const m of session.stream(prompt, {
      outputFormat: {
        type: OutputFormatType.JsonSchema,
        schema: {
          type: "object",
          properties: { gameId: { type: "string" }, name: { type: "string" }, summary: { type: "string" } },
          required: ["gameId", "name", "summary"],
          additionalProperties: false,
        },
      },
    })) {
      if (m.type === DroidMessageType.Assistant && m.text.trim()) emit(r, { kind: "say", text: m.text.trim() });
      else if (m.type === DroidMessageType.ToolCall) emit(r, { kind: "tool", name: m.name, detail: summarise(m.input, r.dir) });
      else if (m.type === DroidMessageType.Result) {
        if (!m.success) emit(r, { kind: "error", text: m.error?.message ?? `Droid stopped: ${m.subtype}` });
        const out = m.structuredOutput as Built | undefined;
        if (out?.gameId) game = out;
      }
    }
  } finally {
    await session.close();
  }

  /* Droid says it's done; check for ourselves */
  emit(r, { kind: "status", text: "Checking Droid's work" });
  const checks = [
    { name: "Type check", cmd: ["tsc", "-b"] },
    { name: "Tests", cmd: ["vitest", "run"] },
  ];
  let ok = true;
  for (const c of checks) {
    const res = await run("npx", c.cmd, { cwd: r.dir, maxBuffer: 1 << 24 }).then(
      (o) => ({ ok: true, out: o.stdout + o.stderr }),
      (e: { stdout?: string; stderr?: string }) => ({ ok: false, out: (e.stdout ?? "") + (e.stderr ?? "") }),
    );
    ok &&= res.ok;
    emit(r, { kind: "check", name: c.name, ok: res.ok, output: tail(res.out) });
  }

  await run("git", ["add", "-A", "--", ".", ":!node_modules"], { cwd: r.dir });
  const { stdout: patch } = await run("git", ["diff", "--cached", "--binary", "HEAD"], { cwd: r.dir, maxBuffer: 1 << 24 });
  const { stdout: names } = await run("git", ["diff", "--cached", "--name-status", "HEAD"], { cwd: r.dir });
  r.patch = ok && patch ? patch : null;
  emit(r, { kind: "ready", game, files: names.trim().split("\n").filter(Boolean), patch, ok });
}

function summarise(input: unknown, dir: string): string {
  if (!input || typeof input !== "object") return "";
  const i = input as Record<string, unknown>;
  const v = i.file_path ?? i.filePath ?? i.path ?? i.command ?? i.pattern ?? i.query ?? "";
  return String(v).replaceAll(dir + "/", "").slice(0, 160);
}

function describe(d: { type: string } & Record<string, unknown>): string {
  return String(d.fullCommand ?? d.filePath ?? d.type);
}

const tail = (s: string) => s.trim().split("\n").slice(-25).join("\n");
