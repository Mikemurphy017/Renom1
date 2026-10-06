# Renom

AI video content studio for financial advisors: **Idea → Thumbnail → Script → Descriptions → Record → Edit → Post**, with a compliance workflow built in.

This is a front-end prototype running on realistic mock data (one advisor, 16 videos at different stages). No external APIs are called.

## Run it

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
```

## Stack

Next.js (App Router) · TypeScript · Tailwind v4 · shadcn/ui-style components on Radix · Lucide · Recharts · Framer Motion · cmdk · sonner · next-themes

## The product

Five steps, nothing else: **Idea → Script → Record → Edit → Post** (Post covers cover image, captions, approval and scheduling).

| Page | What it's for |
|---|---|
| Home | One question ("What do you want to talk about?"), work in progress, three numbers, what's coming up |
| Videos | Every video, filtered by In progress / Approval / Scheduled / Published |
| Analyze | Four numbers, one chart, what's working and where |
| Approve | Review queue (comments pinned to script lines and timestamps) and the books-and-records archive |
| Settings | Your voice (what Claude writes from), disclosures, Buffer, approval rules, team, plan |

## Claude writes the content

Ideas, scripts and captions are written by Claude (`claude-opus-5-5`, structured outputs, server-side refusal fallback) in a house voice that blends Eugene Schwartz, Joseph Sugarman, Oren Klaff and David Ogilvy, kept inside FINRA 2210 / SEC Marketing Rule guardrails. The voice lives in `src/lib/ai/voice.ts`; the per-task prompts in `src/lib/ai/claude.ts`.

```bash
ANTHROPIC_API_KEY=...   # in .env.local
```

Without a key, `/api/write` returns hand-written sample copy in the same voice, labelled "Sample writing" in the UI.

| Path | What |
|---|---|
| `src/app/api/write/route.ts` | Streams status lines, then the result (NDJSON) |
| `src/lib/ai/voice.ts` | The house voice and compliance rules |
| `src/lib/ai/claude.ts` | Prompts per task and the Claude call |
| `src/lib/ai/schemas.ts` | Zod schemas for ideas, scripts and captions |
| `src/lib/ai/samples.ts` | Fallback copy when no key is set |
| `src/lib/ai/writer.ts` | `useWriter()` client hook |
| `src/components/studio/steps/*` | The five steps |
| `src/lib/store.tsx` | In-memory store (videos, reviews, the voice profile) |

## Buffer (scheduling and publishing)

The Post step publishes through Buffer when a key is configured. Add to `.env.local` (git-ignored):

```bash
BUFFER_API_KEY=...                 # publish.buffer.com/settings/api
BUFFER_ORGANIZATION_ID=...         # optional; defaults to the first org on the account
# BUFFER_API_URL=https://api.buffer.com   # optional override
```

- `GET /api/buffer/status` returns the org, channels and upcoming scheduled posts. `POST /api/buffer/posts` creates one post. The key never reaches the browser.
- Settings → Connected platforms shows the Buffer channels. Check the ones that post as the advisor and they're pre-selected in the Post step (saved per browser for now).
- Buffer fetches video from a public https link. Without one, posts are sent to Buffer as drafts so the file can be attached there.
- Social accounts themselves are connected in Buffer, not in Renom.
- Without a key, the Post step falls back to simulated publishing.

## Recording

The Record step uses the browser's camera and microphone (https or localhost only). Takes stay in memory for the session and can be downloaded.

## Shortcuts

- `⌘K` / `Ctrl+K`: command palette (jump to any video, step or page)
