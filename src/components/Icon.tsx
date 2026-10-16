/* status glyphs: always shown with a word, never alone */
export function Icon({ kind }: { kind: "good" | "warn" | "alert" }) {
  if (kind === "good")
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (kind === "warn")
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 4.5v4.2M8 11.2v.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 1.8l6.6 12H1.4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 6.2v3.6M8 11.9v.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
