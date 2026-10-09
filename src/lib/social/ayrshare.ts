import { createHmac, timingSafeEqual } from "node:crypto";
import { getJSON, putJSON } from "@/lib/storage/objects";
import type { User } from "@/lib/auth/server";
import type { PlatformId } from "@/lib/types";
import { NETWORK, type ConnectedAccount, type SocialPost, type SocialPostStatus, type SocialStatus } from "./types";

/**
 * Ayrshare (https://www.ayrshare.com), server side only. Each advisor gets
 * their own Ayrshare user profile; they link their accounts on Ayrshare's
 * hosted page and we post with that profile's key.
 *
 * Env: AYRSHARE_API_KEY, AYRSHARE_DOMAIN and AYRSHARE_PRIVATE_KEY (the
 * linking page; Business plan). Optional AYRSHARE_X_API_KEY and
 * AYRSHARE_X_API_SECRET: X only works with the studio's own X app keys.
 */

const BASE = (process.env.AYRSHARE_BASE_URL?.trim() || "https://api.ayrshare.com/api").replace(/\/+$/, "");
const PROFILES = "meta/socialprofiles.json";
const POSTS = "meta/socialposts.json";

const env = (n: string) => process.env[n]?.trim() || "";
const apiKey = () => env("AYRSHARE_API_KEY");
/** The private key arrives as one env line; accept literal "\n"s. */
const privateKey = () => env("AYRSHARE_PRIVATE_KEY").replace(/\\n/g, "\n");
const xKeys = () => (env("AYRSHARE_X_API_KEY") && env("AYRSHARE_X_API_SECRET") ? { key: env("AYRSHARE_X_API_KEY"), secret: env("AYRSHARE_X_API_SECRET") } : null);

export const socialConfigured = () => !!(apiKey() && env("AYRSHARE_DOMAIN") && privateKey());

export class SocialError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

type Json = Record<string, unknown>;

/** First readable message in an Ayrshare error body. */
function errorText(j: Json | null, status: number) {
  const errs = Array.isArray(j?.errors) ? (j!.errors as Json[]) : [];
  const msg = [j?.message, ...errs.map((e) => e?.message)].find((m) => typeof m === "string" && m.trim()) as string | undefined;
  if (status === 401 || status === 403) return "The studio's Ayrshare key was refused. Your administrator can check it.";
  return msg ? msg.slice(0, 300) : `Ayrshare returned an error (${status}).`;
}

async function call(method: "GET" | "POST" | "PUT" | "DELETE", path: string, body?: Json, profileKey?: string): Promise<Json> {
  if (!apiKey()) throw new SocialError("Posting to your accounts isn't set up for this studio yet.", 503);
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" };
  if (profileKey) headers["Profile-Key"] = profileKey;
  const x = xKeys();
  if (x) {
    headers["X-Twitter-OAuth1-Api-Key"] = x.key;
    headers["X-Twitter-OAuth1-Api-Secret"] = x.secret;
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60_000), cache: "no-store" });
  } catch (e) {
    console.error(`[social] ${method} ${path} failed:`, (e as Error).message);
    throw new SocialError("Couldn't reach Ayrshare. Try again in a moment.");
  }
  const j = (await res.json().catch(() => null)) as Json | null;
  if (!res.ok || j?.status === "error") {
    console.error(`[social] ${method} ${path} → ${res.status}: ${JSON.stringify(j)?.slice(0, 500)}`);
    const err = new SocialError(errorText(j, res.status), res.status >= 500 ? 502 : 400);
    (err as SocialError & { body?: Json | null }).body = j;
    throw err;
  }
  return j ?? {};
}

/** What's still missing for advisors to connect accounts (env names), for the admin dashboard. */
export function socialMissing() {
  return ["AYRSHARE_API_KEY", "AYRSHARE_DOMAIN", "AYRSHARE_PRIVATE_KEY"].filter((n) => !(n === "AYRSHARE_PRIVATE_KEY" ? privateKey() : env(n)));
}

/** Checks the studio's Ayrshare key against the account itself. */
export async function checkAccount() {
  const j = await call("GET", "user");
  const who = [j.title, j.email].find((v) => typeof v === "string" && v.trim()) as string | undefined;
  return who ? `Key works (${who})` : "Key works";
}

// ── one Ayrshare profile per advisor ──

interface Profile {
  profileKey: string;
  refId?: string;
  createdAt: string;
}
const profiles = async () => (await getJSON<{ byUser: Record<string, Profile> }>(PROFILES))?.byUser ?? {};

export const profileFor = async (userId: string) => (await profiles())[userId] ?? null;

