/**
 * Client-side history for call summaries (localStorage).
 * Used by the home page (persist) and /dashboard (aggregate buckets).
 */

export type ActionItem = {
  text: string;
  /** Normalized bucket id from summarize API or "general". */
  bucket: string;
};

export type CallSummary = {
  actionItems: ActionItem[];
  accomplishments: string[];
};

export type StoredCall = {
  id: string;
  endedAt: number;
  actionItems: ActionItem[];
  accomplishments: string[];
};

const STORAGE_KEY = "vpa-call-history-v1";
const MAX_CALLS = 200;

export const BUCKET_IDS = [
  "web_research",
  "email",
  "calendar",
  "messaging",
  "documents",
  "coding",
  "shopping",
  "reminders",
  "phone_calls",
  "general",
  "other",
] as const;

export type BucketId = (typeof BUCKET_IDS)[number];

export const BUCKET_LABELS: Record<string, string> = {
  web_research: "Web research",
  email: "Email",
  calendar: "Calendar & scheduling",
  messaging: "Messaging & chat",
  documents: "Documents & notes",
  coding: "Coding & technical",
  shopping: "Shopping & orders",
  reminders: "Reminders & tasks",
  phone_calls: "Calls & phone",
  general: "General",
  other: "Other",
};

const BUCKET_SET = new Set<string>(BUCKET_IDS);

export function normalizeBucket(raw: string | undefined): string {
  const b = (raw ?? "general").toLowerCase().trim().replace(/\s+/g, "_");
  if (BUCKET_SET.has(b)) return b;
  return "general";
}

export function labelForBucket(bucket: string): string {
  return BUCKET_LABELS[bucket] ?? BUCKET_LABELS.other;
}

type StoreV1 = { version: 1; calls: StoredCall[] };

export function loadStoredCalls(): StoredCall[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoreV1;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.calls)) {
      return [];
    }
    return parsed.calls;
  } catch {
    return [];
  }
}

export function appendStoredCall(record: StoredCall): void {
  if (typeof window === "undefined") return;
  try {
    const prev = loadStoredCalls();
    const without = prev.filter((c) => c.id !== record.id);
    const calls = [record, ...without].slice(0, MAX_CALLS);
    const payload: StoreV1 = { version: 1, calls };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new Event("vpa-call-history"));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearStoredCalls(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("vpa-call-history"));
}

/** Normalize API / fallback payload into typed action items. */
export function parseActionItemsFromApi(raw: unknown): ActionItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ActionItem[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const t = item.trim();
      if (t) out.push({ text: t, bucket: "general" });
    } else if (item && typeof item === "object" && "text" in item) {
      const text = String((item as { text: unknown }).text).trim();
      if (!text) continue;
      const bucket = normalizeBucket(
        String((item as { bucket?: unknown }).bucket ?? "general"),
      );
      out.push({ text, bucket });
    }
  }
  return out;
}
