import { useEffect, useRef } from "react";
import { levelsRef } from "../runners/voiceSessionRunner.js";

/**
 * Q26: reads the shared `levelsRef` (written by voiceSessionRunner's RAF
 * meter loop) directly in its own requestAnimationFrame loop. Does NOT
 * subscribe to the Zustand store — meter levels never enter dispatch,
 * eliminating ~60 re-renders/second.
 */
export function EqBars({ dimmed }: { dimmed: boolean }): React.JSX.Element {
  const barsRef = useRef<HTMLSpanElement[]>([]);

  useEffect(() => {
    let raf = 0;
    const tick = (): void => {
      for (let i = 0; i < barsRef.current.length; i += 1) {
        const bar = barsRef.current[i];
        if (bar !== undefined) {
          bar.style.setProperty("--level", String(Math.max(0.1, levelsRef[i] ?? 0.1)));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={`meters${dimmed ? " dimmed" : ""}`} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="bar"
          ref={(el) => {
            if (el !== null) {
              barsRef.current[i] = el;
            }
          }}
        />
      ))}
    </div>
  );
}
