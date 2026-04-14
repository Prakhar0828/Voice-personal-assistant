"use client";

import { useEffect, useState } from "react";

/**
 * Clusters (not strict alternation): several tall bars on the left, a band of
 * short bars, several tall in the middle, short band, several tall on the right.
 */
const BAR_HEIGHT_SCALE = [
  1, 0.97, 1, 0.94,
  0.36, 0.38, 0.35, 0.39, 0.37,
  0.96, 1, 0.93, 0.98, 0.91,
  0.38, 0.36, 0.4, 0.35,
  0.95, 1, 0.97, 0.99,
] as const;

const BAR_COUNT = BAR_HEIGHT_SCALE.length;

function barHeightScale(i: number): number {
  return BAR_HEIGHT_SCALE[i] ?? 1;
}

/** Index of a tall bar in the middle cluster (for accent glow). */
const MID_CLUSTER_GLOW_INDEX = 10;

type Phase = "idle" | "listening" | "speaking";

/**
 * Many thin bars; silhouette is chunky big/small bands across the row.
 */
export function VoiceVisualizer({
  phase,
  assistantVolume = 0,
}: {
  phase: Phase;
  assistantVolume?: number;
}) {
  const [levels, setLevels] = useState<number[]>(() =>
    Array.from({ length: BAR_COUNT }, (_, i) => 0.38 * barHeightScale(i)),
  );

  useEffect(() => {
    let frame: number;
    const t0 = performance.now();

    const loop = (now: number) => {
      const t = (now - t0) / 1000;
      const volBoost = 1 + Math.min(1, assistantVolume) * 0.85;

      const next = Array.from({ length: BAR_COUNT }, (_, i) => {
        const offset = i * 0.48 + Math.sin(i * 0.7) * 0.35;
        const slow = Math.sin(t * 2.85 + offset) * 0.5 + 0.5;
        const mid = Math.sin(t * 4.4 + offset * 1.1) * 0.5 + 0.5;
        const fast = Math.sin(t * 9.2 + offset * 1.4) * 0.38 + 0.62;
        const wobble = Math.sin(t * 11.5 + i * 0.9) * 0.08;

        const scale = barHeightScale(i);

        if (phase === "idle") {
          const breathe =
            Math.sin(t * 1.65 + offset) * 0.16 + 0.28 + wobble * 0.5;
          return Math.min(1, Math.max(0.08, breathe * scale));
        }
        if (phase === "listening") {
          const base = 0.26 + slow * 0.5 * mid * fast + wobble;
          return Math.min(1, Math.max(0.1, base * volBoost * scale));
        }
        const base = 0.34 + slow * 0.55 * mid * fast * 1.18 + wobble * 1.2;
        return Math.min(1, Math.max(0.12, base * volBoost * scale));
      });

      setLevels(next);
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [phase, assistantVolume]);

  return (
    <div className="relative flex w-full max-w-md items-center justify-center px-1 sm:max-w-lg" aria-hidden>
      <div className="relative z-10 flex h-36 items-end gap-1 sm:h-40">
        {levels.map((lv, i) => {
          const scale = barHeightScale(i);
          const opacity = Math.min(1, 0.38 + scale * 0.58);
          const accentGlow =
            i === 0 ||
            i === BAR_COUNT - 1 ||
            i === MID_CLUSTER_GLOW_INDEX;
          return (
            <div
              key={i}
              className={`voice-visualizer-bar w-1 rounded-full bg-gradient-to-t from-[#81ecff] to-[#ac8aff] sm:w-1.5 ${
                accentGlow
                  ? "shadow-[0_0_15px_rgba(129,236,255,0.45)]"
                  : ""
              }`}
              style={{
                height: `${Math.max(12, (0.2 + lv * 0.62) * 100)}%`,
                opacity,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
