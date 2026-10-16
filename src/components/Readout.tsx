/* A live reading, printed the way a heat camera prints a spot
   reading: a small crosshair, the number, its unit. Where a camera
   reads degrees of heat, we read degrees of a joint, reps and seconds. */
export function Readout({ value, unit, label, tone = "light" }: { value: string | number; unit?: string; label?: string; tone?: "light" | "night" }) {
  return (
    <span className={`readout readout-${tone}`}>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 0.5v4M8 11.5v4M0.5 8h4M11.5 8h4" stroke="currentColor" strokeWidth="1.4" />
      </svg>
      {label && <span className="readout-label">{label}</span>}
      <span className="readout-value">
        {value}
        {unit && <span className="readout-unit">{unit}</span>}
      </span>
    </span>
  );
}
