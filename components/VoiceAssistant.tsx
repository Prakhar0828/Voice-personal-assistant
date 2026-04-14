"use client";

import Vapi from "@vapi-ai/web";
import { Mic, MicOff, PhoneCall, PhoneOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceVisualizer } from "@/components/VoiceVisualizer";
import {
  appendStoredCall,
  type CallSummary,
  labelForBucket,
  parseActionItemsFromApi,
} from "@/lib/call-history";

type TranscriptLine = { role: string; text: string };

type SummaryCardRecord = {
  id: string;
  endedAt: number;
  loading: boolean;
  summary: CallSummary | null;
};

const HINT =
  "“Jarvis, summarize my pending neural connections.”";

function getConfigError(): string | null {
  const key = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY?.trim();
  const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID?.trim();
  if (!key || !assistantId) {
    return "Set NEXT_PUBLIC_VAPI_PUBLIC_KEY and NEXT_PUBLIC_VAPI_ASSISTANT_ID in .env.local (see .env.example).";
  }
  return null;
}

function deriveSummaryLocal(lines: TranscriptLine[]): CallSummary {
  return {
    actionItems: lines
      .filter((l) => l.role === "user")
      .map((l) => l.text.trim())
      .filter(Boolean)
      .map((text) => ({ text, bucket: "general" })),
    accomplishments: lines
      .filter((l) => l.role === "assistant")
      .map((l) => l.text.trim())
      .filter(Boolean),
  };
}

