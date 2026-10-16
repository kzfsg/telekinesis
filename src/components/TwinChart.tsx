import { useState } from "react";

export type TwinPoint = { week: number; observed?: number; twin: number; low: number; high: number };

const W = 640;
const H = 260;
const PAD = { top: 20, right: 92, bottom: 36, left: 40 };

/* One participant's measure against their digital twin: what the
   participant did each week, and what the twin predicts they would
   have done without treatment, with its uncertainty band. */
export function TwinChart({ data, unit, yMax }: { data: TwinPoint[]; unit: string; yMax: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  const last = data[data.length - 1].week;
  const x = (w: number) => PAD.left + (w / last) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - v / yMax) * (H - PAD.top - PAD.bottom);

  const observed = data.filter((d) => d.observed !== undefined);
  const path = (pts: [number, number][]) => pts.map(([a, b], i) => `${i ? "L" : "M"}${a.toFixed(1)},${b.toFixed(1)}`).join("");
  const band =
    path(data.map((d) => [x(d.week), y(d.high)])) +
    data
      .slice()
      .reverse()
      .map((d) => `L${x(d.week).toFixed(1)},${y(d.low).toFixed(1)}`)
      .join("") +
    "Z";

  const ticks = Array.from({ length: Math.floor(yMax / 4) + 1 }, (_, i) => i * 4);
  const lastObs = observed[observed.length - 1];
  const lastTwin = data[data.length - 1];
  const h = hover === null ? null : data[hover];

  return (
    <figure className="twin">
      <div className="twin-head">
        <ul className="legend">
          <li>
            <span className="swatch swatch-observed" /> Participant
          </li>
          <li>
            <span className="swatch swatch-twin" /> Twin, untreated prediction
          </li>
        </ul>
        <button type="button" className="link" onClick={() => setAsTable((v) => !v)}>
          {asTable ? "Show chart" : "Show table"}
        </button>
      </div>

      {asTable ? (
        <table className="twin-table">
          <thead>
            <tr>
              <th>Week</th>
              <th>Participant</th>
              <th>Twin</th>
              <th>Twin range</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.week}>
                <td>{d.week}</td>
                <td>{d.observed ?? "Not yet"}</td>
                <td>{d.twin.toFixed(1)}</td>
                <td>
                  {d.low.toFixed(1)} to {d.high.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="twin-plot">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${unit} by week, participant against twin prediction`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="grid" />
                <text x={PAD.left - 10} y={y(t)} className="axis" textAnchor="end" dominantBaseline="middle">
                  {t}
                </text>
              </g>
            ))}
            {data.map((d) =>
              d.week % 4 === 0 ? (
                <text key={d.week} x={x(d.week)} y={H - 12} className="axis" textAnchor="middle">
                  {d.week === 0 ? "Start" : `Wk ${d.week}`}
                </text>
              ) : null,
            )}

            <path d={band} className="band" />
            <path d={path(data.map((d) => [x(d.week), y(d.twin)]))} className="line line-twin" />
            <path d={path(observed.map((d) => [x(d.week), y(d.observed!)]))} className="line line-observed" />
            {observed.map((d) => (
              <circle key={d.week} cx={x(d.week)} cy={y(d.observed!)} r={4.5} className="dot" />
            ))}

            <text x={x(lastObs.week) + 12} y={y(lastObs.observed!)} className="direct" dominantBaseline="middle">
              {lastObs.observed} now
            </text>
            <text x={x(lastTwin.week) + 12} y={y(lastTwin.twin)} className="direct" dominantBaseline="middle">
              {lastTwin.twin.toFixed(1)} twin
            </text>

            {h && (
              <line x1={x(h.week)} x2={x(h.week)} y1={PAD.top} y2={H - PAD.bottom} className="crosshair" />
            )}
            {data.map((d, i) => (
              <rect
                key={d.week}
                x={x(d.week) - (W - PAD.left - PAD.right) / last / 2}
                y={PAD.top}
                width={(W - PAD.left - PAD.right) / last}
                height={H - PAD.top - PAD.bottom}
                fill="transparent"
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
              />
            ))}
          </svg>
          {h && (
            <div className="tip" style={{ left: `${(x(h.week) / W) * 100}%`, top: `${(PAD.top / H) * 100}%` }}>
              <strong>{h.week === 0 ? "Start" : `Week ${h.week}`}</strong>
              <span>
                <i className="swatch swatch-observed" /> Participant {h.observed ?? "not yet measured"}
              </span>
              <span>
                <i className="swatch swatch-twin" /> Twin {h.twin.toFixed(1)} ({h.low.toFixed(1)} to {h.high.toFixed(1)})
              </span>
            </div>
          )}
        </div>
      )}
      <figcaption>{unit}. Each point is the best of that week's home sessions.</figcaption>
    </figure>
  );
}
