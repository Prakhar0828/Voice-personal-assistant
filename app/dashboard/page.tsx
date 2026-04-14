"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BUCKET_IDS,
  labelForBucket,
  loadStoredCalls,
  type StoredCall,
} from "@/lib/call-history";
import { computeDashboardAnalytics } from "@/lib/dashboard-analytics";

type RangeKey = "7d" | "30d" | "all";

function cutoffMs(range: RangeKey): number | null {
  const now = Date.now();
  if (range === "all") return null;
  const days = range === "7d" ? 7 : 30;
  return now - days * 24 * 60 * 60 * 1000;
}

type BucketRow = { text: string; endedAt: number; callId: string };

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur-xl sm:px-5 sm:py-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-white sm:text-4xl">
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-xs leading-snug text-zinc-500">{hint}</p>
      ) : null}
    </div>
  );
}

export default function DashboardPage() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [calls, setCalls] = useState<StoredCall[]>(() =>
    typeof window !== "undefined" ? loadStoredCalls() : [],
  );
  const [collapsedBuckets, setCollapsedBuckets] = useState<Set<string>>(
    () => new Set(),
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

  const analytics = useMemo(() => computeDashboardAnalytics(calls), [calls]);

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

  const topBucketsToday = useMemo(() => {
    const entries = [...analytics.tasksByBucketToday.entries()].sort(
      (a, b) => b[1] - a[1],
    );
    return entries.slice(0, 4);
  }, [analytics.tasksByBucketToday]);

  const toggleBucket = useCallback((id: string) => {
    setCollapsedBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setCollapsedBuckets(new Set()), []);
  const collapseAll = useCallback(
    () => setCollapsedBuckets(new Set(orderedBuckets)),
    [orderedBuckets],
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
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
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

        <section
          aria-label="Analytics overview"
          className="mb-10 rounded-2xl border border-cyan-500/15 bg-zinc-950/50 p-5 shadow-[0_0_40px_-20px_rgba(34,211,238,0.2)] backdrop-blur-xl sm:p-6"
        >
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/90">
                Analytics
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Based on your saved calls (local time). Category list below uses
                the date range you selected.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Tasks today"
              value={analytics.tasksToday}
              hint="Action items from calls ended today."
            />
            <StatCard
              label="Calls today"
              value={analytics.callsToday}
              hint="Voice sessions completed today."
            />
            <StatCard
              label="Tasks this week"
              value={analytics.tasksThisWeek}
              hint="Since Monday, local time."
            />
            <StatCard
              label="All time"
              value={analytics.tasksAllTime}
              hint={`${analytics.callsAllTime} saved calls total.`}
            />
          </div>
          {topBucketsToday.length > 0 && (
            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Today by category
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {topBucketsToday.map(([bucketId, count]) => (
                  <li
                    key={bucketId}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300"
                  >
                    <span className="font-medium text-zinc-100">
                      {labelForBucket(bucketId)}
                    </span>
                    <span className="ml-1.5 tabular-nums text-zinc-500">
                      {count}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <p className="mb-4 text-sm text-zinc-500">
          <span className="font-medium text-zinc-400">{filteredCalls.length}</span>{" "}
          calls ·{" "}
          <span className="font-medium text-zinc-400">{totalActions}</span>{" "}
          action items in selected range
        </p>

        {orderedBuckets.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white"
            >
              Expand all categories
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white"
            >
              Collapse all
            </button>
          </div>
        )}

        {orderedBuckets.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-10 text-center text-zinc-400 backdrop-blur-sm">
            No saved actions in this range yet. End a call from the home page
            to record a summary here.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-1 lg:grid-cols-2">
            {orderedBuckets.map((bucketId) => {
              const rows = byBucket.get(bucketId) ?? [];
              const expanded = !collapsedBuckets.has(bucketId);
              const panelId = `bucket-panel-${bucketId}`;
              const headerId = `bucket-header-${bucketId}`;

              return (
                <article
                  key={bucketId}
                  className="flex flex-col rounded-2xl border border-white/10 bg-zinc-950/80 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur-xl"
                >
                  <button
                    type="button"
                    id={headerId}
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => toggleBucket(bucketId)}
                    className="flex w-full items-center justify-between gap-3 rounded-t-2xl border-b border-white/10 px-5 py-4 text-left transition hover:bg-white/[0.04]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {expanded ? (
                        <ChevronDown
                          className="h-4 w-4 shrink-0 text-zinc-500"
                          strokeWidth={2}
                          aria-hidden
                        />
                      ) : (
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-zinc-500"
                          strokeWidth={2}
                          aria-hidden
                        />
                      )}
                      <h2 className="truncate text-lg font-semibold text-white">
                        {labelForBucket(bucketId)}
                      </h2>
                    </span>
                    <span className="shrink-0 rounded-full bg-violet-500/20 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-violet-200">
                      {rows.length}
                    </span>
                  </button>
                  {expanded ? (
                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={headerId}
                      className="px-5 pb-5 pt-4"
                    >
                      <ul className="max-h-80 space-y-3 overflow-y-auto text-sm">
                        {rows.map((row, i) => (
                          <li
                            key={`${row.callId}-${i}-${row.text.slice(0, 24)}`}
                            className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2.5"
                          >
                            <p className="text-pretty text-zinc-200">
                              {row.text}
                            </p>
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
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
