import { NextResponse } from "next/server";

type ToolCallItem = {
  id?: string;
  name?: string;
  parameters?: Record<string, unknown>;
};

/**
 * Vapi Server URL handler. If your assistant only uses Vapi built-in tools
 * (Gmail, Calendar, etc.), you may leave this URL unset in the dashboard.
 * Add custom function tools here when you need server-side execution.
 *
 * @see https://docs.vapi.ai/server-url/events
 */
export async function POST(request: Request) {
  const secret = process.env.VAPI_WEBHOOK_SECRET?.trim();
  if (secret) {
    const header =
      request.headers.get("x-vapi-secret") ??
      request.headers.get("x-api-key") ??
      "";
    if (header !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = (body as { message?: { type?: string } }).message;
  if (!message || typeof message !== "object") {
    return NextResponse.json({ ok: true });
  }

  const msg = message as {
    type?: string;
    toolCallList?: ToolCallItem[];
  };

  if (msg.type === "tool-calls" && Array.isArray(msg.toolCallList)) {
    const results = msg.toolCallList.map((tc) => {
      const toolCallId = tc.id ?? "";
      const name = tc.name ?? "unknown";
      const payload = {
        ok: true,
        message:
          "Custom tool execution is not implemented in this app. Use Vapi dashboard integrations or extend app/api/vapi/webhook/route.ts.",
        requestedTool: name,
        parameters: tc.parameters ?? {},
      };
      return {
        name,
        toolCallId,
        result: JSON.stringify(payload),
      };
    });
    return NextResponse.json({ results });
  }

  return NextResponse.json({ ok: true });
}
