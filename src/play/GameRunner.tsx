import { useEffect, useRef, useState } from "react";
import LatticeLoader from "../components/bits/LatticeLoader";
import { Readout } from "../components/Readout";
import { createController, GAMES, type Hud } from "./controllers";
import type { PoseSource } from "./pose";
import type { SessionRecord } from "./session";
import { simulate, type GameId } from "./simulated";
import { createThermal } from "./thermal";

export type Mode = "camera" | "demo";

/* One game, live: the source of frames, the game reading them, the
   thermal view drawing them, and the numbers over the top. The loop
   runs every animation frame; the numbers are handed to React only
   when they change, so the page isn't re-rendered sixty times a
   second for a count that moves every two. */
export function GameRunner({
  game,
  mode,
  onDone,
  onExit,
  onDemo,
}: {
  game: GameId;
  mode: Mode;
  onDone: (r: SessionRecord) => void;
  onExit: () => void;
  onDemo: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "running" | "error">("loading");
  const [error, setError] = useState("");
  const [hud, setHud] = useState<Hud | null>(null);
  const [found, setFound] = useState(false);
  /* still waiting on the camera after a few seconds: most often the
     browser's permission prompt, sitting unanswered */
  const [slow, setSlow] = useState(false);
  const [stage, setStage] = useState<"asking" | "tracker">("asking");

  useEffect(() => {
    if (status !== "loading" || mode !== "camera") return;
    setSlow(false);
    const id = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(id);
  }, [status, mode, stage]);

  useEffect(() => {
    let source: PoseSource | null = null;
    let raf = 0;
    let alive = true;
    let finishedAt: number | null = null;
    const controller = createController(game);
    const thermal = createThermal();
    let lastKey = "";

    const loop = (now: number) => {
      if (!alive || !source) return;
      const c = canvas.current;
      const ctx = c?.getContext("2d");
      if (c && ctx) {
        /* match the canvas to its box, at the screen's density */
        const r = Math.min(2, window.devicePixelRatio || 1);
        const w = Math.round(c.clientWidth * r), h = Math.round(c.clientHeight * r);
        if (c.width !== w || c.height !== h) {
          c.width = w;
          c.height = h;
        }
        const frame = source.read(now);
        const next = controller.update(frame, now);
        thermal.draw(ctx, frame, source.video);
        controller.overlay(ctx, now);
        const key = JSON.stringify(next);
        if (key !== lastKey) {
          lastKey = key;
          setHud(next);
        }
        if (frame?.landmarks) setFound(true);
        /* a moment to see the final count before the result */
        if (controller.done) {
          finishedAt ??= now;
          if (now - finishedAt > 1400) {
            alive = false;
            onDone(controller.record(mode === "demo"));
            return;
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };

    (async () => {
      try {
        /* the tracker is only fetched when the camera is actually used */
        source = mode === "camera" ? await (await import("./camera")).openCamera((s) => alive && setStage(s)) : simulate(game);
        if (!alive) {
          source.stop();
          return;
        }
        setStatus("running");
        raf = requestAnimationFrame(loop);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error && "kind" in e ? e.message : "Something went wrong starting the camera.");
        setStatus("error");
      }
    })();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      source?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, mode]);

  const info = GAMES[game];

  return (
    <section className="runner" aria-label={`${info.name}, ${mode === "demo" ? "demo" : "live"}`}>
      <div className="runner-top">
        <div>
          <h1 className="runner-title">{info.name}</h1>
          <span className="runner-sub">{mode === "demo" ? "Demo: a simulated participant is playing" : `Mirrors the ${info.mirrors.toLowerCase()}`}</span>
        </div>
        <div className="runner-readouts" aria-live="polite">
          {hud?.readouts.map((r) => (
            <Readout key={r.label} tone="night" label={r.label} value={r.value} unit={r.unit} />
          ))}
        </div>
        <button type="button" className="runner-exit" onClick={onExit}>
          End game
        </button>
      </div>

      <div className="stage">
        <canvas ref={canvas} className="stage-canvas" aria-hidden="true" />

        {status === "loading" && (
          <div className="stage-cover">
            <LatticeLoader
              label={mode === "demo" ? "Starting the demo" : stage === "asking" ? "Asking to use the camera" : "Loading the body tracker"}
              pattern="ripple"
              color="#FF9628"
              glow
              glowColor="#FF323C"
              showTimer={false}
              fontSize={18}
            />
            {mode === "camera" && (
              <p>
                {stage === "tracker"
                  ? "The first time takes a little while. After that it's quick."
                  : slow
                    ? "Still waiting for the camera. Look for the request next to the address bar, and choose Allow."
                    : "Your browser will ask to use the camera. The video stays on this device."}
              </p>
            )}
            {mode === "camera" && stage === "asking" && slow && (
              <button type="button" className="runner-exit" onClick={onDemo}>
                Watch the demo instead
              </button>
            )}
          </div>
        )}

        {status === "running" && !found && (
          <div className="stage-cover stage-cover-soft">
            <LatticeLoader label="Finding you in the camera" pattern="ripple" color="#FF9628" glow glowColor="#FF323C" showTimer={false} fontSize={18} />
            <p>{info.setup}</p>
          </div>
        )}

        {status === "error" && (
          <div className="stage-cover">
            <p className="stage-error">{error}</p>
            <div className="stage-actions">
              <button type="button" className="runner-exit runner-exit-solid" onClick={onDemo}>
                Watch the demo instead
              </button>
              <button type="button" className="runner-exit" onClick={onExit}>
                Back to the games
              </button>
            </div>
          </div>
        )}

        {hud && found && (
          <>
            <div className="stage-count">
              <span className="stage-big">{hud.big}</span>
              <span className="stage-big-label">{hud.bigLabel}</span>
              {hud.meter !== null && (
                <span className="stage-meter" aria-label={`${hud.meterLabel} ${Math.round(hud.meter * 100)}%`}>
                  <i style={{ height: `${Math.round(hud.meter * 100)}%` }} />
                </span>
              )}
            </div>
            <p className="stage-instruction" aria-live="polite">
              {hud.instruction}
            </p>
            {hud.progress !== null && (
              <span className="stage-progress" role="progressbar" aria-label={hud.progressLabel} aria-valuenow={Math.round(hud.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                <i style={{ width: `${hud.progress * 100}%` }} />
              </span>
            )}
          </>
        )}
      </div>
    </section>
  );
}
