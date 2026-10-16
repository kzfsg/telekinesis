import { useState } from "react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/* minutes moved, binned onto the six ember steps */
const BINS = [3, 5, 7, 9, 11];
const step = (m: number) => BINS.filter((b) => m >= b).length;

/* A month of home sessions as a real heat map: one cell a day, its
   warmth the minutes the participant spent moving. A day with no
   session stays cold. */
export function SessionHeatmap({ weeks, firstWeek }: { weeks: (number | null)[][]; firstWeek: number }) {
  const [hover, setHover] = useState<{ w: number; d: number } | null>(null);
  const [asTable, setAsTable] = useState(false);
  const h = hover ? weeks[hover.w][hover.d] : undefined;

  return (
    <figure className="plate sheat">
      <div className="sheat-head">
        <span>Minutes moved each day</span>
        <button type="button" className="link link-night" onClick={() => setAsTable((v) => !v)}>
          {asTable ? "Show heat map" : "Show table"}
        </button>
      </div>

      {asTable ? (
        <table className="sheat-table">
          <thead>
            <tr>
              <th>Week</th>
              {DAYS.map((d) => (
                <th key={d}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((row, w) => (
              <tr key={w}>
                <td>{firstWeek + w}</td>
                {row.map((m, d) => (
                  <td key={d}>{m ?? "None"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="sheat-grid">
          <span />
          {DAYS.map((d) => (
            <span key={d} className="sheat-day">
              {d}
            </span>
          ))}
          {weeks.map((row, w) => (
            <div key={w} className="sheat-row">
              <span className="sheat-week">Wk {firstWeek + w}</span>
              {row.map((m, d) => (
                <span
                  key={d}
                  role="img"
                  tabIndex={0}
                  aria-label={`Week ${firstWeek + w}, ${DAYS[d]}: ${m === null ? "no session" : `${m} minutes`}`}
                  className={`sheat-cell ${hover?.w === w && hover?.d === d ? "is-on" : ""}`}
                  style={{ background: m === null ? "var(--data-none)" : `var(--data-${step(m)})` }}
                  onPointerEnter={() => setHover({ w, d })}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover({ w, d })}
                  onBlur={() => setHover(null)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="sheat-foot">
        <span className="sheat-legend" aria-hidden="true">
          <span>Fewer</span>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <i key={i} style={{ background: `var(--data-${i})` }} />
          ))}
          <span>More</span>
          <i className="sheat-none" />
          <span>No session</span>
        </span>
        <span className="sheat-now" aria-live="polite">
          {hover && (h === null ? `${DAYS[hover.d]}, week ${firstWeek + hover.w}: no session` : `${DAYS[hover.d]}, week ${firstWeek + hover.w}: ${h} min`)}
        </span>
      </div>
    </figure>
  );
}
