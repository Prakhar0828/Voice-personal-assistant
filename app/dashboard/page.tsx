"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BUCKET_IDS,
  labelForBucket,
  loadStoredCalls,
  type StoredCall,
} from "@/lib/call-history";

type RangeKey = "7d" | "30d" | "all";

function cutoffMs(range: RangeKey): number | null {
  const now = Date.now();
  if (range === "all") return null;
  const days = range === "7d" ? 7 : 30;
  return now - days * 24 * 60 * 60 * 1000;
}

type BucketRow = { text: string; endedAt: number; callId: string };

export default function DashboardPage() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [calls, setCalls] = useState<StoredCall[]>(() =>
    typeof window !== "undefined" ? loadStoredCalls() : [],
  );

  useEffect(() => {
    const onUpdate = () => setCalls(loadStoredCalls());
    window.addEventListener("storage", onUpdate);
    window.addEventListener("vpa-call-history", onUpdate);
    return () => {
      window.removeEventListener("storage", onUpdate);
      window.removeEventListener("vpa-call-history", onUpdate);
    };
  }, []);

  const filteredCalls = useMemo(() => {
    const c = cutoffMs(range);
    if (c === null) return calls;
    return calls.filter((x) => x.endedAt >= c);
  }, [calls, range]);

  const byBucket = useMemo(() => {
    const map = new Map<string, BucketRow[]>();
    for (const call of filteredCalls) {
      for (const a of call.actionItems) {
        const b = a.bucket || "general";
        const list = map.get(b) ?? [];
        list.push({ text: a.text, endedAt: call.endedAt, callId: call.id });
        map.set(b, list);
      }
    }
    return map;
  }, [filteredCalls]);

  const orderedBuckets = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const id of BUCKET_IDS) {
      if (byBucket.has(id) && (byBucket.get(id)?.length ?? 0) > 0) {
        ordered.push(id);
        seen.add(id);
      }
    }
    for (const id of byBucket.keys()) {
      if (!seen.has(id) && (byBucket.get(id)?.length ?? 0) > 0) {
        ordered.push(id);
      }
    }
    return ordered;
  }, [byBucket]);

  const totalActions = filteredCalls.reduce(
    (n, c) => n + c.actionItems.length,
    0,
  );

  return (
    <div className="relative min-h-full flex-1 overflow-hidden bg-[#070708] px-4 py-12 sm:py-16">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(109,40,217,0.22),transparent),radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(6,182,212,0.12),transparent)]"
        aria-hidden
      />
      <div className="relative z-10 mx-auto w-full max-w-5xl">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/"
              className="text-xs font-medium uppercase tracking-wider text-cyan-400/90 hover:text-cyan-300"
            >
              ← Back to assistant
            </Link>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Activity dashboard
            </h1>
            <p className="mt-2 max-w-xl text-sm text-zinc-400">
              Requests you made to the assistant, grouped by type. Data is
              stored in this browser only (localStorage).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["7d", "Last 7 days"],
                ["30d", "Last 30 days"],
                ["all", "All time"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setRange(key)}
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  range === key
                    ? "bg-white/15 text-white ring-1 ring-cyan-500/40"
                    : "border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <p className="mb-8 text-sm text-zinc-500">
          <span className="font-medium text-zinc-400">{filteredCalls.length}</span>{" "}
          calls ·{" "}
          <span className="font-medium text-zinc-400">{totalActions}</span>{" "}
          action items in range
        </p>

        {orderedBuckets.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-10 text-center text-zinc-400 backdrop-blur-sm">
            No saved actions in this range yet. End a call from the home page
            to record a summary here.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-1 lg:grid-cols-2">
            {orderedBuckets.map((bucketId) => {
              const rows = byBucket.get(bucketId) ?? [];
              return (
                <article
                  key={bucketId}
                  className="flex flex-col rounded-2xl border border-white/10 bg-zinc-950/80 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur-xl"
                >
                  <header className="mb-4 flex items-center justify-between gap-2 border-b border-white/10 pb-3">
                    <h2 className="text-lg font-semibold text-white">
                      {labelForBucket(bucketId)}
                    </h2>
                    <span className="rounded-full bg-violet-500/20 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-violet-200">
                      {rows.length}
                    </span>
                  </header>
                  <ul className="max-h-80 space-y-3 overflow-y-auto text-sm">
                    {rows.map((row, i) => (
                      <li
                        key={`${row.callId}-${i}-${row.text.slice(0, 24)}`}
                        className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2.5"
                      >
                        <p className="text-pretty text-zinc-200">{row.text}</p>
                        <time
                          className="mt-1 block text-[11px] text-zinc-500 tabular-nums"
                          dateTime={new Date(row.endedAt).toISOString()}
                        >
                          {new Date(row.endedAt).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </time>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