async function ensureProfile(user: User): Promise<Profile> {
  const have = await profileFor(user.id);
  if (have) return have;
  const j = await call("POST", "profiles/profile", { title: `${(user.name || "Advisor").slice(0, 60)} · ${user.id}` });
  if (typeof j.profileKey !== "string") throw new SocialError("Ayrshare didn't return a profile.");
  const p: Profile = { profileKey: j.profileKey, refId: typeof j.refId === "string" ? j.refId : undefined, createdAt: new Date().toISOString() };
  await putJSON(PROFILES, { byUser: { ...(await profiles()), [user.id]: p } });
  return p;
}

/** A one-time link to Ayrshare's page where the advisor connects (or disconnects) their accounts. */
export async function linkUrl(user: User, redirect: string) {
  if (!socialConfigured()) throw new SocialError("Connecting accounts isn't set up for this studio yet.", 503);
  const p = await ensureProfile(user);
  const x = xKeys();
  const j = await call("POST", "profiles/generateJWT", {
    domain: env("AYRSHARE_DOMAIN"),
    privateKey: privateKey(),
    profileKey: p.profileKey,
    redirect,
    // Sign out of whoever used the linking page last in this browser.
    logout: true,
    ...(x ? { twitterApiKey: x.key, twitterApiSecret: x.secret } : {}),
  });
  if (typeof j.url !== "string") throw new SocialError("Ayrshare didn't return a link.");
  return j.url;
}

export async function socialStatus(user: User): Promise<SocialStatus> {
  const unavailable = xKeys() ? [] : ["twitter"];
  if (!socialConfigured()) return { configured: false, accounts: [], unavailable };
  const p = await profileFor(user.id);
  if (!p) return { configured: true, accounts: [], unavailable };
  const j = await call("GET", "user", undefined, p.profileKey);
  const active = Array.isArray(j.activeSocialAccounts) ? (j.activeSocialAccounts as string[]) : [];
  const names = Array.isArray(j.displayNames) ? (j.displayNames as Json[]) : [];
  const accounts: ConnectedAccount[] = active.map((network) => {
    const d = names.find((n) => n?.platform === network) ?? {};
    const name = [d.displayName, d.username].find((v) => typeof v === "string" && v) as string | undefined;
    return { network, name: name ?? network, avatar: typeof d.userImage === "string" ? d.userImage : undefined, url: typeof d.profileUrl === "string" ? d.profileUrl : undefined };
  });
  return { configured: true, accounts, unavailable };
}

export async function unlink(user: User, network: string) {
  const p = await profileFor(user.id);
  if (!p) return;
  await call("DELETE", "profiles/social", { platform: network }, p.profileKey);
}

// ── posts ──

interface StoredPost extends SocialPost {
  userId: string;
}
const allPosts = async () => (await getJSON<{ posts: StoredPost[] }>(POSTS))?.posts ?? [];
const savePosts = (posts: StoredPost[]) => putJSON(POSTS, { posts: posts.slice(0, 5000) });
const forUser = ({ userId: _u, ...p }: StoredPost): SocialPost => p;

export interface PublishInput {
  videoId: string;
  title: string;
  format: "short" | "long";
  videoUrl: string;
  /** Cover image links (public), per shape. */
  covers: Partial<Record<"short" | "long", string>>;
  captions: { platform: PlatformId; text: string; title?: string }[];
  disclosureVersion: string;
  /** ISO; omitted to post now. */
  scheduleAt?: string;
}

/** Options Ayrshare needs for a video on each network. */
function optionsFor(platform: PlatformId, i: PublishInput, title: string): Json {
  const vertical = i.format === "short";
  const cover = vertical ? i.covers.short : i.covers.long;
  switch (platform) {
    case "youtube":
    case "youtube_shorts":
      return { youTubeOptions: { title: title.slice(0, 100), visibility: "public", madeForKids: false, ...(platform === "youtube_shorts" ? { shorts: true } : {}), ...(cover && platform === "youtube" ? { thumbNail: cover } : {}) } };
    case "instagram":
      return { instagramOptions: { shareReelsFeed: true, ...(cover ? { coverUrl: cover } : {}) } };
    case "facebook":
      return { faceBookOptions: vertical ? { reels: true, title: title.slice(0, 255) } : { title: title.slice(0, 255) } };
    default:
      return {};
  }
}

const postUrlOf = (j: Json) => {
  const ids = Array.isArray(j.postIds) ? (j.postIds as Json[]) : [];
  return ids.map((x) => x?.postUrl).find((u) => typeof u === "string") as string | undefined;
};

