import { useRef } from "react";
import { HeatMap } from "../components/HeatMap";
import { Icon } from "../components/Icon";
import { Logo } from "../components/Logo";
import { PatientScreen } from "../components/PatientScreen";
import { TeamScreen } from "../components/TeamScreen";
import { SiteNav } from "../components/SiteNav";
import { HeatButton } from "../components/HeatButton";
import { Readout } from "../components/Readout";
import CursorGrid from "../components/bits/CursorGrid";
import HoldButton from "../components/bits/HoldButton";
import LatticeLoader from "../components/bits/LatticeLoader";
import SpotlightCard from "../components/bits/SpotlightCard";
import VariableProximity from "../components/bits/VariableProximity";

const HEAT = [
  { name: "Core", hex: "#0C2C96", use: "Still. Also every action" },
  { name: "Deep", hex: "#2878F5", use: "Barely moving" },
  { name: "Chill", hex: "#78D7FF", use: "Starting to move" },
  { name: "Glow", hex: "#FFE464", use: "Moving" },
  { name: "Ember", hex: "#FF9628", use: "Working" },
  { name: "Flare", hex: "#FF323C", use: "Working hard" },
  { name: "Rim", hex: "#FF5ABE", use: "Moving most. Also focus" },
];

const COLD = [
  { name: "Night", hex: "#0A1233", use: "The camera's view" },
  { name: "Frost", hex: "#E8EDF2", use: "The page" },
  { name: "Card", hex: "#F7F9FB", use: "Instruments" },
  { name: "Line", hex: "#D3DBE4", use: "Rules and grid" },
  { name: "Ash", hex: "#96969A", use: "Anything at rest" },
  { name: "Ink", hex: "#0E1A3D", use: "Text" },
];


