"use client";

import { useEffect, useState } from "react";

const BAR_COUNT = 11;

type Phase = "idle" | "listening" | "speaking";

export function VoiceVisualizer({
  phase,
  assistantVolume = 0,
}: {
  phase: Phase;
  assistantVolume?: number;
}) {
  const [levels, setLevels] = useState<number[]>(() =>
    Array.from({ length: BAR_COUNT }, () => 0.2),
  );

  useEffect(() => {
    let frame: number;
    const t0 = performance.now();

    const loop = (now: number) => {
      const t = (now - t0) / 1000;
      const volBoost = 1 + Math.min(1, assistantVolume) * 0.55;

      const next = Array.from({ length: BAR_COUNT }, (_, i) => {
        const offset = i * 0.55;
        const slow = Math.sin(t * 2.2 + offset) * 0.5 + 0.5;
        const fast = Math.sin(t * 7 + offset * 1.3) * 0.35 + 0.65;

        if (phase === "idle") {
          const breathe = Math.sin(t * 1.4 + offset) * 0.12 + 0.18;
          return Math.min(1, breathe);
        }
        if (phase === "listening") {
          const base = 0.28 + slow * 0.42 * fast;
          return Math.min(1, base * volBoost);
        }
        // speaking — livelier motion
        const base = 0.4 + slow * 0.48 * fast * 1.15;
        return Math.min(1, base * volBoost);
      });

      setLevels(next);
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [phase, assistantVolume]);

  return (
    <div className="relative flex h-36 items-end justify-center gap-1.5 sm:gap-2 md:h-44">
      <div
        className="pointer-events-none absolute inset-0 -top-6 flex justify-center"
        aria-hidden
      >
        <div className="h-32 w-48 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.35)_0%,rgba(34,211,238,0.12)_45%,transparent_70%)] blur-xl sm:w-64" />
      </div>
      {levels.map((lv, i) => (
        <div
          key={i}
          className="voice-bar relative w-1.5 overflow-hidden rounded-full sm:w-2"
          style={{
            height: `${Math.max(12, lv * 100)}%`,
            minHeight: "12px",
            boxShadow:
              "0 0 12px rgba(34, 211, 238, 0.35), 0 0 20px rgba(167, 139, 250, 0.25)",
            transition: "height 45ms ease-out",
          }}
        >
          <div
            className="absolute inset-0 rounded-full opacity-95"
            style={{
              background:
                "linear-gradient(to top, #22d3ee 0%, #a78bfa 55%, #c4b5fd 100%)",
            }}
          />
        </div>
      ))}
    </div>
  );
}
