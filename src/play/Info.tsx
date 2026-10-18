import { GAMES } from "./controllers";
import { GUIDANCE, RESEARCH } from "./research";
import type { GameId } from "./simulated";

/* One game, explained: why its movement matters, how its numbers
   could help test a treatment, and the research behind it, linked
   so anyone can read the source. */
export function Info({ game, onPlay, onBack }: { game: GameId; onPlay: () => void; onBack: () => void }) {
  const g = GAMES[game];
  const r = RESEARCH[game];
  return (
    <article className="info" aria-labelledby="info-title">
      <button type="button" className="runner-exit info-back" onClick={onBack}>
        Back to the games
      </button>

      <header className="info-head">
        <span className="hub-game-for">{g.condition ?? "General mobility"}</span>
        <h1 id="info-title">{g.name}</h1>
        <p className="info-mirrors">Mirrors the {g.mirrors.toLowerCase()}</p>
        <p className="info-why">{r.why}</p>
        <button type="button" className="hbtn hbtn-solid hbtn-l result-solid" onClick={onPlay}>
          Play {g.name}
        </button>
      </header>

      <section aria-labelledby="info-trial">
        <h2 id="info-trial">How the data could help test a treatment</h2>
        <ol className="info-trial">
          {r.trial.map((t, i) => (
            <li key={t.title}>
              <span className="info-n" aria-hidden="true">
                {i + 1}
              </span>
              <h3>{t.title}</h3>
              <p>{t.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="info-research">
        <h2 id="info-research">The research behind it</h2>
        <ul className="info-papers">
          {r.papers.map((p) => (
            <li key={p.url}>
              <a href={p.url} target="_blank" rel="noreferrer">
                <span className="info-cite">
                  {p.authors} ({p.year}). <em>{p.journal}</em>
                </span>
                <span className="info-title">{p.title}</span>
                <span className="info-finding">{p.finding}</span>
                <span className="info-link">Read on PubMed ↗</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="info-guidance">
          For how regulators expect a remote measure to be shown fit for a trial, see{" "}
          <a href={GUIDANCE.url} target="_blank" rel="noreferrer">
            {GUIDANCE.title}
          </a>
          , {GUIDANCE.source}.
        </p>
        <p className="info-note">
          Telekinesis is a research prototype. Its measures have not been validated against clinical ratings, and it is
          not for diagnosis.
        </p>
      </section>
    </article>
  );
}