export default function DesignSystem() {
  const typeBox = useRef<HTMLDivElement>(null);

  return (
    <>
    <SiteNav current="design" />
    <main className="board board-under-nav">
      <header className="mast">
        <Logo />
        <div className="mast-text">
          <p className="lede">Remote clinical trials in the comfort of your own home.</p>
          <p className="note">
            Short motor games, tracked by camera and phone, that keep each trial participant's digital twin current.
            This is the design system: one idea, taken from how a heat camera sees.
          </p>
        </div>
      </header>

      {/* ── the idea ─────────────────────────────────────── */}
      <section className="row" aria-labelledby="idea">
        <div className="row-head">
          <h2 id="idea">Cold until it moves</h2>
          <p>
            A heat camera shows a still room as cold. Telekinesis works the same way: nothing carries colour until a
            body moves or a hand reaches for it, and the warmth fades once it stops.
          </p>
        </div>
        <div className="rules">
          <figure className="rule">
            <div className="rule-stage rule-stage-plain">
              <HeatMap shape="Dots" seed={4} cycle={false} label="A field of dots at rest" width={240} height={136} heat={60} />
            </div>
            <figcaption>
              <strong>At rest, ash.</strong> Idle things are grey, never tinted. Point at the dots.
            </figcaption>
          </figure>
          <figure className="rule">
            <SpotlightCard className="rule-stage rule-spot" theme="light" spotlightColor="#FF9628" intensity={0.9} spotlightSize={200} borderGlow={0.9}>
              <span className="rule-spot-text">Warmth gathers under your hand</span>
            </SpotlightCard>
            <figcaption>
              <strong>Heat follows the hand.</strong> Surfaces warm where they are touched, not all at once.
            </figcaption>
          </figure>
          <figure className="rule">
            <div className="rule-stage rule-stage-grid">
              <CursorGrid heat lightMode cellSize={22} cellGap={2} cellRadius={3} radius={70} fillOpacity={0.95} maxOpacity={0.95} gridOpacity={0.16} holdTime={250} fadeDuration={1600} spotlight={0.2} edgeFade={0.12} />
            </div>
            <figcaption>
              <strong>Heat cools.</strong> A trail stays warm for a moment, then cools through blue and is gone.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ── colour ───────────────────────────────────────── */}
      <section className="row" aria-labelledby="colour">
        <div className="row-head">
          <h2 id="colour">Colour</h2>
          <p>
            Two families that never mix. The heat ramp means movement and nothing else. The cold neutrals carry
            everything that is still: surfaces, text, and things at rest.
          </p>
        </div>
        <div className="colour">
          <div>
            <h3 className="sub">Heat, from still to moving most</h3>
            <div className="ramp" />
            <ul className="stops">
              {HEAT.map((s) => (
                <li key={s.name}>
                  <i style={{ background: s.hex }} />
                  <strong>{s.name}</strong>
                  <span className="hex">{s.hex}</span>
                  <span className="muted">{s.use}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="sub">Cold</h3>
            <ul className="stops stops-cold">
              {COLD.map((s) => (
                <li key={s.name}>
                  <i style={{ background: s.hex }} />
                  <strong>{s.name}</strong>
                  <span className="hex">{s.hex}</span>
                  <span className="muted">{s.use}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="colour-data">
            <div>
              <h3 className="sub">Data heat</h3>
              <p className="muted small">
                Real heat maps use a single ember hue that only gets lighter as it gets hotter, so the order reads
                without a legend and survives colour blindness. It always sits on Night.
              </p>
            </div>
            <div className="plate ember">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <i key={i} style={{ background: `var(--data-${i})` }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── type ─────────────────────────────────────────── */}
      <section className="row" aria-labelledby="type">
        <div className="row-head">
          <h2 id="type">Type</h2>
          <p>
            Archivo is the logo's face: set wide for the main line, and heavy at normal width for every title.
            Everything else is Atkinson Hyperlegible, drawn for readers with low vision. Live numbers are set in its
            mono.
          </p>
        </div>
        <div className="type">
          <div ref={typeBox} className="warm-type">
            <VariableProximity
              label="Warm up"
              className="warm-type-word"
              fromFontVariationSettings="'wght' 300, 'wdth' 100"
              toFontVariationSettings="'wght' 900, 'wdth' 125"
              containerRef={typeBox}
              radius={160}
              falloff="gaussian"
              fromColor="#96969A"
              toColor="#FF323C"
            />
            <span className="muted small">Letters swell and warm as your pointer comes close, the way heat expands things, and cool when it leaves.</span>
          </div>
          <dl className="scale">
            <div>
              <dt>Main line, Archivo wide 700</dt>
              <dd className="s-display">Remote clinical trials.</dd>
            </div>
            <div>
              <dt>Heading, Archivo 34 / 800</dt>
              <dd className="s-h2">Chair rise</dd>
            </div>
            <div>
              <dt>Title, Archivo 22 / 700</dt>
              <dd className="s-h3">Today's games</dd>
            </div>
            <div>
              <dt>Body, Atkinson 18 / 400</dt>
              <dd className="s-body">Stand all the way up, then sit back down slowly. Keep your arms crossed.</dd>
            </div>
            <div>
              <dt>Readout, Atkinson Mono 16 / 500</dt>
              <dd>
                <Readout label="Knee" value="94" unit="°" />
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ── pieces ───────────────────────────────────────── */}
      <section className="row" aria-labelledby="pieces">
        <div className="row-head">
          <h2 id="pieces">Pieces</h2>
          <p>
            Each control follows the same rule. Buttons warm where you touch them. Starting a session takes a held
            press, so a shaking hand can't start one by accident.
          </p>
        </div>
        <div className="pieces">
          <div className="piece">
            <span className="piece-name">Buttons</span>
            <div className="piece-row">
              <HeatButton>Start session</HeatButton>
              <HeatButton variant="quiet">Connect phone</HeatButton>
              <button type="button" className="link">
                Show table
              </button>
            </div>
          </div>
          <div className="piece">
            <span className="piece-name">Hold to start</span>
            <div className="piece-row">
              <HoldButton
                size="lg"
                holdTime={1200}
                backgroundColor="#0C2C96"
                fillColor="linear-gradient(90deg, #78D7FF, #FFE464, #FF9628, #FF323C)"
                textColor="#FFFFFF"
                fillTextColor="#0E1A3D"
                doneLabel="Starting"
                radius={999}
              >
                Hold to start
              </HoldButton>
            </div>
          </div>
          <div className="piece">
            <span className="piece-name">Readouts</span>
            <div className="piece-row">
              <Readout label="Knee" value="94" unit="°" />
              <Readout label="Reps" value="7" unit=" of 10" />
              <Readout label="Left" value="0:18" />
            </div>
          </div>
          <div className="piece">
            <span className="piece-name">Status</span>
            <div className="piece-row">
              <span className="status status-good">
                <Icon kind="good" /> On schedule
              </span>
              <span className="status status-warn">
                <Icon kind="warn" /> Missed 2 sessions
              </span>
              <span className="status status-alert">
                <Icon kind="alert" /> Fall reported
              </span>
            </div>
          </div>
          <div className="piece">
            <span className="piece-name">Waiting</span>
            <div className="piece-row plate plate-tight">
              <LatticeLoader label="Finding you in the camera" pattern="ripple" color="#FF9628" glow glowColor="#FF323C" showTimer={false} fontSize={16} />
            </div>
          </div>
        </div>
      </section>

      {/* ── screens ──────────────────────────────────────── */}
      <section className="row row-wide" aria-labelledby="screens">
        <div className="row-head">
          <h2 id="screens">Two screens, one session</h2>
          <p>
            The participant sees themselves as heat: warm where they are working, a trail where they have moved. The
            study team sees the same session as measurements, against the participant's digital twin.
          </p>
        </div>

        <div className="screens">
          <PatientScreen />

          <TeamScreen />
        </div>
      </section>
    </main>
    </>
  );
}
