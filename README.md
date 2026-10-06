# Renom

AI video content studio for financial advisors: **Idea → Thumbnail → Script → Descriptions → Record → Edit → Post**, with a compliance workflow built in.

This is a prototype running on realistic mock data (one advisor, 16 videos at different stages). External services (Claude, Buffer, the video processor) are optional and fall back to offline samples when not configured.

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

- Settings → Connected platforms shows the Buffer channels. Check the ones that post as the advisor and they're pre-selected in the Post step (saved per browser for now).
- Buffer fetches video from a public https link. Without one, posts are sent to Buffer as drafts so the file can be attached there.
- Social accounts themselves are connected in Buffer, not in Renom.
- Without a key, the Post step falls back to simulated publishing, Analyze shows sample numbers, and the Buffer actions are hidden.

**What it does in the app**

| Where | What |
|---|---|
| Post step | Schedules, queues or publishes to the advisor's Buffer channels (drafts when there's no public video link) |
| Home → Coming up | Each Buffer post has a **⋯** menu: **Reschedule** (date and time), **Move to top of queue** (queued posts only; posts set for a fixed time can't be moved), **Delete** (asks first) |
| Idea step | **Save for later** saves to Videos and offers **Send to Buffer Ideas** (title + outline, marked AI-assisted, tagged with the advisor's channel networks) |
| Analyze | The four headline numbers come from Buffer (`aggregatedPostMetrics`, all channels, for the 30/60-day range), labelled "From Buffer" with the org and last update. The chart and lists stay labelled "Sample data" |

**How auth works.** Everything goes through `src/lib/buffer/server.ts`, which POSTs GraphQL to `BUFFER_API_URL` (default `https://api.buffer.com`) with `Authorization: Bearer $BUFFER_API_KEY`. It runs only on the server (route handlers), so the key never reaches the browser, and it is never logged. Locally the key comes from `.env.local`, which is git-ignored. The organization is `BUFFER_ORGANIZATION_ID`, or the first one on the account. All names (fields, inputs, enums) come from Buffer's GraphQL schema.

**API routes** (all JSON; errors are `{ ok: false, error }` with a 4xx/5xx status; ids are Buffer's 24-character hex ids):

| Route | What |
|---|---|
| `GET /api/buffer/status` | Org, channels, upcoming scheduled posts (with `shareMode` and `allowedActions`) |
| `GET /api/buffer/posts` | List posts. Query: `status` (comma list of `draft,error,needs_approval,scheduled,sending,sent`), `channelId`, `tagId`, `from`/`to` (ISO, bound `dueAt`), `sort=dueAt\|createdAt`, `direction=asc\|desc`, `first` (1–100, default 20), `after` (cursor from `pageInfo.endCursor`) → `{ ok, posts, pageInfo }` |
| `POST /api/buffer/posts` | Create one post `{ channelId, service, text, mode: now\|schedule\|queue, dueAt?, videoUrl?, thumbnailUrl?, title?, draft? }` |
| `GET /api/buffer/posts/:id` | One post, with tags, metrics and allowed actions |
| `PATCH /api/buffer/posts/:id` | `{ text?, dueAt? }`: change the text and/or reschedule to a set time (`dueAt` must be in the future) |
| `DELETE /api/buffer/posts/:id` | Delete a post → `{ ok, id }` |
| `POST /api/buffer/posts/:id/queue` | `{ position: "top" \| "bottom" }`: move a queued post |
| `GET /api/buffer/metrics` | `?days=30` (1–365) or `?from=ISO&to=ISO` (≤ 366 days), optional `channelId` → `{ ok, organization, range, metrics: [{ type, name, value, unit, description }], metricsUpdatedAt }`. `percentage` values are already percents (0.33 = 0.33%) |
| `GET /api/buffer/ideas` | `?first&after` → `{ ok, ideas, groups, pageInfo }` |
| `POST /api/buffer/ideas` | `{ title, text?, services?, date?, groupId?, aiAssisted? }` → `{ ok, idea }` |

| Path | What |
|---|---|
| `src/lib/buffer/server.ts` | GraphQL client: status, `createBufferPost`, `listPosts`, `getPost`, `editPost`, `deletePost`, `movePostInQueue`, `getAggregatedMetrics`, `listIdeas`, `createIdea`, `listTags` |
| `src/lib/buffer/types.ts` | Shared types |
| `src/lib/buffer/route.ts` | Route validation and JSON error helpers |
| `src/lib/buffer/use-buffer.ts` | Client hooks and calls (`useBuffer`, `useBufferMetrics`, reschedule / move / delete / create idea) |
| `src/components/buffer/post-menu.tsx` | The Coming up ⋯ menu and its dialogs |

**Test your key from the terminal.** `scripts/buffer.mjs` is a small read-only CLI with no dependencies. It reads `.env.local` itself and sends the same Bearer header as the app, without printing the key:

```bash
npm run buffer -- account                      # is the key valid? which orgs?
npm run buffer -- channels
npm run buffer -- posts --status scheduled     # also: --channel <id> --first 10 --sort createdAt --desc --after <cursor>
npm run buffer -- post <id>
npm run buffer -- metrics --days 30            # also: --channel <id>
npm run buffer -- ideas
npm run buffer -- tags
npm run buffer -- metrics --json               # raw GraphQL response
```

A rejected key prints `Buffer rejected the key (HTTP 401)`; a wrong `BUFFER_API_URL` prints `Couldn't reach …`. To point the app or the CLI at a local stand-in, set `BUFFER_API_URL=http://localhost:4555`.

## Recording

The Record step uses the browser's camera and microphone (https or localhost only). Takes stay in memory for the session and can be downloaded. **Send to AI Edit** uploads the take and starts processing (below).

## AI edit (captions, cuts, overlays)

Recorded takes are processed by a swappable, server-side **video processor**: it transcribes the take (word timings), suggests cuts (dead air, bad takes, filler) and renders the final video with captions and overlays.

1. Record → **Send to AI Edit**: the take is uploaded (`POST /api/video/upload`) and an `analyze` job starts. The app moves to Edit right away and shows live progress.
2. Edit: the transcript and suggested cuts come from the job result (the hand-written sample is only used when there's no take). Click to cut/restore, the timeline and **Skip cuts** work against the real take. The **Look** panel sets caption style (Classic / Bold / Minimal), position, highlight color, and the AI overlays (name & credentials lower third, key-phrase emphasis, end card), previewed live and saved per video.
3. **Finish edit** starts a `render` job with the advisor's final cuts and look, and stores the output URL on the video (`video.outputUrl`). An https output URL pre-fills the Buffer video link in Post.

```bash
VIDEO_PROCESSOR=mock     # mock (default) | mirage
MIRAGE_API_KEY=...       # in .env.local; server-only, sent as the x-api-key header
MIRAGE_VERIFIED=1        # required before the Mirage adapter will make any call (see below)
# MIRAGE_API_URL=...     # optional base URL override
# VIDEO_DATA_DIR=.data   # where uploads and job records are stored (git-ignored)
```

| Path | What |
|---|---|
| `src/lib/video/types.ts` | Shared types: `OverlayOptions`, `EditOptions`, `ProcessRequest`, `JobStatus`, `JobResult` |
| `src/lib/video/processor.ts` | The `VideoProcessor` interface and env-based selection |
| `src/lib/video/mock.ts` | Offline processor (what runs today) |
| `src/lib/video/mirage/endpoints.ts` | **Every** Mirage path and field mapping, all marked `TODO(mirage-docs)` |
| `src/lib/video/mirage/index.ts` | Mirage adapter (`fetch` + `x-api-key`), refuses to run until verified |
| `src/lib/video/storage.ts` | Local disk storage for uploads and job records (`.data/`) |
| `src/lib/video/client.ts` | Browser side: upload with progress, start jobs, follow progress |
| `src/lib/video/edit-model.ts` | Job result → transcript segments, segments → cut list, default look |
| `src/components/studio/steps/edit-look.tsx` | Look panel and the live preview overlays |

API (all server-side, keys never reach the browser):

| Route | What |
|---|---|
| `POST /api/video/upload` | Multipart `file` (webm / mp4 / mov, up to 500 MB), `durationSec`, optional `videoId` |
| `POST /api/video/process` | `{ kind: "analyze" \| "render", sourceId, aspect, edit, overlays, script?, cuts? }` → `{ jobId }`. `GET` says which processor is on and whether it's ready |
| `GET /api/video/jobs/[id]` | Job status (`queued` / `processing` / `done` / `failed`, progress, status line) |
| `GET /api/video/jobs/[id]/stream` | NDJSON: status lines, then the result (like `/api/write`) |
| `GET /api/video/jobs/[id]/result` | Output URL, transcript with word timings, cuts, key phrases (202 while running) |
| `GET /api/video/files/[id]` | Serves a locally stored take with Range support (the mock's output) |

**Mock processor.** Works offline. Stores uploads in `.data/uploads`, lays a realistic read of the script over the take's real length (deterministic per take: same take, same transcript and cuts), simulates progress over a few seconds, and returns the original file as the "rendered" output. The UI labels it "Sample processing". Uploaded files are served to anyone who has the (random) id; add auth before real use. Storage is single-server; move it to object storage before running more than one instance.

**Switching to Mirage.** Set `VIDEO_PROCESSOR=mirage` and `MIRAGE_API_KEY`. Until the mapping is verified, every call fails with "Mirage endpoints not yet verified" (and the UI shows that error) so nothing calls guessed URLs. To finish it:

1. Read https://captions.ai/llms.txt and the pages it links (this was built on a network that blocked captions.ai and *.mirage.app, so nothing was checked).
2. In `src/lib/video/mirage/endpoints.ts`, confirm and replace each placeholder:
   - the API base URL (`DEFAULT_BASE_URL`, currently a guess);
   - the upload mechanism (direct multipart vs. signed URL vs. fetch-from-URL), its path and field name, and where the uploaded asset id comes back (`PATHS.upload`, `uploadRequest`, `parseUpload`). If Mirage only fetches from a public URL, `/api/video/files/[id]` (or object storage) must be reachable from the internet;
   - how captions / AI edit / overlays are requested (`PATHS.process`, `processBody`): which caption templates exist and how Classic / Bold / Minimal map onto them, whether position and highlight color are settable, whether silence / bad-take / filler removal and audio enhancement are separate switches, whether lower thirds, key-phrase emphasis and end cards are supported at all, and how to render with the advisor's own cut list. Drop what isn't supported rather than guessing;
   - job polling: path, state names and the progress field (`PATHS.status`, `STATE_MAP`, `parseStatus`), and whether webhooks are available instead;
   - the result: output URL (and whether it expires), transcript word timings, the list of removed segments and their reasons (`PATHS.result`, `parseResult`);
   - limits: file size, duration, formats (does it accept browser WebM, or must takes be MP4?), rate limits.
3. Set `MIRAGE_VERIFIED=1` and run one take end to end.

Nothing outside `src/lib/video/mirage/` knows about Mirage, so another provider is one more file implementing `VideoProcessor`.

## White-label

Branding lives in `src/lib/brand.ts` and is read from env, so a reseller rebrands without code changes. Unset values keep Renom and its palette. `NEXT_PUBLIC_*` values are inlined at build time: rebuild after changing them.

```bash
NEXT_PUBLIC_BRAND_NAME="Northpoint Studio"   # logo text, page title, in-app copy ("Ask … to change anything")
NEXT_PUBLIC_BRAND_TAGLINE="Video studio for financial advisors"
NEXT_PUBLIC_BRAND_DESCRIPTION="…"            # meta description
NEXT_PUBLIC_BRAND_LOGO_URL=/brand/logo.svg   # optional image; replaces the drawn mark
NEXT_PUBLIC_BRAND_MARK_BG=#111827            # drawn mark tile (default #0B1F3A)
NEXT_PUBLIC_BRAND_MARK_FG=#FFFFFF            # drawn mark letter (default #D2B07A)
NEXT_PUBLIC_BRAND_PRIMARY=#2F6FED            # primary/brass tokens: buttons, rings, highlights, default caption color
NEXT_PUBLIC_BRAND_PRIMARY_DARK=#6E9BFF       # optional; derived from primary when unset
NEXT_PUBLIC_BRAND_PRIMARY_FOREGROUND=#FFFFFF # optional text-on-primary
```

The colors are injected as a small `<style>` in `src/app/layout.tsx` that overrides `--primary`, `--primary-hover`, `--ring`, `--brass`, `--brass-soft` and `--chart-2` from `globals.css` (light and dark). Nothing is injected for the default brand. The AI writer's persona uses the brand name too.

## Shortcuts

- `⌘K` / `Ctrl+K`: command palette (jump to any video, step or page)
