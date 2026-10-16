import CountUp from "./bits/CountUp";
import CursorGrid from "./bits/CursorGrid";
import SpotlightCard from "./bits/SpotlightCard";
import { Icon } from "./Icon";
import { Readout } from "./Readout";
import { ThermalFigure } from "./ThermalFigure";

const TODAY = [
  { game: "Chair rise", time: "3 min", done: true },
  { game: "Reach", time: "2 min", done: true },
  { game: "Steady hand", time: "2 min", done: false },
];

/* The participant's screen: the camera's view at night, warm only
   where they have moved, with one instruction and one number. */
export function PatientScreen() {
  return (
    <article className="screen screen-patient" aria-label="Participant screen">
      <CursorGrid heat cellSize={26} cellGap={2} cellRadius={4} radius={80} fillOpacity={0.55} maxOpacity={0.7} gridOpacity={0.05} gridColor="#3A4680" holdTime={300} fadeDuration={1800} spotlight={0.15} edgeFade={0.08} className="screen-heat">
        <div className="game">
          <div className="game-top">
            <h3>Chair rise</h3>
            <Readout tone="night" label="Left" value="0:18" />
          </div>
          <div className="game-mid">
            <ThermalFigure reading="Knee 94°" />
            <div className="count">
              <CountUp to={7} from={0} duration={1.4} className="count-n" trigger="view" replayOnHover />
              <span className="count-of">of 10 rises</span>
            </div>
          </div>
          <p className="instruction">Stand all the way up, then sit back down slowly.</p>
          <ol className="today">
            {TODAY.map((t) => (
              <li key={t.game}>
                <SpotlightCard className={`today-tile ${t.done ? "is-done" : ""}`} theme="dark" spotlightColor="#FF5ABE" intensity={0.5} spotlightSize={160}>
                  <span className="today-mark">{t.done && <Icon kind="good" />}</span>
                  <span className="today-game">{t.game}</span>
                  <span className="today-time">{t.done ? "Done" : t.time}</span>
                </SpotlightCard>
              </li>
            ))}
          </ol>
        </div>
      </CursorGrid>
    </article>
  );
}
