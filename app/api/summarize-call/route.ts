import { NextResponse } from "next/server";
import {
  type ActionItem,
  BUCKET_IDS,
  parseActionItemsFromApi,
} from "@/lib/call-history";

type ChatMessage = { role: string; text: string };

type SummaryBody = {
  actionItems: ActionItem[];
  accomplishments: string[];
};

function deriveFromTranscript(messages: ChatMessage[]): SummaryBody {
  const actionItems: ActionItem[] = messages
    .filter((m) => m.role === "user")
    .map((m) => m.text.trim())
    .filter(Boolean)
    .map((text) => ({ text, bucket: "general" }));
  const accomplishments = messages
    .filter((m) => m.role === "assistant")
    .map((m) => m.text.trim())
    .filter(Boolean);
  return { actionItems, accomplishments };
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
          content: `You summarize a voice assistant conversation. Return ONLY valid JSON with:
- "actionItems": array of objects, each { "text": string, "bucket": string }
- "accomplishments": array of short strings (what the assistant said or did)

For each user request in actionItems, set "bucket" to EXACTLY one of: ${BUCKET_LIST}

Bucket meanings:
- web_research: look things up online, search, facts, news, prices
- email: send/draft/check/search email
- calendar: schedule, meetings, events, availability
- messaging: SMS, Slack, WhatsApp, DM (not email)
- documents: files, PDFs, notes, write/edit docs
- coding: code, scripts, APIs, debugging
- shopping: buy, orders, carts, product search
- reminders: reminders, todos, alarms, follow-ups
- phone_calls: dial, call someone, phone tree
- general: chit-chat, unclear, or multi-topic without a dominant type
- other: fits none of the above

Merge duplicate requests. Skip empty small talk unless it is the only content.
accomplishments: assistant turns only; brief bullets.`,
        },
        {
          role: "user",
          content: `Conversation:\n${transcript}`,
        },
      ],
      temperature: 0.25,
      max_tokens: 1400,
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
    const actionItems = parseActionItemsFromApi(
      (parsed as { actionItems: unknown }).actionItems,
    );
    const accRaw = (parsed as { accomplishments: unknown }).accomplishments;
    const accomplishments = Array.isArray(accRaw)
      ? accRaw.filter(
          (s): s is string => typeof s === "string" && s.trim().length > 0,
        )
      : [];
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
    return NextResponse.json(
      { actionItems: [], accomplishments: [] },
      { status: 200 },
    );
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
