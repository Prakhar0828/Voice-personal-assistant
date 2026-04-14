import type { ActionItem } from "@/lib/call-history";

type ChatMessage = { role: string; text: string };

/**
 * When OpenAI is unavailable, merge all user transcript chunks into one summary line
 * so we do not create one "task" per streaming word/phrase.
 */
export function fallbackActionItemsFromMessages(
  messages: ChatMessage[],
): ActionItem[] {
  const userText = messages
    .filter((m) => m.role === "user")
    .map((m) => m.text.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!userText) return [];
  const text =
    userText.length > 900 ? `${userText.slice(0, 897)}…` : userText;
  return [{ text, bucket: "general" }];
}

export function fallbackAccomplishmentsFromMessages(
  messages: ChatMessage[],
): string[] {
  const assistantText = messages
    .filter((m) => m.role === "assistant")
    .map((m) => m.text.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!assistantText) return [];
  const text =
    assistantText.length > 1200
      ? `${assistantText.slice(0, 1197)}…`
      : assistantText;
  return [text];
}
