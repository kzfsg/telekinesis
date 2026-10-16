import type { AnchorHTMLAttributes, ButtonHTMLAttributes, PointerEvent } from "react";

type Look = { variant?: "solid" | "quiet"; size?: "m" | "l" };

/* the bloom follows the pointer: its position goes to the surface
   as two custom properties, which the CSS gradient reads */
const aim = (e: PointerEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--hx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--hy", `${e.clientY - r.top}px`);
};

/* A button that warms where it is touched. The pointer leaves a
   bloom of heat on the surface under it; take the pointer away and
   the bloom cools off over --cool, rather than switching off. */
export function HeatButton({
  variant = "solid",
  size = "m",
  className = "",
  onPointerMove,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & Look) {
  return (
    <button
      type="button"
      className={`hbtn hbtn-${variant} hbtn-${size} ${className}`}
      onPointerMove={(e) => { aim(e); onPointerMove?.(e); }}
      {...rest}
    />
  );
}

/* the same, for when the action goes somewhere */
export function HeatLink({
  variant = "solid",
  size = "m",
  className = "",
  onPointerMove,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & Look) {
  return (
    <a
      className={`hbtn hbtn-${variant} hbtn-${size} ${className}`}
      onPointerMove={(e) => { aim(e); onPointerMove?.(e); }}
      {...rest}
    />
  );
}
