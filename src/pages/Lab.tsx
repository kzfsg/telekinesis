import { useEffect, useRef, useState } from "react";
import { HeatButton } from "../components/HeatButton";
import { SiteNav } from "../components/SiteNav";
import type { LabEvent } from "../../lab/events";
import "../play/play.css";
import "./lab.css";

/* The Lab: a study team writes down a movement test the way they'd
   describe it to a colleague, and Droid, Factory's coding agent,
   builds it into a game in a separate copy of the app: the game, its
   tests, a simulated participant for the demo. The server then runs
   the checks itself, and the team decides whether to add it. Droid
   runs on this machine, so the Lab works on the dev server only. */

const EXAMPLES = [
  "Single-leg stance: stand on one leg for up to 30 seconds, then the other. Measure how long each leg holds before the raised foot comes down.",
  "Five times sit-to-stand: stand up from a chair and sit back down five times as fast as possible, arms crossed. Measure the total time.",
  "Forward arm raise: lift each straight arm forward and overhead. Measure how high each shoulder can raise its arm to the front.",
];

type Status = { key: boolean } | null;

export default function Lab() {
  const [status, setStatus] = useState<Status>(null);
  const [offline, setOffline] = useState(false);
  const [brief, setBrief] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<LabEvent[]>([]);
  const [adding, setAdding] = useState(false);
  const log = useRef<HTMLOListElement>(null);

  useEffect(() => {
    fetch("/api/lab/status")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setStatus)
      .catch(() => setOffline(true));
  }, []);

  useEffect(() => {
    if (!runId) return;
    const es = new EventSource(`/api/lab/runs/${runId}/events`);
    es.onmessage = (m) => setEvents((all) => [...all, JSON.parse(m.data) as LabEvent]);
    return () => es.close();
  }, [runId]);

  useEffect(() => {
    log.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
  }, [events]);

  const start = async () => {
    const r = await fetch("/api/lab/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief }) });
    const { id } = (await r.json()) as { id: string };
    setEvents([]);
    setRunId(id);
  };

  const add = async () => {
    setAdding(true);
    await fetch(`/api/lab/runs/${runId}/adopt`, { method: "POST" }).finally(() => setAdding(false));
  };

  const ready = events.find((e) => e.kind === "ready");
  const adopted = events.some((e) => e.kind === "adopted");
  const failed = events.find((e) => e.kind === "error");
  const working = !!runId && !ready && !failed;

  return (
    <>
      <SiteNav current="lab" />
      <main className="play play-hub lab" data-dark>
        <div className="hub">
          <div className="hub-head">
            <h1>Lab</h1>
            <p>
              Describe a movement test in plain words. Droid, Factory's coding agent, builds it into a new game, with tests and a demo, in a separate copy of the app.
              Nothing changes here until you add it.
            </p>
          </div>

          {offline && <p className="lab-note">The Lab runs Droid on your own machine. Start it with <code>npm run dev</code> and open it from there.</p>}
          {status && !status.key && (
            <p className="lab-note">
              Droid needs a Factory API key. Add <code>FACTORY_API_KEY</code> to <code>.env.local</code> and restart the dev server.
            </p>
          )}

          <section className="lab-brief" aria-label="The test to build">
            <label htmlFor="brief">The test</label>
            <textarea
              id="brief"
              rows={4}
              value={brief}
              disabled={working}
              placeholder="What the participant does, and what to measure."
              onChange={(e) => setBrief(e.target.value)}
            />
            <div className="lab-examples">
              {EXAMPLES.map((x) => (
                <button key={x} type="button" disabled={working} onClick={() => setBrief(x)}>
                  {x.split(":")[0]}
                </button>
              ))}
            </div>
            <HeatButton size="l" disabled={working || !brief.trim() || !status?.key} onClick={start}>
              {working ? "Droid is building…" : "Build the game"}
            </HeatButton>
          </section>

          {runId && (
            <section className="lab-run" aria-label="What Droid is doing" aria-live="polite">
              <ol ref={log} className="lab-log">
                {events.map((e, i) => (
                  <Line key={i} e={e} />
                ))}
                {working && <li className="lab-line lab-wait">working</li>}
              </ol>

              {ready && ready.kind === "ready" && (
                <div className="lab-ready">
                  <h2>{ready.ok ? (ready.game ? `${ready.game.name} is ready` : "The game is ready") : "Droid's change didn't pass the checks"}</h2>
                  {ready.game && <p>{ready.game.summary}</p>}
                  <ul className="lab-files">
                    {ready.files.map((f) => (
                      <li key={f}>
                        <code>{f.replace(/\t/, " ")}</code>
                      </li>
                    ))}
                  </ul>
                  <details>
                    <summary>The full change</summary>
                    <pre>{ready.patch}</pre>
                  </details>
                  <div className="lab-actions">
                    {ready.ok && !adopted && (
                      <HeatButton size="l" disabled={adding} onClick={add}>
                        {adding ? "Adding…" : "Add it to the app"}
                      </HeatButton>
                    )}
                    {adopted && ready.game && (
                      <a className="hbtn hbtn-solid hbtn-l" href={`/play?game=${ready.game.gameId}&mode=demo`}>
                        Watch {ready.game.name} played
                      </a>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </>
  );
}

function Line({ e }: { e: LabEvent }) {
  switch (e.kind) {
    case "status":
      return <li className="lab-line lab-status">{e.text}</li>;
    case "say":
      return <li className="lab-line lab-say">{e.text}</li>;
    case "tool":
      return (
        <li className="lab-line lab-tool">
          <b>{e.name}</b> <code>{e.detail}</code>
        </li>
      );
    case "denied":
      return (
        <li className="lab-line lab-denied">
          <b>Refused</b> <code>{e.detail}</code>
        </li>
      );
    case "check":
      return (
        <li className={`lab-line lab-check ${e.ok ? "is-ok" : "is-bad"}`}>
          <details>
            <summary>
              {e.name}: {e.ok ? "passed" : "failed"}
            </summary>
            <pre>{e.output}</pre>
          </details>
        </li>
      );
    case "adopted":
      return <li className="lab-line lab-status">Added to the app. The game picker now has it.</li>;
    case "error":
      return <li className="lab-line lab-denied">{e.text}</li>;
    default:
      return null;
  }
}
