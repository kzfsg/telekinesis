import { useEffect, useState } from "react";

/* The bar across the top of every page: the name, small and still,
   with its asterisk warm, the few places there are to go, and one
   action. It floats over the page as glass, and turns light-on-dark
   whenever a dark section is passing under it. */
export function SiteNav({ current }: { current: "home" | "design" }) {
  const home = current === "home";
  const [dark, setDark] = useState(home);

  useEffect(() => {
    const check = () => {
      const under = document.elementsFromPoint(window.innerWidth / 2, 34).find((el) => !el.closest(".sitenav"));
      setDark(Boolean(under?.closest("[data-dark]")));
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  return (
    <header className={`sitenav ${dark ? "is-dark" : ""}`}>
      <nav aria-label="Main">
        <a className="sitenav-name" href="/">
          telekinesis
          <svg viewBox="-10 -10 20 20" aria-hidden="true">
            <defs>
              <radialGradient id="nav-heat">
                <stop offset="0" stopColor="var(--deep)" />
                <stop offset="0.45" stopColor="var(--glow)" />
                <stop offset="0.75" stopColor="var(--ember)" />
                <stop offset="1" stopColor="var(--rim)" />
              </radialGradient>
            </defs>
            <g stroke="url(#nav-heat)" strokeWidth="3.4" strokeLinecap="round">
              <path d="M0 -8V8M-6.9 -4L6.9 4M-6.9 4L6.9 -4" />
            </g>
          </svg>
        </a>
        <ul>
          <li>
            <a href={home ? "#how" : "/#how"}>How it works</a>
          </li>
          <li>
            <a href={home ? "#example" : "/#example"}>Example</a>
          </li>
          <li>
            <a href={home ? "#data" : "/#data"}>The data</a>
          </li>
          <li>
            <a href="/design" aria-current={home ? undefined : "page"}>
              Design system
            </a>
          </li>
        </ul>
        <a className="sitenav-action" href={home ? "#example" : "/#example"}>
          See a participant
        </a>
      </nav>
    </header>
  );
}
