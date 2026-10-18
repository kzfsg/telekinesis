import CursorGrid from "../components/bits/CursorGrid";
import { HeatMap } from "../components/HeatMap";
import { HeatLink } from "../components/HeatButton";
import { Icon } from "../components/Icon";
import { Logo } from "../components/Logo";
import { Readout } from "../components/Readout";
import { SessionHeatmap } from "../components/SessionHeatmap";
import { SiteNav } from "../components/SiteNav";
import { TwinChart, type TwinPoint } from "../components/TwinChart";
import { YearGrid } from "../components/YearGrid";
import { useWidth } from "../hooks/useWidth";
import "./landing.css";

const STEPS = [
  { title: "Play at home", body: "Five minutes a day on the laptop or TV they already own. Nothing to ship, nothing to wear." },
  { title: "Measured as they move", body: "The camera tracks each joint in the browser. A phone in the hand adds tremor and wrist rotation." },
  { title: "Their twin stays current", body: "Each session updates a digital twin that predicts how they would have progressed untreated." },
  { title: "The team sees the gap", body: "Participant against twin, week by week, with adherence and anything that needs a call." },
];

const GAMES = [
  {
    name: "Rise",
    mirrors: "30-second chair stand test",
    status: { kind: "good" as const, text: "Improving" },
    note: "Best of the week is 14 rises, up 3 since the start. The twin predicts 9.8 without treatment.",
    reading: { label: "Rises", value: "14", unit: " in 30 s" },
  },
  {
    name: "Reach",
    mirrors: "Range-of-motion exam",
    status: { kind: "warn" as const, text: "Down 18%" },
    note: "Left shoulder range has dropped since week 8. Worth asking about at the next check-in.",
    reading: { label: "Left shoulder", value: "124", unit: "°" },
  },
  {
    name: "Tap",
    mirrors: "Finger-tapping item of a motor exam",
    status: { kind: "good" as const, text: "Stable" },
    note: "Pace and rhythm are unchanged across four weeks. Taps still fade a little by the tenth second.",
    reading: { label: "Pace", value: "4.1", unit: " taps a second" },
  },
];

/* the conditions the games were built for, and what each one does */
const CONDITIONS = [
  {
    name: "Duchenne muscular dystrophy",
    assessed: "Functional tasks such as standing from a chair, rising from the floor and walking are used in mobility assessment.",
    built: "Rise",
    prototype: ["Chair-rise counting", "Failed attempts, and how long each stand took", "Recording-quality flags"],
  },
  {
    name: "Parkinson's disease",
    assessed: "Motor assessments include finger tapping and other repeated movements.",
    built: "Tap",
    prototype: ["Hand landmark tracking", "Tapping frequency and regularity", "Fade in amplitude, and stalls"],
  },
];

/* the North Star's tasks, plainly; one is what Rise simplifies */
const NSAA_TASKS = ["Stand", "Walk", "Stand up from chair", "Stand on one leg", "Climb box step", "Get to sitting", "Rise from floor", "Jump", "Run 10 m"];

const QUALITY_CHECKS = ["Head and feet in view", "Close enough to measure", "Clear enough to track", "Camera and chair stayed put", "Arms crossed over the chest", "Steady video, 15+ frames a second"];

const MONTH: (number | null)[][] = [
  [6, 7, null, 8, 7, 9, null],
  [8, 9, 9, null, 10, 11, 7],
  [10, 9, 12, 11, null, null, 6],
  [11, 12, 12, 13, 12, null, 13],
];

const OBSERVED = [11, 11, 12, 11, 12, 12, 13, 12, 13, 13, 14];
const TWIN: TwinPoint[] = Array.from({ length: 25 }, (_, w) => {
  const twin = 11 - 0.12 * w;
  const spread = 0.6 + 0.05 * w;
  return { week: w, observed: OBSERVED[w], twin, low: twin - spread, high: twin + spread };
});

const TRACE = [
  { t: "00:00", what: "Camera on", detail: "Found the participant, 33 body points tracked" },
  { t: "00:06", what: "Calibrated", detail: "Chair height and leg length measured" },
  { t: "00:10", what: "Rise 1", detail: "Knee from 94° to 176° in 1.9 s" },
  { t: "00:24", what: "Rise 8", detail: "Slower stand, hips lead the knees" },
  { t: "00:40", what: "Done", detail: "14 rises in 30 seconds" },
  { t: "00:41", what: "Sent", detail: "Score and joint angles, 3 KB" },
];

