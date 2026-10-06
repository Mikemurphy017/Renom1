# Renom

AI video content studio for financial advisors: **Idea → Thumbnail → Script → Descriptions → Record → Edit → Post**, with a compliance workflow built in.

Renom starts as a blank studio: an advisor creates an account, sets up a profile, then goes Idea → Script → Record → Edit → Review → Post. Claude writes the content, the built-in editor renders a real MP4, and files live in the storage bucket.

## Run it

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
```

## Stack

Next.js (App Router) · TypeScript · Tailwind v4 · shadcn/ui-style components on Radix · Lucide · Recharts · Framer Motion · cmdk · sonner · next-themes

## Operator setup (once, for every studio)

Claude and Buffer are platform services: you set the keys once on the server that hosts the app, and every advisor's studio uses them automatically. Advisors never see or enter a key.

- Local: put them in `.env.local` (copy `.env.example`) and restart.
- Hosted (Vercel, Railway, etc.): add the same names as environment variables in the hosting dashboard and redeploy.

If a key is missing, advisors see "being switched on" instead of an error, and the server log says which variable to set.

## First run

The app starts empty. The first visit opens a short setup at `/welcome` (name, practice, who you help, your voice, your opinions, your disclosure and reviewer, and a check of the Claude and Buffer connections). Your answers become the profile Claude writes from; change them any time in Settings.

Everything you create (profile, videos, reviews, drafts) is saved in this browser's local storage, so it survives a refresh but not a different browser or computer. Settings → Start over erases it and reopens setup. Recorded takes are stored on the server in `.data/`.

What needs a key:
- Writing (ideas, scripts, captions) needs `ANTHROPIC_API_KEY`. Without it, writing is turned off with a clear message.
- Scheduling needs `BUFFER_API_KEY`. Without it, Post offers "I posted it myself", which still archives the captions and disclosure.
- AI video edits run on the offline sample processor until the Captions/Mirage endpoints are verified (see below).

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
| `POST /api/buffer/posts` | Create one post `{ channelId, service, text, mode: draft\|now\|schedule\|queue, dueAt?, videoUrl?, thumbnailOffsetMs?, title? }` — networks don't accept custom thumbnail images; `thumbnailOffsetMs` picks the cover frame on Instagram, TikTok and Pinterest |
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

## Accounts (sign in / sign out)

Everything is behind sign-in. Each advisor has an account (email + password) and their studio (profile, videos, reviews, work in progress) is saved to it, so it's the same on every device.

- **Who can create an account:** the first account is open. After that, sign-ups need an invite: a single-use link made on the admin dashboard (optionally locked to one email and emailed for you), or the shared `INVITE_CODE` if you set one. With neither, sign-ups are closed.
- **Sessions:** a random token in an `HttpOnly`, `SameSite=Lax` cookie (Secure over https), valid 30 days; only its hash is stored. Sign-out deletes it.
- **Passwords:** scrypt with a per-user salt; at least 10 characters. Sign-in is throttled (8 tries per email and address per 15 minutes). Change it in Settings → Account.
- **Storage:** accounts, sessions and each advisor's studio live in the storage bucket (`users/`, `sessions/`, `state/`) next to their videos.
- **Gate:** `src/middleware.ts` (Node runtime) checks the session on every page and API call; signed-out visitors go to `/signin`, API calls get 401.
- **First sign-in on a browser that already has work** (from before accounts existed) moves that work into the account.

### Password reset by email

"Forgot password?" on the sign-in page (`/forgot`) emails a link to `/reset`. The link works once, expires in 60 minutes and stops working if the password changes another way. Setting the new password signs the account out on every other device and signs this one in. The request always answers the same way, so it can't be used to find out which emails have accounts.

Email is sent with **Resend** (`RESEND_API_KEY` + `EMAIL_FROM`, the sender on a domain you've verified in Resend) or any **SMTP** server (`SMTP_URL`, e.g. `smtps://user:pass@smtp.gmail.com:465`, plus `EMAIL_FROM`). Links use `APP_URL` (on Railway, `RAILWAY_PUBLIC_DOMAIN` is used when `APP_URL` isn't set), never the request's Host header. Without email set up, the sign-in page says to ask the administrator, who can make a reset link on the admin dashboard.

