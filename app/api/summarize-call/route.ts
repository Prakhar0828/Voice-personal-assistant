import { NextResponse } from "next/server";
import {
  type ActionItem,
  BUCKET_IDS,
  normalizeBucket,
  parseActionItemsFromApi,
} from "@/lib/call-history";
import {
  fallbackAccomplishmentsFromMessages,
  fallbackActionItemsFromMessages,
} from "@/lib/summary-fallback";

type ChatMessage = { role: string; text: string };

type SummaryBody = {
  actionItems: ActionItem[];
  accomplishments: string[];
};

function deriveFromTranscript(messages: ChatMessage[]): SummaryBody {
  return {
    actionItems: fallbackActionItemsFromMessages(messages),
    accomplishments: fallbackAccomplishmentsFromMessages(messages),
  };
}

/** Drop noise tokens; dedupe identical lines (streaming often repeats). */
function polishActionItems(items: ActionItem[]): ActionItem[] {
  const seen = new Set<string>();
  const out: ActionItem[] = [];
  for (const it of items) {
    const text = it.text.trim();
    if (text.length < 12) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      text,
      bucket: normalizeBucket(it.bucket),
    });
  }
  return out;
}

const BUCKET_LIST = BUCKET_IDS.join(", ");

const DEFAULT_SUMMARY_MODEL = "gpt-4o";

async function summarizeWithOpenAI(
  messages: ChatMessage[],
  apiKey: string,
): Promise<SummaryBody | null> {
  const model =
    process.env.OPENAI_SUMMARY_MODEL?.trim() || DEFAULT_SUMMARY_MODEL;

  const transcript = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
    .join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You analyze a voice-assistant call transcript. The USER text may arrive as many short lines (streaming) — do NOT treat each line as a separate task.

Your job: infer what the user actually wanted, then output a SMALL number of clear action items (usually 1–6), each with the right category.

Return ONLY valid JSON:
{ "actionItems": [ { "text": string, "bucket": string } ], "accomplishments": string[] }

Rules for actionItems:
- One object per DISTINCT task or deliverable (e.g. research → draft post → email). NOT one per sentence fragment, NOT one per transcript line, NOT word-by-word.
- "text" must be a full readable sentence: what to do + topic/details when known (e.g. "Research current trends on renewable energy in the EU", "Draft a LinkedIn post summarizing that research", "Email the post to the user").
- "bucket" must be EXACTLY one of: ${BUCKET_LIST}

Bucket guide:
- web_research: look things up online, search, compare sources, facts
- social_media: LinkedIn/Twitter/X/social posts, social copy (not email)
- email: send, draft, or find mail; inbox
- calendar: meetings, scheduling, availability
- messaging: SMS, Slack, WhatsApp, DMs (not email)
- documents: files, PDFs, Google Docs, long-form writing that is not social
- coding: code, APIs, debugging
- shopping: purchases, carts, product search
- reminders: todos, alarms, follow-ups
- phone_calls: phone calls, dial
- general: only if nothing else fits
- other: none of the above

accomplishments: short bullets of what the ASSISTANT said or committed to (merge assistant fragments; do not split per line).

Example (compound request):
USER said: "do web research on AI chips, write a LinkedIn post, email it to me"
Good actionItems:
[
  { "text": "Research AI chips on the web (topic as stated by user).", "bucket": "web_research" },
  { "text": "Draft a LinkedIn post based on the research about AI chips.", "bucket": "social_media" },
  { "text": "Send the LinkedIn post (or summary) to the user by email.", "bucket": "email" }
]
Bad: dozens of items, or items that are only 1–3 words.`,
        },
        {
          role: "user",
          content: `Transcript (USER/ASSISTANT lines may be partial — infer intent):\n\n${transcript}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("actionItems" in parsed) ||
      !("accomplishments" in parsed)
    ) {
      return null;
    }
    let actionItems = parseActionItemsFromApi(
      (parsed as { actionItems: unknown }).actionItems,
    );
    actionItems = polishActionItems(actionItems);
    if (actionItems.length === 0) {
      return null;
    }
    const accRaw = (parsed as { accomplishments: unknown }).accomplishments;
    let accomplishments = Array.isArray(accRaw)
      ? accRaw.filter(
          (s): s is string => typeof s === "string" && s.trim().length > 0,
        )
      : [];
    accomplishments = accomplishments
      .map((s) => s.trim())
      .filter((s) => s.length >= 8);
    if (accomplishments.length === 0) {
      accomplishments = fallbackAccomplishmentsFromMessages(messages);
    }
    return { actionItems, accomplishments };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messages = (body as { messages?: ChatMessage[] }).messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ actionItems: [], accomplishments: [] });
  }

  const key = process.env.OPENAI_API_KEY?.trim();
  if (key) {
    const ai = await summarizeWithOpenAI(messages, key);
    if (ai) {
      return NextResponse.json(ai);
    }
  }

  return NextResponse.json(deriveFromTranscript(messages));
}