export default function Landing() {
  const [closeBox, closeWidth] = useWidth<HTMLDivElement>();

  return (
    <>
      <SiteNav current="home" />

      {/* ── hero: the one place the page itself is a heat camera ── */}
      <header className="hero" data-dark>
        <div className="hero-heat" aria-hidden="true">
          <CursorGrid heat neon cellSize={18} cellGap={2} cellRadius={2} radius={110} fillOpacity={0.34} maxOpacity={0.34} gridOpacity={0.07} gridColor="#3A4680" holdTime={300} fadeDuration={2200} spotlight={0.15} edgeFade={0.04} clickPulse pulseSpeed={700} autoPulse={10} intro={false} />
        </div>
        <div className="hero-inner">
          <Logo />
          <p className="hero-lede">Remote clinical trials in the comfort of your own home.</p>
        </div>
      </header>

      <main>
        {/* ── the bottleneck ─────────────────────────────── */}
        <section className="ls" aria-labelledby="problem">
          <div className="ls-inner split">
            <div>
              <h2 id="problem">Trials run on clinic visits.</h2>
              <p className="ls-body">
                Trials in Parkinson's, ALS, muscular dystrophy and stroke hinge on how well people move. That is measured
                at site visits: a handful of snapshots a year, rated by eye.
              </p>
              <p className="ls-body">
                Every one of them means a journey for someone who finds moving hard, and a slot on a site's calendar.
              </p>
              <ul className="biglist">
                <li>
                  4 snapshots a year
                </li>
                <li>
                  $3,562 a visit<cite>Moore et al., 2018</cite>
                </li>
                <li>
                  44% more procedures<cite>since 2009, Tufts CSDD</cite>
                </li>
              </ul>
            </div>
            <YearGrid
              marks={[
                { week: 0, label: "Start" },
                { week: 12, label: "Wk 12" },
                { week: 24, label: "Wk 24" },
                { week: 51, label: "Wk 52" },
              ]}
              caption="One participant's year of motor data in a typical trial schedule. Illustrative."
            />
          </div>
        </section>

        {/* ── how it works ───────────────────────────────── */}
        <section id="how" className="ls ls-white" aria-labelledby="how-title">
          <div className="ls-inner">
            <h2 id="how-title">How Telekinesis works</h2>
            <ol className="steps">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <span className="step-n" aria-hidden="true">
                    {i + 1}
                  </span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── the shift, in two numbers ──────────────────── */}
        <section className="ls ls-night" data-dark aria-labelledby="shift">
          <div className="ls-inner">
            <h2 id="shift">Turn four snapshots a year into a reading most days.</h2>
            <div className="shift">
              <div>
                <span className="shift-n shift-cold">4</span>
                <span className="shift-label">clinic assessments a year</span>
              </div>
              <div>
                <span className="shift-n shift-hot">260</span>
                <span className="shift-label">home sessions a year, at five a week</span>
              </div>
            </div>
            <p className="ls-body">
              Each session is five minutes in the living room. Clinic visits stay for what needs a clinic, and the study
              sees how movement changes between them.
            </p>
          </div>
        </section>

        {/* ── one participant ────────────────────────────── */}
        <section id="example" className="ls" aria-labelledby="example-title">
          <div className="ls-inner">
            <div className="example-head">
              <h2 id="example-title">One participant's month, measured.</h2>
              <div className="who">
                <span className="who-mark" aria-hidden="true">
                  P
                </span>
                <div>
                  <strong>Participant P-014</strong>
                  <span>Parkinson's trial, week 10 of 24. Treatment arm blinded.</span>
                </div>
              </div>
            </div>
            <ul className="gamecards">
              {GAMES.map((g) => (
                <li key={g.name}>
                  <div className="gamecard-top">
                    <div>
                      <h3>{g.name}</h3>
                      <span className="muted small">Mirrors the {g.mirrors.toLowerCase()}</span>
                    </div>
                    <span className={`status status-${g.status.kind}`}>
                      <Icon kind={g.status.kind} /> {g.status.text}
                    </span>
                  </div>
                  <p>{g.note}</p>
                  <Readout label={g.reading.label} value={g.reading.value} unit={g.reading.unit} />
                </li>
              ))}
            </ul>
            <div className="month">
              <SessionHeatmap weeks={MONTH} firstWeek={7} />
              <p className="month-sum">
                22 of 28 days moved.
                <span>4.2 rises ahead of the twin.</span>
              </p>
            </div>
          </div>
        </section>

        {/* ── the data ───────────────────────────────────── */}
        <section id="data" className="ls ls-white" aria-labelledby="data-title">
          <div className="ls-inner">
            <h2 id="data-title">Measurements, not footage.</h2>
            <p className="ls-body">
              Every session comes back as numbers a study team can trust, with a trace of what was measured, what was sent,
              and what never left the room.
            </p>
            <div className="data-panels">
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Chair rise, P-014</h3>
                    <span className="muted small">Best weekly score against the twin's prediction</span>
                  </div>
                  <span className="status status-good">
                    <Icon kind="good" /> Ahead of twin
                  </span>
                </div>
                <TwinChart data={TWIN} unit="Chair rises in 30 seconds" yMax={16} />
                <p className="panel-next">
                  <strong>Next step</strong> Keep the schedule. Ask about the left shoulder at the week 12 visit.
                </p>
              </div>
              <div className="panel panel-trace">
                <div className="trace-top">
                  <div>
                    <span className="muted small">Session</span>
                    <strong>41 s</strong>
                  </div>
                  <div>
                    <span className="muted small">Status</span>
                    <strong>Sent</strong>
                  </div>
                </div>
                <ol className="trace">
                  {TRACE.map((r) => (
                    <li key={r.t}>
                      <span className="trace-t">{r.t}</span>
                      <span className="trace-what">{r.what}</span>
                      <span className="trace-detail">{r.detail}</span>
                    </li>
                  ))}
                </ol>
                <div className="trace-checks">
                  <span className="muted small">Checks</span>
                  <ul>
                    <li>
                      <Icon kind="good" /> Whole body in frame
                    </li>
                    <li>
                      <Icon kind="good" /> Arms crossed throughout
                    </li>
                    <li>
                      <Icon kind="good" /> No help from the chair arms
                    </li>
                  </ul>
                </div>
                <div className="trace-split">
                  <div>
                    <span className="muted small">Sent</span>
                    <ul>
                      <li>Joint angles</li>
                      <li>Timings</li>
                      <li>Score</li>
                    </ul>
                  </div>
                  <div>
                    <span className="muted small">Kept on the device</span>
                    <ul>
                      <li>Video</li>
                      <li>Face</li>
                      <li>The room</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── the conditions ─────────────────────────────── */}
        <section id="conditions" className="ls" aria-labelledby="conditions-title">
          <div className="ls-inner">
            <h2 id="conditions-title">Built around two conditions.</h2>
            <ul className="conditions">
              {CONDITIONS.map((c) => (
                <li key={c.name}>
                  <h3>{c.name}</h3>
                  <p>{c.assessed}</p>
                  <div className="condition-built">
                    <span className="muted small">Prototype, in the game {c.built}</span>
                    <ul>
                      {c.prototype.map((x) => (
                        <li key={x}>
                          <Icon kind="good" /> {x}
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── case study ─────────────────────────────────── */}
        <section id="case-study" className="ls ls-night" data-dark aria-labelledby="case-title">
          <div className="ls-inner split">
            <div>
              <span className="case-kicker">Case study</span>
              <h2 id="case-title">DMD and the North Star Ambulatory Assessment.</h2>
              <p className="ls-body">
                Published work has evaluated remote video-based functional assessments in Duchenne muscular dystrophy,
                including movement tasks such as rising and walking.
              </p>
              <p className="ls-body">Telekinesis explores automatic capture and technical quality flags for one simplified task.</p>
            </div>
            <div className="case">
              <div className="case-block">
                <span className="muted small">Tasks in the assessment, a selection</span>
                <ul className="case-tasks">
                  {NSAA_TASKS.map((t) => (
                    <li key={t} className={t === "Stand up from chair" ? "is-on" : ""}>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="case-block">
                <span className="muted small">What Rise captures, automatically</span>
                <p>Each full stand, counted, with how long it took. Rises that sink back before standing, counted apart.</p>
              </div>
              <div className="case-block">
                <span className="muted small">Checked on every recording</span>
                <ul className="case-checks">
                  {QUALITY_CHECKS.map((c) => (
                    <li key={c}>
                      <Icon kind="good" /> {c}
                    </li>
                  ))}
                </ul>
                <p className="case-note">A failed check doesn't change the score. It marks the session for a person to look at.</p>
              </div>
              <HeatLink href="/play" size="m">
                Try Rise
              </HeatLink>
            </div>
          </div>
        </section>

        {/* ── close ──────────────────────────────────────── */}
        <section className="ls ls-close" aria-labelledby="close-title">
          <div ref={closeBox} className="ls-inner close">
            {closeWidth > 0 && (
              <HeatMap word="keep moving" shape="Word" auto period={10} cycle={false} label="Keep moving" width={closeWidth} height={Math.round(closeWidth * 0.2)} soft={12} heat={55} area={70} />
            )}
            <p id="close-title" className="close-line">
              Let the next assessment happen at home.
            </p>
            <HeatLink href="/play" size="l">
              Try the games
            </HeatLink>
          </div>
        </section>
      </main>

      <footer className="lfoot">
        <a className="sitenav-name" href="/">
          telekinesis
        </a>
        <span>
          Built at HackHarvard 2026 for the Regeneron track. Participant data shown is illustrative.{" "}
          <a href="/design">Design system</a>
        </span>
      </footer>
    </>
  );
}
