import { lazy, Suspense } from "react";
import DesignSystem from "./pages/DesignSystem";
import Landing from "./pages/Landing";
import "./styles/system.css";

/* the games carry the body tracker, so they load only when opened */
const Play = lazy(() => import("./pages/Play"));
const Lab = lazy(() => import("./pages/Lab"));

/* four pages, so a path check is all the routing there is */
export default function App() {
  const path = window.location.pathname;
  if (path.startsWith("/design")) return <DesignSystem />;
  if (path.startsWith("/lab"))
    return (
      <Suspense fallback={<main className="play-wait" />}>
        <Lab />
      </Suspense>
    );
  if (path.startsWith("/play"))
    return (
      <Suspense fallback={<main className="play-wait" />}>
        <Play />
      </Suspense>
    );
  return <Landing />;
}