### Admin dashboard (`/admin`)

Only the emails in `ADMIN_EMAILS` (comma-separated; defaults to mike@bluestonepartnersllc.com) can open it; for everyone else the page is a 404 and `/api/admin/*` answers 403. It shows:

- **Accounts:** name, email, firm, videos, last sign-in, last activity, set-up status. Per account: send a password reset (emailed, plus a copyable link valid 24 hours), sign out everywhere, disable/enable (disabling signs them out at once), delete (removes the account and its saved studio; recorded files stay in storage). You can't disable or delete your own account.
- **Invites:** create single-use invite links (optionally for one email, sent by email), see which were used and by whom, revoke open ones.
- **Services:** storage, Claude, Buffer, email, speech recognition and stock b-roll, with a "Send test email" button.

The admin link is in the avatar menu for admins.

## Storage (videos, headshots, covers)

Everything the platform keeps (recorded takes, rendered videos, headshots, cover images, AI Edit job records) goes into one object store (`src/lib/storage/objects.ts`):

- **Storage bucket (production).** Set `BUCKET`, `ENDPOINT`, `REGION`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`. On Railway, reference the bucket's Credentials variables (`${{bucket-name.BUCKET}}` …). Any S3-compatible bucket works; `STORAGE_PATH_STYLE=1` for path-style ones. Files are streamed through the app (`/api/video/files/:id`, `/api/media/:id`), with Range support so video seeks.
- **Local disk (development).** With no bucket set, files go to `.data/`. A container's disk is wiped on every redeploy, so don't run production this way.

A take uploads as soon as recording stops and is stored on the video (`video.take`), so it plays in Edit and Post after a reload. Buffer gets 7-day signed links to the stored video and cover automatically.

## Edit styles

Edit → **Look** opens a style gallery (Impact, Ignite, Focus, Duo, Volt, Nova, Karaoke, Clarity, Minimal; filter Bold / Polished / Minimal). A style sets the whole look, and every part can be switched off per video:

- **Captions**: font, size, case, how words appear (pop, fade, karaoke fill), what's lit (the spoken word or the key words), glow, a block behind the active word. Position and highlight color are adjustable.
- **Punch-in zooms** on the big moments.
- **Keyword cards**: a headline (Impact, Volt), a giant word behind (Ignite), a banner (Focus) or a chip (Clarity, Karaoke).
- **B-roll** cutaways: the advisor's library first (Settings → B-roll & music), then Pexels stock footage when `PEXELS_API_KEY` is set.
- **Sound effects**: whoosh, pop, riser, hit, synthesized (`src/lib/video/local/audio-beds.ts`).
- **Music**: four built-in beds (Calm, Uplift, Pulse, Cinematic), synthesized and royalty-free, or the advisor's own tracks; ducked under the voice automatically.

The big moments come from Claude reading the transcript (`local/beats.ts`), with a fallback that picks numbers and strong words. Styles live in `src/lib/video/styles.ts` (shared by the live preview and the renderer); the caption file is built in `local/ass.ts`. Fonts (all SIL OFL) are in `assets/fonts` for the renderer and `public/fonts` for the preview.

## Word-timed captions

Captions follow the voice: the take is transcribed on the server with an offline speech model (sherpa-onnx zipformer trained on GigaSpeech, int8, ~71 MB), which gives a time for every word. Words are spelled like the script wherever the two agree (names, numbers, punctuation), skipped lines are dropped, ad-libs are kept, and a phrase said twice in a row becomes a retake cut. The model downloads on `npm install` / `npm run build` into `.models/` (`scripts/fetch-asr-model.mjs`); without it the editor falls back to timing the script from the audio.

## Covers (thumbnails)

Post → Cover builds a long-form (1280×720, YouTube / LinkedIn) and a short-form (1080×1920, Reels / TikTok / Shorts) cover for every video. It picks the sharpest, best-lit frames from the advisor's own take (plus any headshots from Settings), Claude writes the words (task `covers`), and four templates per shape draw them on a canvas (`src/lib/thumbs`). The chosen pair is saved to storage as JPEGs and shown across the app.

## Recording

The Record step uses the browser's camera and microphone (https or localhost only). Takes stay in memory for the session and can be downloaded. **Send to AI Edit** uploads the take and starts processing (below).

## AI edit (captions, cuts, overlays)

Recorded takes are processed by a swappable, server-side **video processor**. The default is the built-in **local** editor (ffmpeg, bundled through `ffmpeg-static`, so production needs no system packages): it measures the take's audio to find the pauses, lays the script over the stretches where the advisor was talking, and renders a real MP4 (H.264/AAC, 1080×1920 or 1920×1080) with the advisor's cuts, burned-in captions, name title, end card and cleaned-up audio. Speech recognition times every caption word to the voice and finds restarts (see Word-timed captions).

1. Record: the take uploads to storage as soon as recording stops. **Send to AI Edit** (or just opening Edit) (`POST /api/video/upload`) and an `analyze` job starts. The app moves to Edit right away and shows live progress.
2. Edit: the transcript and suggested cuts come from the job result; the filmstrip and waveform come from the real take. Click to cut/restore, the timeline and **Skip cuts** work against the real take. The **Look** panel sets caption style (Classic / Bold / Minimal), position, highlight color, and the AI overlays (name & credentials lower third, key-phrase emphasis, end card), previewed live and saved per video.
3. **Finish edit** starts a `render` job with the advisor's final cuts and look and stores the MP4 (`video.output`).
4. **Review**: watch the exact file, download it, or go back and change it.
5. **Post**: download the MP4 and covers, copy each platform's caption (disclosure included) with one click, mark it posted, or send captions to Buffer as drafts and attach the MP4 there.

```bash
VIDEO_PROCESSOR=local    # local (default, ffmpeg) | mock | mirage
# FFMPEG_PATH=...        # optional: use a specific ffmpeg instead of the bundled one
MIRAGE_API_KEY=...       # in .env.local; server-only, sent as the x-api-key header
MIRAGE_VERIFIED=1        # required before the Mirage adapter will make any call (see below)
# MIRAGE_API_URL=...     # optional base URL override
# VIDEO_DATA_DIR=.data   # local-disk storage when no bucket is configured (git-ignored)
```

| Path | What |
|---|---|
| `src/lib/video/types.ts` | Shared types: `OverlayOptions`, `EditOptions`, `ProcessRequest`, `JobStatus`, `JobResult` |
| `src/lib/video/processor.ts` | The `VideoProcessor` interface and env-based selection |
| `src/lib/video/local/` | Built-in ffmpeg editor (what runs today): `analyze.ts` pauses + script timing, `render.ts` cuts, captions (ASS), titles, audio, MP4 |
| `src/lib/video/mock.ts` | Simulated processor for UI work (`VIDEO_PROCESSOR=mock`); returns the original file |
| `assets/fonts/` | Caption fonts (OFL): Anton, Montserrat, Bebas Neue, Playfair Display, Liberation Sans |
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
| `GET /api/video/files/[id]` | Streams a stored take or rendered MP4 with Range support; `?download=<name>` saves it as a file |

**Mock processor** (`VIDEO_PROCESSOR=mock`). Simulated, for UI work only. Stores uploads in `.data/uploads`, lays a realistic read of the script over the take's real length (deterministic per take: same take, same transcript and cuts), simulates progress over a few seconds, and returns the original file as the "rendered" output. The UI labels it "Sample processing". Uploaded files are served to anyone who has the (random) id; add auth before real use. Storage is single-server; move it to object storage before running more than one instance.

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
