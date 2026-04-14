import type { StoredCall } from "@/lib/call-history";

export type DashboardAnalytics = {
  tasksToday: number;
  callsToday: number;
  tasksThisWeek: number;
  callsThisWeek: number;
  tasksAllTime: number;
  callsAllTime: number;
  /** bucket id → count for action items ending today */
  tasksByBucketToday: Map<string, number>;
};

function startOfLocalDay(ts: number = Date.now()): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Monday 00:00 local (same week as `ts`). */
function startOfLocalWeekMonday(ts: number = Date.now()): number {
  const d = new Date(startOfLocalDay(ts));
  const day = d.getDay();
  const offsetFromMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offsetFromMonday);
  return d.getTime();
}

export function computeDashboardAnalytics(calls: StoredCall[]): DashboardAnalytics {
  const todayStart = startOfLocalDay();
  const weekStart = startOfLocalWeekMonday();

  let tasksToday = 0;
  let callsToday = 0;
  let tasksThisWeek = 0;
  let callsThisWeek = 0;
  const tasksByBucketToday = new Map<string, number>();

  for (const c of calls) {
    const n = c.actionItems.length;
    if (c.endedAt >= todayStart) {
      callsToday += 1;
      tasksToday += n;
      for (const a of c.actionItems) {
        const b = a.bucket || "general";
        tasksByBucketToday.set(b, (tasksByBucketToday.get(b) ?? 0) + 1);
      }
    }
    if (c.endedAt >= weekStart) {
      callsThisWeek += 1;
      tasksThisWeek += n;
    }
  }

  const tasksAllTime = calls.reduce((s, c) => s + c.actionItems.length, 0);

  return {
    tasksToday,
    callsToday,
    tasksThisWeek,
    callsThisWeek,
    tasksAllTime,
    callsAllTime: calls.length,
    tasksByBucketToday,
  };
}
