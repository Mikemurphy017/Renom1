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

## Where things live

| Path | What |
|---|---|
| `src/app/(app)/*` | Pages: Home, Video Board, Studio, Library, Performance, Compliance, Profile, Settings |
| `src/app/(app)/studio/[id]/[step]` | Studio view for one video at one step |
| `src/components/studio/steps/*` | One component per step. Each receives `{ video, complete }` |
| `src/components/agent/*` | Chat panel, request-summary card and the `useAgentSession` hook |
| `src/lib/ai/types.ts` | **Agent contract** (`AgentClient.stream()` → status / delta / done events) |
| `src/lib/ai/mock-agent.ts` | Mock streaming agent. Swap `agent` for a real implementation |
| `src/lib/ai/content.ts` | Mock generators for ideas, thumbnails, scripts and descriptions, plus duplicate detection |
| `src/lib/store.tsx` | In-memory store. Every mutation is a function you can replace with an API call |
| `src/lib/mock/*` | Advisor profile, videos, platforms, analytics, compliance queue |
| `src/app/globals.css` | Design tokens for light mode and dark navy mode |

## Wiring real services later

- **AI**: implement `AgentClient` (for example, a fetch to a streaming route handler) and export it as `agent` from `src/lib/ai/mock-agent.ts`. Move the generators in `content.ts` behind that route.
- **Platforms / publishing**: `post-step.tsx` → `publish()`; connection state lives in `settings/page.tsx`.
- **Persistence**: replace `StoreProvider` mutations and `useDraft` (`src/lib/drafts.ts`) with server calls.

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