function formatEndedAt(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function persistCompletedCall(
  id: string,
  endedAt: number,
  summary: CallSummary,
) {
  appendStoredCall({
    id,
    endedAt,
    actionItems: summary.actionItems,
    accomplishments: summary.accomplishments,
  });
}

function CallSummaryCard({ card }: { card: SummaryCardRecord }) {
  const s = card.summary;

  return (
    <article className="flex flex-col rounded-2xl border border-white/10 bg-zinc-950/80 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_20px_50px_-24px_rgba(0,0,0,0.7)] backdrop-blur-xl">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-4">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Call summary
        </span>
        <time
          className="text-xs font-medium text-zinc-400 tabular-nums"
          dateTime={new Date(card.endedAt).toISOString()}
        >
          {formatEndedAt(card.endedAt)}
        </time>
      </header>

      {card.loading ? (
        <p className="animate-pulse text-sm text-zinc-400">Summarizing…</p>
      ) : s ? (
        <>
          {s.actionItems.length === 0 && s.accomplishments.length === 0 ? (
            <p className="text-sm text-zinc-400">
              No final transcript was captured for this call. Speak for a
              moment before ending, or check that transcripts are enabled for
              your assistant.
            </p>
          ) : (
            <div className="space-y-5 text-sm">
              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-cyan-300/90">
                  Your requests
                </h4>
                {s.actionItems.length === 0 ? (
                  <p className="text-zinc-500">No clear requests detected.</p>
                ) : (
                  <ul className="space-y-2 text-zinc-300">
                    {s.actionItems.map((item, i) => (
                      <li
                        key={i}
                        className="flex flex-col gap-1.5 rounded-lg border border-cyan-500/10 bg-cyan-500/5 px-3 py-2 text-pretty sm:flex-row sm:items-start sm:gap-3"
                      >
                        <span className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-200/90">
                          {labelForBucket(item.bucket)}
                        </span>
                        <span className="flex min-w-0 flex-1 gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400/80 sm:mt-2" />
                          <span>{item.text}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-violet-300/90">
                  Assistant actions &amp; replies
                </h4>
                {s.accomplishments.length === 0 ? (
                  <p className="text-zinc-500">No assistant replies captured.</p>
                ) : (
                  <ul className="space-y-2 text-zinc-300">
                    {s.accomplishments.map((item, i) => (
                      <li
                        key={i}
                        className="flex gap-2 rounded-lg border border-violet-500/10 bg-violet-500/5 px-3 py-2 text-pretty"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400/80" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </>
      ) : null}
    </article>
  );
}

export function VoiceAssistant() {
  const configError = getConfigError();
  const vapiRef = useRef<Vapi | null>(null);
  const transcriptRef = useRef<TranscriptLine[]>([]);
  const [connected, setConnected] = useState(false);
  const [assistantSpeaking, setAssistantSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [assistantVolume, setAssistantVolume] = useState(0);
  const [summaryCards, setSummaryCards] = useState<SummaryCardRecord[]>([]);

  useEffect(() => {
    if (configError) return;

    const key = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY!.trim();
    const vapi = new Vapi(key);
    vapiRef.current = vapi;

    const onCallStart = () => {
      setConnected(true);
      setLastError(null);
    };

    const runSummary = (lines: TranscriptLine[]) => {
      const id = crypto.randomUUID();
      const endedAt = Date.now();

      if (lines.length === 0) {
        const empty: CallSummary = { actionItems: [], accomplishments: [] };
        setSummaryCards((prev) => [
          {
            id,
            endedAt,
            loading: false,
            summary: empty,
          },
          ...prev,
        ]);
        persistCompletedCall(id, endedAt, empty);
        return;
      }

      setSummaryCards((prev) => [
        { id, endedAt, loading: true, summary: null },
        ...prev,
      ]);

      void (async () => {
        let next: CallSummary;
        try {
          const res = await fetch("/api/summarize-call", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: lines.map(({ role, text }) => ({ role, text })),
            }),
          });
          if (!res.ok) {
            next = deriveSummaryLocal(lines);
          } else {
            const data = (await res.json()) as {
              actionItems?: unknown;
              accomplishments?: unknown;
            };
            next = {
              actionItems: parseActionItemsFromApi(data.actionItems),
              accomplishments: Array.isArray(data.accomplishments)
                ? data.accomplishments.filter(
                    (s): s is string =>
                      typeof s === "string" && s.trim().length > 0,
                  )
                : [],
            };
          }
        } catch {
          next = deriveSummaryLocal(lines);
        }
        setSummaryCards((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, loading: false, summary: next } : c,
          ),
        );
        persistCompletedCall(id, endedAt, next);
      })();
    };

    const onCallEnd = () => {
      setConnected(false);
      setAssistantSpeaking(false);
      setAssistantVolume(0);
      const lines = [...transcriptRef.current];
      runSummary(lines);
    };

    const onMessage = (message: Record<string, unknown>) => {
      if (
        message.type === "transcript" &&
        message.transcriptType === "final" &&
        typeof message.transcript === "string"
      ) {
        const role =
          message.role === "user" || message.role === "assistant"
            ? message.role
            : "unknown";
        const line: TranscriptLine = { role, text: message.transcript as string };
        transcriptRef.current = [...transcriptRef.current, line];
      }
    };
    const onError = (err: unknown) => {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : JSON.stringify(err);
      setLastError(msg);
    };
    const onSpeechStart = () => setAssistantSpeaking(true);
    const onSpeechEnd = () => setAssistantSpeaking(false);
    const onVolume = (volume: number) => {
      setAssistantVolume(typeof volume === "number" ? volume : 0);
    };

    vapi.on("call-start", onCallStart);
    vapi.on("call-end", onCallEnd);
    vapi.on("speech-start", onSpeechStart);
    vapi.on("speech-end", onSpeechEnd);
    vapi.on("message", onMessage);
    vapi.on("error", onError);
    vapi.on("volume-level", onVolume);

    return () => {
      vapi.removeListener("call-start", onCallStart);
      vapi.removeListener("call-end", onCallEnd);
      vapi.removeListener("speech-start", onSpeechStart);
      vapi.removeListener("speech-end", onSpeechEnd);
      vapi.removeListener("message", onMessage);
      vapi.removeListener("error", onError);
      vapi.removeListener("volume-level", onVolume);
      void vapi.stop();
      vapiRef.current = null;
    };
  }, [configError]);

  const startCall = useCallback(async () => {
    if (configError || !vapiRef.current) return;
    setLastError(null);
    transcriptRef.current = [];
    setMuted(false);
    const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID!.trim();
    await vapiRef.current.start(assistantId);
  }, [configError]);

  const endCall = useCallback(() => {
    vapiRef.current?.end();
  }, []);

  const toggleMute = useCallback(() => {
    const vapi = vapiRef.current;
    if (!vapi) return;
    const next = !vapi.isMuted();
    vapi.setMuted(next);
    setMuted(next);
  }, []);

  const visualPhase = !connected
    ? "idle"
    : assistantSpeaking
      ? "speaking"
      : "listening";

  const headline = !connected
    ? "Making you 10x productive every day."
    : assistantSpeaking
      ? "Assistant is speaking…"
      : "Listening for command…";

  const subline = !connected
    ? HINT
    : assistantSpeaking
      ? "You can interrupt or wait for the reply."
      : HINT;

  if (configError) {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-950/40 p-6 text-amber-100 backdrop-blur-sm">
        <p className="font-medium">Configuration needed</p>
        <p className="mt-2 text-sm text-amber-200/90">{configError}</p>
      </div>
    );
  }

  const iconBtnBase =
    "inline-flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full transition-transform duration-200 ease-out hover:scale-[1.12] active:scale-95 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400";

  return (
    <div className="flex w-full max-w-3xl flex-col gap-10">
      <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/90 p-8 pb-10 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_25px_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:p-10">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-violet-600/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-cyan-500/15 blur-3xl"
          aria-hidden
        />

        <VoiceVisualizer
          phase={visualPhase}
          assistantVolume={assistantVolume}
        />

        <div className="relative mt-8 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {headline}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-pretty text-sm italic leading-relaxed text-zinc-400 sm:text-base">
            {subline}
          </p>
        </div>

        <div className="relative mt-10 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={startCall}
            disabled={connected}
            title="Start call"
            aria-label="Start call"
            className={`${iconBtnBase} text-white shadow-[0_0_28px_rgba(34,211,238,0.35)] disabled:opacity-40`}
            style={{
              background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
            }}
          >
            <PhoneCall className="h-6 w-6" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={endCall}
            disabled={!connected}
            title="End call"
            aria-label="End call"
            className={`${iconBtnBase} border border-red-400/40 bg-red-500/15 text-red-200 hover:bg-red-500/25 disabled:opacity-35`}
          >
            <PhoneOff className="h-6 w-6" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={toggleMute}
            disabled={!connected}
            title={muted ? "Unmute microphone" : "Mute microphone"}
            aria-label={muted ? "Unmute microphone" : "Mute microphone"}
            className={`${iconBtnBase} border border-white/15 bg-white/5 text-zinc-100 hover:bg-white/10 disabled:opacity-35`}
          >
            {muted ? (
              <MicOff className="h-6 w-6" strokeWidth={1.75} />
            ) : (
              <Mic className="h-6 w-6" strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>

      {lastError && (
        <div className="rounded-2xl border border-red-500/40 bg-red-950/50 px-4 py-3 text-sm text-red-100 backdrop-blur-sm">
          {lastError}
        </div>
      )}

      {summaryCards.length > 0 && (
        <section aria-label="Call summaries">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Call summaries
          </h3>
          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
            {summaryCards.map((card) => (
              <CallSummaryCard key={card.id} card={card} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
