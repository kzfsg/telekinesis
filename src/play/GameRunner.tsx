import { useEffect, useRef, useState } from "react";
import LatticeLoader from "../components/bits/LatticeLoader";
import { Readout } from "../components/Readout";
import { createController, GAMES, type Hud } from "./controllers";
import type { PoseSource } from "./pose";
import type { SessionRecord } from "./session";
import { simulate, type GameId } from "./simulated";
import { createThermal } from "./thermal";
import { createCoach, loadMuted, saveMuted, type Coach } from "./voice";

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
  /* the voice coach, a GPT-Live session that's open only while it's
     switched on, since it bills by the second. The loop reaches it and
     the mute through refs, so switching it doesn't restart the game. */
  const [muted, setMuted] = useState(loadMuted);
  const [voiceDown, setVoiceDown] = useState(false);
  const [voiceTry, setVoiceTry] = useState(0);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const coachRef = useRef<Coach | null>(null);
  const finishedRef = useRef(false);

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
    const voice = GAMES[game].voice ?? {};
    let heard: Hud | null = null;
    const said = new Set<string>();
    const alertAt = new Map<string, number>();
    let toldSetup = false;

    /* what the coach says, given what changed on screen */
    const coachOn = (next: Hud, now: number) => {
      if (mutedRef.current) {
        heard = next;
        return;
      }
      if (next.alert && next.alert !== heard?.alert && now - (alertAt.get(next.alert) ?? -Infinity) > 6000) {
        alertAt.set(next.alert, now);
        coachRef.current?.say(next.alert, { urgent: true });
      } else if (next.instruction && next.instruction !== heard?.instruction && (voice.repeat || !said.has(next.instruction))) {
        said.add(next.instruction);
        coachRef.current?.say(next.instruction);
      }
      heard = next;
      if (coachRef.current?.failed) setVoiceDown(true);
    };

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
        if (frame?.landmarks || frame?.hand) {
          setFound(true);
          coachOn(next, now);
        } else if (!toldSetup && !mutedRef.current) {
          /* nobody in view yet: say how to set up, once */
          toldSetup = true;
          coachRef.current?.say(GAMES[game].setup);
        }
        /* a moment to see the final count before the result */
        if (controller.done) {
          finishedAt ??= now;
          finishedRef.current = true;
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
        source = mode === "camera" ? await (await import("./camera")).openCamera(GAMES[game].tracking, (s) => alive && setStage(s)) : simulate(game);
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

  useEffect(() => {
    if (muted) return;
    finishedRef.current = false;
    const coach = createCoach({ name: GAMES[game].name, setup: GAMES[game].setup });
    coachRef.current = coach;
    return () => {
      coachRef.current = null;
      /* a finishing game lets its last line play out */
      coach.stop(finishedRef.current);
    };
  }, [muted, game, mode, voiceTry]);

  const info = GAMES[game];

  return (
    <section className="runner" aria-label={`${info.name}, ${mode === "demo" ? "demo" : "live"}`}>
      <div className="runner-top">
        <div>
          <h1 className="runner-title">{info.name}</h1>
          <span className="runner-sub">
            {mode === "demo" ? "Demo: a simulated participant is playing" : `Mirrors the ${info.mirrors.toLowerCase()}`}
            {info.condition ? ` · ${info.condition}` : ""}
          </span>
        </div>
        <div className="runner-readouts" aria-live="polite">
          {hud?.readouts.map((r) => (
            <Readout key={r.label} tone="night" label={r.label} value={r.value} unit={r.unit} />
          ))}
        </div>
        <button
          type="button"
          className="runner-exit runner-voice"
          aria-pressed={!muted && !voiceDown}
          title={voiceDown ? "The voice coach couldn't be reached; try again" : muted ? "Turn on spoken guidance, by GPT-Live" : "Turn off spoken guidance and close the GPT-Live session"}
          onClick={() => {
            if (voiceDown) {
              setVoiceDown(false);
              if (muted) {
                setMuted(false);
                saveMuted(false);
              } else setVoiceTry((n) => n + 1);
              return;
            }
            setMuted(!muted);
            saveMuted(!muted);
          }}
        >
          {voiceDown ? "GPT-Live unavailable" : muted ? "GPT-Live off" : "GPT-Live on"}
        </button>
        <button type="button" className="runner-exit" onClick={onExit}>
          End game
        </button>
      </div>

      <div className="stage">
        <canvas ref={canvas} className="stage-canvas" aria-hidden="true" />

        {status === "loading" && (
          <div className="stage-cover">
            <LatticeLoader
              label={mode === "demo" ? "Starting the demo" : stage === "asking" ? "Asking to use the camera" : `Loading the ${info.tracking === "hand" ? "hand" : "body"} tracker`}
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
            <LatticeLoader label={info.tracking === "hand" ? "Finding your hand" : "Finding you in the camera"} pattern="ripple" color="#FF9628" glow glowColor="#FF323C" showTimer={false} fontSize={18} />
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
            {hud.alert && (
              <p className="stage-alert" role="status">
                <span aria-hidden="true">!</span> {hud.alert}
              </p>
            )}
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
