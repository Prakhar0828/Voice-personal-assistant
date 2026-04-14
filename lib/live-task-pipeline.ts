import { BUCKET_IDS } from "@/lib/call-history";

/** Buckets we can detect from speech (skip vague categories for the live chart). */
const DETECTABLE_BUCKETS = BUCKET_IDS.filter(
  (id) => id !== "general" && id !== "other",
);

/**
 * Return the first match index in `text`, or -1.
 * Patterns are checked in order; earliest wins per bucket.
 */
function firstIndexForBucket(text: string, bucket: string): number {
  const t = text.toLowerCase();
  const patterns: Record<string, RegExp[]> = {
    web_research: [
      /\b(research|researched|look\s*up|lookup|search\s*(the\s*)?(web|online|internet)|google|browse|on\s+the\s+web|find\s+out|fact-?check)\b/i,
      /\bweb\s+research\b/i,
    ],
    email: [
      /\b(e-?mail|email|inbox|send\s+(me\s+)?(an\s+)?mail|mail\s+me|smtp|gmail|outlook)\b/i,
    ],
    calendar: [
      /\b(calendar|schedule|meeting|invite|availability|book\s+(a\s+)?slot|reschedule|appointment)\b/i,
    ],
    messaging: [
      /\b(sms|text\s+me|whatsapp|slack|telegram|dm|direct\s+message|message\s+me)\b/i,
    ],
    social_media: [
      /\b(linkedin|twitter|x\.com|\bx\b|instagram|facebook|social\s+post|post\s+on|draft\s+a\s+post)\b/i,
    ],
    documents: [
      /\b(document|pdf|notes|notion|google\s+doc|write\s+up|memo|report)\b/i,
    ],
    coding: [
      /\b(code|script|api|debug|github|deploy|program|function|bug)\b/i,
    ],
    shopping: [
      /\b(buy|purchase|order|cart|checkout|amazon|shopping)\b/i,
    ],
    reminders: [
      /\b(remind|reminder|todo|to-?do|alarm|follow\s*up|don'?t\s+forget)\b/i,
    ],
    phone_calls: [
      /\b(call\s+(him|her|them|me)?|dial|phone\s+number|ring\s+up)\b/i,
      /\bphone\s+call\b/i,
    ],
  };

  const regs = patterns[bucket];
  if (!regs) return -1;
  let best = -1;
  for (const re of regs) {
    const m = t.match(re);
    if (m && m.index !== undefined) {
      if (best === -1 || m.index < best) best = m.index;
    }
  }
  return best;
}

/**
 * Ordered unique buckets by **first mention** in cumulative user text (left-to-right).
 */
export function inferOrderedBuckets(userFinalLines: string[]): string[] {
  const text = userFinalLines.join(" ").trim();
  if (!text) return [];

  const hits: { bucket: string; idx: number }[] = [];
  for (const bucket of DETECTABLE_BUCKETS) {
    const idx = firstIndexForBucket(text, bucket);
    if (idx >= 0) hits.push({ bucket, idx });
  }
  hits.sort((a, b) => a.idx - b.idx);

  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const h of hits) {
    if (seen.has(h.bucket)) continue;
    seen.add(h.bucket);
    ordered.push(h.bucket);
  }
  return ordered;
}

type TranscriptLine = { role: string; text: string };

/** Short agent name for live UI (aligned with dashboard buckets). */
export function agentShortName(bucket: string): string {
  const map: Record<string, string> = {
    web_research: "Web research",
    email: "Email",
    calendar: "Calendar",
    messaging: "Messaging",
    social_media: "LinkedIn & social",
    documents: "Documents",
    coding: "Coding",
    shopping: "Shopping",
    reminders: "Reminders",
    phone_calls: "Phone",
  };
  return map[bucket] ?? bucket.replace(/_/g, " ");
}

function bucketRelevancePattern(bucket: string): RegExp {
  const p: Record<string, RegExp> = {
    web_research:
      /\b(research|search|look\s*up|lookup|google|web|online|findings?|sources?|article|data)\b/i,
    email: /\b(email|e-?mail|inbox|mail|message|smtp|gmail|outlook)\b/i,
    calendar:
      /\b(calendar|schedule|meeting|invite|slot|appointment|availability)\b/i,
    messaging: /\b(sms|text|whatsapp|slack|telegram|dm|message)\b/i,
    social_media:
      /\b(linkedin|twitter|instagram|facebook|social|post|draft)\b/i,
    documents: /\b(document|pdf|notes|notion|memo|report|write[\s-]?up)\b/i,
    coding: /\b(code|script|api|debug|github|deploy|bug|function)\b/i,
    shopping: /\b(buy|order|cart|checkout|amazon|purchase)\b/i,
    reminders: /\b(remind|reminder|todo|to-?do|alarm|follow[\s-]?up)\b/i,
    phone_calls: /\b(call|dial|phone|ring)\b/i,
  };
  return p[bucket] ?? /\b\w+\b/;
}

