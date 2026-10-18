import { Readout } from "../components/Readout";
import { GAMES } from "./controllers";
import { flagValue } from "./quality";
import { payloadBytes, type SessionRecord } from "./session";

/* What the game measured, and exactly what it would send: the
   record itself, printed, with its size, beside what stayed put. */
export function Result({ record, onAgain, onHub, onInfo }: { record: SessionRecord; onAgain: () => void; onHub: () => void; onInfo: () => void }) {
  const m = record.measures;
  const info = GAMES[record.game];

  const headline =
    record.game === "chair-rise"
      ? { big: String(m.rises), label: "full stands in 30 seconds" }
      : record.game === "floor-rise"
        ? m.rise_s === null
          ? { big: "Not yet", label: "didn't reach standing in 30 seconds" }
          : { big: `${m.rise_s} s`, label: "to stand up from the floor" }
      : record.game === "reach"
        ? { big: `${m.left_abduction_deg}° and ${m.right_abduction_deg}°`, label: "highest reach, left arm and right" }
        : { big: m.taps_per_s === null ? String(m.taps) : `${m.taps_per_s}`, label: m.taps_per_s === null ? "taps in 10 seconds" : `taps a second, ${m.taps} in 10 seconds` };

  const pct = (x: unknown) => (typeof x === "number" ? String(Math.round(x * 100)) : "–");
  const durations = (m.rise_durations_s as number[] | undefined) ?? [];
  const readings =
    record.game === "chair-rise"
      ? [
          { label: "Rises", value: String(m.rises) },
          { label: "Fell short", value: String(m.partial_rises ?? 0) },
          { label: "Quickest stand", value: durations.length ? String(Math.min(...durations)) : "–", unit: durations.length ? " s" : "" },
        ]
      : record.game === "floor-rise"
        ? [
            { label: "Off the floor", value: String(m.off_floor_s ?? "–"), unit: m.off_floor_s === null ? "" : " s" },
            { label: "Halfway", value: String(m.halfway_s ?? "–"), unit: m.halfway_s === null ? "" : " s" },
            { label: "Hands on legs", value: String(m.hands_on_legs_s), unit: " s" },
          ]
      : record.game === "reach"
        ? [
            { label: "Targets", value: `${m.targets_reached} of 8` },
            { label: "Left", value: String(m.left_abduction_deg), unit: "°" },
            { label: "Right", value: String(m.right_abduction_deg), unit: "°" },
          ]
        : [
            { label: "Uneven", value: pct(m.rhythm_irregularity), unit: m.rhythm_irregularity === null ? "" : "%" },
            { label: "Opening", value: String(m.amplitude_cm ?? "–"), unit: m.amplitude_cm === null ? "" : " cm" },
            { label: "Fade", value: pct(m.amplitude_decrement), unit: m.amplitude_decrement === null ? "" : "%" },
            { label: "Stalls", value: String(m.hesitations) },
          ];

  const flags = record.quality ?? [];
  const failed = flags.filter((f) => !f.ok);

  return (
    <section className="result" aria-labelledby="result-title">
      <div className="result-main">
        <span className="result-game">{info.name}</span>
        <h1 id="result-title" className="result-big">
          {headline.big}
        </h1>
        <p className="result-label">{headline.label}</p>
        <div className="result-readouts">
          {readings.map((r) => (
            <Readout key={r.label} tone="night" label={r.label} value={r.value} unit={r.unit} />
          ))}
        </div>
        {flags.length > 0 && (
          <div className={`result-quality ${failed.length ? "is-warn" : "is-ok"}`}>
            <span className="result-quality-head">
              {failed.length === 0 ? "Recording checks passed" : `${failed.length} recording ${failed.length === 1 ? "check" : "checks"} flagged`}
            </span>
            <ul>
              {flags.map((f) => (
                <li key={f.id} className={f.ok ? "ok" : "warn"}>
                  <span aria-hidden="true">{f.ok ? "✓" : "!"}</span>
                  <span>{f.label}</span>
                  <span className="result-quality-v">{flagValue(f)}</span>
                </li>
              ))}
            </ul>
            {failed.length > 0 && <p>The measures are kept, marked for a person to look at before they count.</p>}
          </div>
        )}
        <div className="result-actions">
          <button type="button" className="hbtn hbtn-solid hbtn-l result-solid" onClick={onAgain}>
            Play again
          </button>
          <button type="button" className="hbtn hbtn-quiet hbtn-l result-quiet" onClick={onHub}>
            Choose another game
          </button>
          <button type="button" className="hbtn hbtn-quiet hbtn-l result-quiet" onClick={onInfo}>
            About this game
          </button>
        </div>
      </div>

      <div className="result-sent">
        <div className="result-sent-head">
          <span>What this session sends</span>
          <span className="result-bytes">{payloadBytes(record)} bytes</span>
        </div>
        <pre>{JSON.stringify(record, null, 2)}</pre>
        <div className="result-kept">
          <span>Kept on this device</span>
          <p>{record.demo ? "Nothing: a simulated participant played this one." : "The video, your face and your room. None of it left the browser."}</p>
        </div>
      </div>
    </section>
  );
}
