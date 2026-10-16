/* A year of one participant's motor data, a cell a day. Most of it is
   cold: the days nothing was measured. Marked days are the ones that
   were, with a label for each. */
export function YearGrid({ marks, caption }: { marks: { week: number; label: string }[]; caption: string }) {
  const marked = new Map(marks.map((m) => [m.week * 7 + 2, m.label]));
  return (
    <figure className="year">
      <div className="year-grid" role="img" aria-label={`${caption} ${marks.map((m) => m.label).join(", ")}.`}>
        {Array.from({ length: 52 * 7 }, (_, i) => (
          <i key={i} className={marked.has(i) ? "on" : undefined} style={{ gridColumn: Math.floor(i / 7) + 1, gridRow: (i % 7) + 1 }} />
        ))}
      </div>
      <div className="year-marks" aria-hidden="true">
        {marks.map((m) => (
          <span key={m.week} style={{ left: `${((m.week + 0.5) / 52) * 100}%` }}>
            {m.label}
          </span>
        ))}
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
