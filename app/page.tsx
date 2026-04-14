import { VoiceAssistant } from "@/components/VoiceAssistant";

export default function Home() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col items-center overflow-hidden bg-[#070708] px-4 py-12 sm:py-20">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(109,40,217,0.22),transparent),radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(6,182,212,0.12),transparent)]"
        aria-hidden
      />
      <main className="relative z-10 w-full max-w-4xl px-2 sm:px-0">
        <p className="text-center text-[10px] font-semibold uppercase tracking-[0.35em] text-zinc-500">
          Voice
        </p>
        <h1 className="mt-2 text-center text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Personal assistant
        </h1>
        <p className="mx-auto mt-3 max-w-md text-center text-pretty text-sm text-zinc-400">
          Speak naturally. Your Vapi assistant handles the rest.
        </p>
        <div className="mt-12 flex justify-center">
          <VoiceAssistant />
        </div>
      </main>
    </div>
  );
}
