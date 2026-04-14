"use client";

import { Check, Circle } from "lucide-react";
import type { LiveFlowStep } from "@/components/useLiveTaskPipeline";

export function LiveTaskFlowChart({ steps }: { steps: LiveFlowStep[] }) {
  return (
    <div
      className="w-full max-w-2xl rounded-2xl border border-cyan-500/20 bg-zinc-950/80 p-6 shadow-[0_0_48px_-20px_rgba(34,211,238,0.25)] backdrop-blur-xl sm:max-w-3xl sm:p-8"
      aria-label="Live task flow"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-400/90">
            Live pipeline
          </p>
          <h3 className="mt-1 text-base font-semibold text-white sm:text-lg">
            Task flow
          </h3>
        </div>
      </div>
      <p className="mb-6 text-xs leading-relaxed text-zinc-500">
        Steps show specialized agents from what you asked for. Completion is
        inferred from the live transcript — not guaranteed tool execution.
      </p>

      <ol className="relative flex flex-col gap-0">
        {steps.map((step, i) => (
          <li key={`${step.id}-${i}`} className="relative flex gap-0">
            {i > 0 ? (
              <div
                className="absolute left-[15px] top-0 z-0 flex w-8 -translate-y-full justify-center"
                aria-hidden
              >
                <div className="flow-connector-line h-6 w-px bg-gradient-to-b from-cyan-500/50 via-violet-500/40 to-cyan-500/50" />
              </div>
            ) : null}

            <div className="relative z-10 flex w-full gap-3 pb-5 last:pb-0 sm:gap-4">
              <div className="flex w-8 shrink-0 flex-col items-center pt-1">
                <StatusOrb status={step.status} />
              </div>
              <div
                className={`flow-node min-w-0 flex-1 rounded-xl border px-3 py-3 sm:px-4 sm:py-3.5 ${
                  step.status === "active"
                    ? "flow-node-active border-cyan-400/50 bg-cyan-500/[0.08] shadow-[0_0_24px_-8px_rgba(34,211,238,0.45)]"
                    : step.status === "complete"
                      ? "border-violet-500/30 bg-violet-500/[0.06]"
                      : "border-white/10 bg-white/[0.02]"
                }`}
              >
                <p
                  className={`text-sm font-medium leading-snug sm:text-[15px] ${
                    step.status === "pending"
                      ? "text-zinc-500"
                      : step.status === "active"
                        ? "text-cyan-50"
                        : "text-zinc-200"
                  }`}
                >
                  {step.label}
                </p>
                {step.status === "active" ? (
                  <div className="mt-2 h-0.5 max-w-[12rem] overflow-hidden rounded-full bg-zinc-800">
                    <div className="flow-node-shimmer h-full w-2/3 rounded-full bg-gradient-to-r from-cyan-500 via-violet-500 to-cyan-500" />
                  </div>
                ) : null}
                {step.status === "complete" ? (
                  <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wider text-violet-300/80">
                    Agent finished (from transcript)
                  </p>
                ) : null}
                {step.status === "active" ? (
                  <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wider text-cyan-400/90">
                    Agent on task
                  </p>
                ) : null}
                {step.status === "pending" ? (
                  <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                    Waiting — activates when flow reaches this step
                  </p>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StatusOrb({ status }: { status: LiveFlowStep["status"] }) {
  if (status === "complete") {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-violet-400/50 bg-violet-500/20 text-violet-200">
        <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-cyan-400 bg-cyan-500/20 shadow-[0_0_16px_rgba(34,211,238,0.5)]">
        <span className="flow-active-ping absolute inline-flex h-3 w-3 rounded-full bg-cyan-400 opacity-50" />
        <span className="relative h-2 w-2 rounded-full bg-cyan-200" />
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-600 bg-zinc-900/90 text-zinc-600">
      <Circle className="h-3 w-3" strokeWidth={2} aria-hidden />
    </span>
  );
}
