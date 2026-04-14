# Voice personal assistant

Next.js app that embeds your existing **Vapi** assistant in the browser via [`@vapi-ai/web`](https://github.com/vapiai/client-sdk-web).

## Setup

1. Copy environment variables:

   ```bash
   cp .env.example .env.local
   ```

2. Fill in `.env.local`:

   - `NEXT_PUBLIC_VAPI_PUBLIC_KEY` — public key from the Vapi dashboard (used in the browser).
   - `NEXT_PUBLIC_VAPI_ASSISTANT_ID` — id of the assistant you already created.

3. Install and run (Node 20+):

   ```bash
   npm install
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000), allow the microphone, then **Start call**.

## Activity dashboard

Open **`/dashboard`** to see requests grouped into **buckets** (web research, email, calendar, etc.) over **7 days**, **30 days**, or **all time**.

Summaries are saved in **localStorage** in this browser when a call ends (up to 200 calls). They are not synced to a server.

## Optional: Server URL (custom tools)

If you add **custom** function tools that need your backend, set the assistant **Server URL** in Vapi to:

`https://<your-deployed-host>/api/vapi/webhook`

For local development, expose the app with a tunnel (ngrok, Cloudflare Tunnel, etc.) and use that base URL.

If `VAPI_WEBHOOK_SECRET` is set in `.env.local`, the route expects the same value in the `x-vapi-secret` or `x-api-key` header (adjust to match what you configure in Vapi).

Built-in Vapi integrations (e.g. Gmail, Calendar) are configured in the Vapi dashboard; you do not need this webhook unless you add custom server tools.

## Post-call summary

The live **transcript is not shown** in the UI. After each call ends, a new **Call summary** card is added with:

- **Your requests** — what you asked the assistant to do (LLM-compressed when **`OPENAI_API_KEY`** is set in `.env.local`, otherwise grouped from final user lines).
- **Assistant actions & replies** — what the assistant said or confirmed.

Summaries use **`gpt-4o`** by default (via the Chat Completions API). Override with **`OPENAI_SUMMARY_MODEL`** in `.env.local` if your account supports another id (for example `gpt-4-turbo`).

Older calls stay on the page as separate cards (newest first). Without `OPENAI_API_KEY`, the API falls back to listing final lines by speaker.

## Scripts

- `npm run dev` — development server (Turbopack)
- `npm run build` — production build
- `npm run start` — run production server
- `npm run lint` — ESLint
