import { Readout } from "../components/Readout";
import { GAMES } from "./controllers";
import { payloadBytes, type SessionRecord } from "./session";

/* What the game measured, and exactly what it would send: the
   record itself, printed, with its size, beside what stayed put. */
export function Result({ record, onAgain, onHub }: { record: SessionRecord; onAgain: () => void; onHub: () => void }) {
  const m = record.measures;
  const info = GAMES[record.game];

  const headline =
    record.game === "chair-rise"
      ? { big: String(m.rises), label: "full stands in 30 seconds" }
      : record.game === "reach"
        ? { big: `${m.left_abduction_deg}° and ${m.right_abduction_deg}°`, label: "highest reach, left arm and right" }
        : { big: m.tremor_mm === null ? "–" : `${m.tremor_mm} mm`, label: "average shake while holding" };

  const readings =
    record.game === "chair-rise"
      ? [
          { label: "Rises", value: String(m.rises) },
          { label: "First stand", value: String((m.stand_times_s as number[])[0] ?? "–"), unit: " s" },
        ]
      : record.game === "reach"
        ? [
            { label: "Targets", value: `${m.targets_reached} of 8` },
            { label: "Left", value: String(m.left_abduction_deg), unit: "°" },
            { label: "Right", value: String(m.right_abduction_deg), unit: "°" },
          ]
        : [
            { label: "Shake", value: String(m.tremor_mm ?? "–"), unit: " mm" },
            { label: "Tremor", value: m.tremor_hz === null ? "None found" : String(m.tremor_hz), unit: m.tremor_hz === null ? "" : " Hz" },
          ];

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
        <div className="result-actions">
          <button type="button" className="hbtn hbtn-solid hbtn-l result-solid" onClick={onAgain}>
            Play again
          </button>
          <button type="button" className="hbtn hbtn-quiet hbtn-l result-quiet" onClick={onHub}>
            Choose another game
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
