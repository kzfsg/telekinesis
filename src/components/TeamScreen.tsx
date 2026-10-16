import { Icon } from "./Icon";
import { SessionHeatmap } from "./SessionHeatmap";
import { TwinChart, type TwinPoint } from "./TwinChart";

const OBSERVED = [11, 11, 12, 11, 12, 12, 13, 12, 13, 13, 14];
const TWIN: TwinPoint[] = Array.from({ length: 25 }, (_, w) => {
  const twin = 11 - 0.12 * w;
  const spread = 0.6 + 0.05 * w;
  return { week: w, observed: OBSERVED[w], twin, low: twin - spread, high: twin + spread };
});

/* four weeks of minutes moved; null is a day without a session */
const MONTH: (number | null)[][] = [
  [6, 7, null, 8, 7, 9, null],
  [8, 9, 9, null, 10, 11, 7],
  [10, 9, 12, 11, null, null, 6],
  [11, 12, 12, 13, 12, null, 13],
];

/* The study team's screen: the same sessions as measurements, a
   month of adherence as heat, and the participant against their twin. */
export function TeamScreen() {
  return (
    <article className="screen screen-team" aria-label="Study team screen">
      <div className="team-top">
        <div>
          <h3>Participant P-014</h3>
          <p className="muted small">Week 10 of 24. Treatment arm blinded.</p>
        </div>
        <span className="status status-good">
          <Icon kind="good" /> On schedule
        </span>
      </div>
      <div className="stats">
        <div>
          <span className="stat-label">Sessions this week</span>
          <span className="stat-value">6 of 7</span>
        </div>
        <div>
          <span className="stat-label">Chair rise, best this week</span>
          <span className="stat-value">14</span>
          <span className="muted small">Twin predicts 9.8</span>
        </div>
        <div>
          <span className="stat-label">Reach</span>
          <span className="status status-warn">
            <Icon kind="warn" /> Down 18% since week 8
          </span>
        </div>
      </div>
      <SessionHeatmap weeks={MONTH} firstWeek={7} />
      <TwinChart data={TWIN} unit="Chair rises in 30 seconds" yMax={16} />
    </article>
  );
}
