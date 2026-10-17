import { HeatMap } from "./HeatMap";
import { useWidth } from "../hooks/useWidth";

/* The lockup: the name as a heat map, grey until a hand comes, and
   the asterisk hung off the top right of its last s, pulsing on its
   own. It fills its column, so it is measured rather than fixed. */
export function Logo() {
  const [logoBox, logoWidth] = useWidth<HTMLDivElement>();
  return (
    <div ref={logoBox} className="logo">
      {logoWidth > 0 && (
        <h1 className="wordmark" aria-label="Telekinesis">
          <HeatMap
            word="telekinesis"
            shape="Word"
            auto
            path="sweep"
            period={10}
            cycle={false}
            label="Telekinesis"
            width={Math.round(logoWidth * 0.92)}
            height={Math.round(logoWidth * 0.2)}
            soft={12}
            heat={70}
            area={60}
          />
          <span
            className="wordmark-star"
            aria-hidden="true"
            style={{ left: Math.round(logoWidth * 0.856), top: Math.round(logoWidth * 0.042) }}
          >
            <HeatMap
              shape="Asterisk"
              seed={10}
              auto
              period={10}
              cycle={false}
              label="Telekinesis"
              width={Math.round(logoWidth * 0.055)}
              height={Math.round(logoWidth * 0.055)}
              soft={8}
              heat={45}
              area={45}
            />
          </span>
        </h1>
      )}
    </div>
  );
}
