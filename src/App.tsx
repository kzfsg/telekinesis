import DesignSystem from "./pages/DesignSystem";
import Landing from "./pages/Landing";
import "./styles/system.css";

/* two pages, so a path check is all the routing there is */
export default function App() {
  return window.location.pathname.startsWith("/design") ? <DesignSystem /> : <Landing />;
}