/** Post (or schedule) one caption per platform. Each platform succeeds or fails on its own. */
export async function publish(user: User, i: PublishInput): Promise<{ posts: SocialPost[]; errors: { platform: PlatformId; error: string }[] }> {
  const p = await profileFor(user.id);
  if (!p) throw new SocialError("Connect your accounts first (Settings → Publishing).", 400);
  const now = new Date().toISOString();
  const made: StoredPost[] = [];
  const errors: { platform: PlatformId; error: string }[] = [];
  for (const c of i.captions) {
    const title = c.title?.trim() || i.title;
    try {
      const j = await call(
        "POST",
        "post",
        {
          post: c.text,
          platforms: [NETWORK[c.platform]],
          mediaUrls: [i.videoUrl],
          isVideo: true,
          shortenLinks: false,
          ...(i.scheduleAt ? { scheduleDate: i.scheduleAt } : {}),
          ...optionsFor(c.platform, i, title),
        },
        p.profileKey
      );
      const id = typeof j.id === "string" ? j.id : null;
      if (!id) throw new SocialError("Ayrshare didn't return a post id.");
      const url = postUrlOf(j);
      made.push({
        id,
        userId: user.id,
        videoId: i.videoId,
        platform: c.platform,
        caption: c.text,
        disclosureVersion: i.disclosureVersion,
        status: i.scheduleAt ? "scheduled" : url ? "posted" : "posting",
        createdAt: now,
        scheduledFor: i.scheduleAt,
        postedAt: !i.scheduleAt && url ? now : undefined,
        postUrl: url,
      });
    } catch (e) {
      errors.push({ platform: c.platform, error: (e as Error).message });
    }
  }
  if (made.length) await savePosts([...made, ...(await allPosts())]);
  return { posts: made.map(forUser), errors };
}

const statusFrom = (s: unknown): SocialPostStatus | null =>
  s === "success" ? "posted" : s === "scheduled" ? "scheduled" : s === "error" ? "failed" : s === "deleted" ? "cancelled" : s === "pending" || s === "processing" ? "posting" : null;

/** The advisor's posts for a video, with anything still in flight checked against Ayrshare. */
export async function postsFor(user: User, videoId?: string): Promise<SocialPost[]> {
  const all = await allPosts();
  const mine = all.filter((x) => x.userId === user.id && (!videoId || x.videoId === videoId));
  const p = await profileFor(user.id);
  const due = mine.filter((x) => x.status === "posting" || (x.status === "scheduled" && x.scheduledFor && Date.parse(x.scheduledFor) < Date.now()));
  if (p && due.length) {
    let changed = false;
    for (const x of due.slice(0, 10)) {
      try {
        const j = await call("GET", `post/${encodeURIComponent(x.id)}`, undefined, p.profileKey);
        const s = statusFrom(j.status);
        const url = postUrlOf(j);
        if (s && (s !== x.status || url !== x.postUrl)) {
          x.status = s;
          x.postUrl = url ?? x.postUrl;
          if (s === "posted") x.postedAt = x.scheduledFor ?? new Date().toISOString();
          if (s === "failed") x.error = errorText(j, 400);
          changed = true;
        }
      } catch {
        // leave it as it was; we'll look again next time
      }
    }
    if (changed) await savePosts(all);
  }
  return mine.map(forUser);
}

/** Cancel a scheduled post before it goes out. */
export async function cancelPost(user: User, id: string) {
  const all = await allPosts();
  const x = all.find((y) => y.id === id && y.userId === user.id);
  if (!x) throw new SocialError("Not found.", 404);
  if (x.status !== "scheduled") throw new SocialError("Only scheduled posts can be cancelled.", 409);
  const p = await profileFor(user.id);
  if (p) await call("DELETE", "post", { id }, p.profileKey);
  x.status = "cancelled";
  await savePosts(all);
  return forUser(x);
}

// ── public links to our files, for Ayrshare to fetch ──
// Signed with a key derived from the Ayrshare key; they expire a few days after the post time.

const fileKey = () => createHmac("sha256", apiKey() || "unset").update("renom-social-files").digest();
const sig = (name: string) => createHmac("sha256", fileKey()).update(name).digest("hex").slice(0, 32);

/** `kind` v = rendered video (upload id), c = cover image (media id). */
export function fileLink(origin: string, kind: "v" | "c", id: string, until: number, ext: string) {
  const name = `${kind}-${id}-${Math.floor(until / 1000).toString(36)}`;
  return `${origin}/api/social/file/${name}-${sig(name)}.${ext}`;
}

export function readFileLink(file: string): { kind: "v" | "c"; id: string } | null {
  const m = /^([vc])-([a-z0-9]{6,40})-([a-z0-9]{1,10})-([a-f0-9]{32})\.[a-z0-9]{2,5}$/.exec(file);
  if (!m) return null;
  const name = `${m[1]}-${m[2]}-${m[3]}`;
  const want = Buffer.from(sig(name));
  const got = Buffer.from(m[4]);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  if (parseInt(m[3], 36) * 1000 < Date.now()) return null;
  return { kind: m[1] as "v" | "c", id: m[2] };
}