/**
 * True if assistant text after the user’s first mention of this bucket looks
 * like that task is done (completion cues + optional bucket relevance).
 */
export function assistantShowsCompletionForBucket(
  bucket: string,
  assistantText: string,
): boolean {
  const t = assistantText.trim();
  if (!t) return false;
  const low = t.toLowerCase();
  const rel = bucketRelevancePattern(bucket);

  const genericDone =
    /\b(done|finished|completed|all set|wrapped\s+up|taken\s+care\s+of|you'?re\s+set|that'?s\s+(done|ready|sent|posted|scheduled)|sent(?:\s+it)?|i(?:'ve| have)\s+sent|i(?:'ve| have)\s+emailed|i(?:'ve| have)\s+posted|posted\s+it|scheduled\s+it|draft(?:'s| is)\s+ready|here\s+you\s+go|here\s+('s|are)|ready\s+for\s+you|anything\s+else)\b/i.test(
      low,
    );

  if (genericDone && rel.test(low)) return true;
  if (genericDone && t.length > 50) return true;

  switch (bucket) {
    case "web_research":
      return (
        rel.test(low) &&
        /\b(here('s| are)|i\s+found|based\s+on|sources?:|looked\s+(up|into)|summary|key\s+points)\b/i.test(
          low,
        ) &&
        t.length > 55
      );
    case "email":
      return (
        /\b(i(?:'ve| have)\s+(sent|drafted|written)|email\s+(is\s+)?(sent|ready)|your\s+(draft|message|email))\b/i.test(
          low,
        ) && rel.test(low)
      );
    case "social_media":
      return (
        /\b(draft(?:'s| is)?\s+ready|post\s+(is\s+)?ready|here'?s\s+(your|the)\s+(post|draft)|linkedin|caption)\b/i.test(
          low,
        ) && rel.test(low)
      );
    case "calendar":
      return (
        /\b(scheduled|added\s+to\s+your\s+calendar|invite\s+sent|you'?re\s+booked)\b/i.test(
          low,
        ) && rel.test(low)
      );
    case "documents":
      return (
        /\b(document|draft|notes?)\s+(is\s+)?ready|i(?:'ve| have)\s+(written|drafted|created)\b/i.test(
          low,
        ) && rel.test(low)
      );
    case "coding":
      return (
        /\b(here'?s\s+the\s+(code|fix|snippet)|deployed|pushed|should\s+work\s+now)\b/i.test(
          low,
        ) && rel.test(low)
      );
    case "reminders":
      return (
        /\b(reminder\s+set|i(?:'ve| have)\s+set\s+(a\s+)?reminder|alarm\s+set)\b/i.test(
          low,
        ) && rel.test(low)
      );
    case "messaging":
      return (
        /\b(sent\s+(the\s+)?message|message\s+sent|posted\s+in\s+slack)\b/i.test(
          low,
        ) && rel.test(low)
      );
    case "shopping":
      return (
        /\b(ordered|checkout\s+complete|added\s+to\s+cart|here'?s\s+the\s+link)\b/i.test(
          low,
        ) && rel.test(low)
      );
    case "phone_calls":
      return (
        /\b(call(?:ing)?\s+(them|him|her)|dialed|connected|i(?:'ve| have)\s+called)\b/i.test(
          low,
        ) && rel.test(low)
      );
    default:
      return false;
  }
}

/**
 * For each bucket in `orderedBuckets`, whether assistant transcript after the
 * user first implied that bucket suggests the task is complete.
 */
export function inferBucketCompletions(
  orderedBuckets: string[],
  lines: TranscriptLine[],
): boolean[] {
  const out = orderedBuckets.map(() => false);
  if (orderedBuckets.length === 0 || lines.length === 0) return out;

  const firstUserMsgIndex = new Map<string, number>();
  const userPieces: string[] = [];

  for (let mi = 0; mi < lines.length; mi++) {
    const line = lines[mi];
    if (line.role !== "user") continue;
    userPieces.push(line.text);
    const ord = inferOrderedBuckets(userPieces);
    for (const b of ord) {
      if (!firstUserMsgIndex.has(b)) firstUserMsgIndex.set(b, mi);
    }
  }

  for (let i = 0; i < orderedBuckets.length; i++) {
    const b = orderedBuckets[i];
    const start = firstUserMsgIndex.get(b);
    if (start === undefined) continue;
    const assistantChunks: string[] = [];
    for (let mi = start + 1; mi < lines.length; mi++) {
      if (lines[mi].role === "assistant") assistantChunks.push(lines[mi].text);
    }
    const assistantAfter = assistantChunks.join(" ");
    out[i] = assistantShowsCompletionForBucket(b, assistantAfter);
  }

  return out;
}

/** Rightmost incomplete bucket index, or -1 if all complete or empty. */
export function activeBucketIndexFromCompletions(complete: boolean[]): number {
  for (let i = complete.length - 1; i >= 0; i--) {
    if (!complete[i]) return i;
  }
  return -1;
}
