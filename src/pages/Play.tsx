import { useState } from "react";
import { SiteNav } from "../components/SiteNav";
import { GAMES } from "../play/controllers";
import { GameRunner, type Mode } from "../play/GameRunner";
import { Result } from "../play/Result";
import { saveSession, type SessionRecord } from "../play/session";
import type { GameId } from "../play/simulated";
import "../play/play.css";

type View = { kind: "hub" } | { kind: "game"; game: GameId; mode: Mode; run: number } | { kind: "result"; record: SessionRecord; mode: Mode };

const ORDER: GameId[] = ["chair-rise", "floor-rise", "tap", "reach"];

/* The games, for real: pick one, play it with the camera or watch a
   simulated participant play it, and see what it measured. */
export default function Play() {
  const [view, setView] = useState<View>({ kind: "hub" });
  const [mode, setMode] = useState<Mode>("camera");

  if (view.kind === "game") {
    return (
      <main className="play play-live">
        <GameRunner
          key={view.run}
          game={view.game}
          mode={view.mode}
          onExit={() => setView({ kind: "hub" })}
          onDemo={() => {
            setMode("demo");
            setView({ kind: "game", game: view.game, mode: "demo", run: Date.now() });
          }}
          onDone={(record) => {
            saveSession(record);
            setView({ kind: "result", record, mode: view.mode });
          }}
        />
      </main>
    );
  }

  if (view.kind === "result") {
    return (
      <main className="play play-live">
        <Result
          record={view.record}
          onAgain={() => setView({ kind: "game", game: view.record.game, mode: view.mode, run: Date.now() })}
          onHub={() => setView({ kind: "hub" })}
        />
      </main>
    );
  }

  return (
    <>
      <SiteNav current="play" />
      <main className="play play-hub" data-dark>
        <div className="hub">
          <div className="hub-head">
            <h1>Pick a game</h1>
            <p>
              Each one takes under a minute. Your camera tracks how you move, or how your fingers tap, right here in the browser; the video never
              leaves this device.
            </p>
          </div>

          <div className="hub-mode" role="radiogroup" aria-label="How to play">
            <button type="button" role="radio" aria-checked={mode === "camera"} className={mode === "camera" ? "is-on" : ""} onClick={() => setMode("camera")}>
              <strong>Use my camera</strong>
              <span>Play it yourself</span>
            </button>
            <button type="button" role="radio" aria-checked={mode === "demo"} className={mode === "demo" ? "is-on" : ""} onClick={() => setMode("demo")}>
              <strong>Watch the demo</strong>
              <span>A simulated participant plays</span>
            </button>
          </div>

          <ul className="hub-games">
            {ORDER.map((id) => {
              const g = GAMES[id];
              return (
                <li key={id}>
                  <button type="button" className="hub-game" onClick={() => setView({ kind: "game", game: id, mode, run: Date.now() })}>
                    <span className="hub-game-name">{g.name}</span>
                    <span className="hub-game-for">{g.condition ?? "General mobility"}</span>
                    <span className="hub-game-measures">{g.measures}</span>
                    <span className="hub-game-setup">{g.setup}</span>
                    <span className="hub-game-mirrors">Mirrors the {g.mirrors.toLowerCase()}</span>
                    <span className="hub-game-go">{mode === "camera" ? "Play" : "Watch"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </>
  );
}
