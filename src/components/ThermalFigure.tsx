/* The participant as the camera sees them, drawn as heat: the body
   a cool blur, the joints doing the work glowing hot, and the
   tracked skeleton laid faintly over the top. One spot reading
   sits on the joint the game is measuring. */

type Joint = { x: number; y: number; heat: number };

const J: Record<string, Joint> = {
  head: { x: 100, y: 38, heat: 0.1 },
  neck: { x: 100, y: 64, heat: 0.15 },
  ls: { x: 76, y: 76, heat: 0.15 },
  rs: { x: 124, y: 76, heat: 0.15 },
  le: { x: 66, y: 118, heat: 0.1 },
  re: { x: 134, y: 118, heat: 0.1 },
  lw: { x: 70, y: 156, heat: 0.05 },
  rw: { x: 130, y: 156, heat: 0.05 },
  lh: { x: 86, y: 146, heat: 0.75 },
  rh: { x: 114, y: 146, heat: 0.75 },
  lk: { x: 82, y: 204, heat: 1 },
  rk: { x: 118, y: 204, heat: 1 },
  la: { x: 80, y: 262, heat: 0.35 },
  ra: { x: 120, y: 262, heat: 0.35 },
};

const BONES: [string, string][] = [
  ["neck", "ls"], ["neck", "rs"], ["ls", "le"], ["le", "lw"], ["rs", "re"], ["re", "rw"],
  ["ls", "lh"], ["rs", "rh"], ["lh", "rh"], ["lh", "lk"], ["lk", "la"], ["rh", "rk"], ["rk", "ra"],
];

export function ThermalFigure({ reading }: { reading: string }) {
  return (
    <div className="tfig">
      <svg viewBox="0 0 200 290" role="img" aria-label="Camera view: hips and knees are working hardest">
        <defs>
          <filter id="tf-blur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <radialGradient id="tf-hot">
            <stop offset="0" stopColor="var(--rim)" />
            <stop offset="0.25" stopColor="var(--flare)" />
            <stop offset="0.5" stopColor="var(--ember)" />
            <stop offset="0.75" stopColor="var(--glow)" stopOpacity="0.7" />
            <stop offset="1" stopColor="var(--chill)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="tf-warm">
            <stop offset="0" stopColor="var(--glow)" />
            <stop offset="0.6" stopColor="var(--chill)" stopOpacity="0.6" />
            <stop offset="1" stopColor="var(--chill)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* the body's own heat: cool, soft-edged */}
        <g filter="url(#tf-blur)" className="tf-body">
          {BONES.map(([a, b]) => (
            <line key={a + b} x1={J[a].x} y1={J[a].y} x2={J[b].x} y2={J[b].y} />
          ))}
          <ellipse cx={100} cy={110} rx={26} ry={44} />
          <circle cx={J.head.x} cy={J.head.y} r={20} />
        </g>

        {/* the working joints, hotter the harder they work */}
        <g filter="url(#tf-blur)">
          {Object.values(J)
            .filter((j) => j.heat > 0.3)
            .map((j, i) => (
              <circle key={i} cx={j.x} cy={j.y} r={14 + j.heat * 18} fill={j.heat > 0.6 ? "url(#tf-hot)" : "url(#tf-warm)"} />
            ))}
        </g>

        {/* what the camera tracks, laid faintly over the heat */}
        <g className="tf-skeleton">
          {BONES.map(([a, b]) => (
            <line key={a + b} x1={J[a].x} y1={J[a].y} x2={J[b].x} y2={J[b].y} />
          ))}
          {Object.entries(J)
            .filter(([k]) => k !== "head")
            .map(([k, j]) => (
              <circle key={k} cx={j.x} cy={j.y} r={2.6} />
            ))}
        </g>

        {/* the spot reading on the measured knee */}
        <g className="tf-spot" transform={`translate(${J.lk.x} ${J.lk.y})`}>
          <circle r={9} />
          <path d="M0 -15v6M0 9v6M-15 0h6M9 0h6" />
        </g>
      </svg>
      <span className="tfig-reading" style={{ left: `${(J.lk.x / 200) * 100}%`, top: `${(J.lk.y / 290) * 100}%` }}>
        {reading}
      </span>
    </div>
  );
}
