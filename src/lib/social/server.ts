import { getJSON, putJSON } from "@/lib/storage/objects";
import { isAdmin, type User } from "@/lib/auth/server";
import { BufferError, bufferAccountOf, bufferConfigured, createBufferPost, deletePost, getOrganization, getPost } from "@/lib/buffer/server";
import { seal, secretsConfigured, unseal } from "@/lib/secrets";
import { OAuthError, oauthConfigured, refreshTokens, type Tokens } from "./oauth";
import type { PlatformId } from "@/lib/types";
import { SERVICE_OF, type OwnChannel, type SocialPost, type SocialPostStatus, type SocialStatus } from "./types";

/**
 * Advisors' own Buffer accounts, connected through Buffer's consent screen
 * (see oauth.ts). Tokens are stored encrypted (one file per advisor) and only
 * ever used for that advisor; what each advisor posts is in meta/socialposts.json.
 */

const LINKS = "meta/ownbuffer.json";
const POSTS = "meta/socialposts.json";

export class SocialError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

interface Link {
  /** Sealed access and refresh tokens (Buffer rotates the refresh token on every use). */
  access: string;
  refresh: string;
  expiresAt: number;
  orgId: string;
  orgName: string;
  email: string;
  connectedAt: string;
  /** The connection stopped working (revoked in Buffer, say): connect again. */
  broken?: boolean;
  /** Why, for the log and the admin. */
  brokenWhy?: string;
  /** The channels as last read, shown while Buffer can't be reached. */
  channels?: OwnChannel[];
  /** The advisor disconnected (kept so the old shared file can't bring the link back). */
  gone?: boolean;
}

/**
 * One file per advisor. They used to share one file, rewritten whole on every
 * token refresh: two advisors refreshing at once could put back each other's
 * old (already used) refresh token, and Buffer revokes a connection whose
 * refresh token is used twice.
 */
const linkKey = (userId: string) => `ownbuffer/${userId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40)}.json`;
async function readLink(userId: string): Promise<Link | null> {
  const own = await getJSON<Link>(linkKey(userId));
  if (own) return own.gone ? null : own;
  // First read since the move: bring the advisor's entry over from the shared file.
  const old = (await getJSON<{ byUser: Record<string, Link> }>(LINKS).catch(() => null))?.byUser?.[userId];
  if (!old) return null;
  await putJSON(linkKey(userId), old);
  return old;
}
const saveLink = (userId: string, l: Link | null) => putJSON(linkKey(userId), l ?? { gone: true });

type TokenState = { token: string } | { token: null; reason: "none" | "broken" | "transient" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One refresh at a time per advisor: a reused refresh token revokes the whole grant. */
const refreshing = new Map<string, Promise<TokenState>>();

/**
 * The advisor's current access token, refreshed when due (or when `rejected`
 * is the token Buffer just refused). Only a refusal from Buffer's own token
 * service marks the connection broken; a network blip or an outage doesn't.
 */
async function tokenState(userId: string, rejected?: string): Promise<TokenState> {
  const l = await readLink(userId);
  if (!l) return { token: null, reason: "none" };
  if (l.broken) return { token: null, reason: "broken" };
  const good = (x: Link) => {
    const access = x.expiresAt > Date.now() ? unseal(x.access) : null;
    return access && access !== rejected ? access : null;
  };
  const now = good(l);
  if (now) return { token: now };
  const running = refreshing.get(userId);
  if (running) return running;
  const p = (async (): Promise<TokenState> => {
    // Re-read: another request (or another server, mid-deploy) may have refreshed already.
    const cur = await readLink(userId);
    if (!cur) return { token: null, reason: "none" };
    if (cur.broken) return { token: null, reason: "broken" };
    const fresh = good(cur);
    if (fresh) return { token: fresh };
    const refresh = cur.refresh ? unseal(cur.refresh) : null;
    const breakIt = async (why: string): Promise<TokenState> => {
      console.error(`[buffer] connection for ${userId} marked disconnected: ${why}`);
      await saveLink(userId, { ...cur, broken: true, brokenWhy: why });
      return { token: null, reason: "broken" };
    };
    // Connected without a refresh token: it lasts as long as the access token.
    if (!refresh) return breakIt("the access token ran out and Buffer issued no refresh token (offline_access not granted to this app client)");
    for (let attempt = 0; ; attempt++) {
      try {
        const t = await refreshTokens(refresh);
        // Save the new pair before anything uses it.
        await saveLink(userId, { ...cur, access: seal(t.access), refresh: seal(t.refresh), expiresAt: t.expiresAt });
        return { token: t.access };
      } catch (e) {
        const code = e instanceof OAuthError ? e.code : undefined;
        if (code === "invalid_grant" || code === "invalid_client" || code === "unauthorized_client") {
          // Another server may have used this refresh token a moment ago (a deploy in progress): use what it saved.
          await sleep(1500);
          const other = await readLink(userId).catch(() => null);
          const theirs = other && !other.broken && other.refresh !== cur.refresh ? good(other) : null;
          if (theirs) return { token: theirs };
          return breakIt(`Buffer refused the refresh token (${code}: ${(e as Error).message})`);
        }
        // Couldn't reach Buffer, or it's having trouble: the connection itself is fine. One quick retry, then say so.
        if (attempt === 0 && code === "network") {
          await sleep(800);
          continue;
        }
        console.warn(`[buffer] couldn't refresh for ${userId} (will try again): ${code ?? ""} ${(e as Error).message}`);
        return { token: null, reason: "transient" };
      }
    }
  })().finally(() => refreshing.delete(userId));
  refreshing.set(userId, p);
  return p;
}

/** The advisor's current access token, or null when there isn't a usable one right now. Server only. */
const tokenFor = async (userId: string) => (await tokenState(userId)).token;

const channelsCache = new Map<string, { at: number; channels: OwnChannel[] }>();
const toChannel = (c: { id: string; service: string; name: string; displayName: string | null; avatar: string; isDisconnected: boolean }): OwnChannel => ({
  id: c.id,
  service: c.service,
  name: c.displayName || c.name,
  avatar: c.avatar || undefined,
  disconnected: c.isDisconnected || undefined,
});

export const socialAvailable = () => secretsConfigured() && oauthConfigured();

/** Finish connecting: tokens from Buffer's consent screen. Refuses the studio's own Buffer. */
export async function saveConnection(user: User, t: Tokens) {
  let acct: Awaited<ReturnType<typeof bufferAccountOf>> | undefined;
  let last: unknown;
  // A brand-new token can take a moment to be accepted: try a few times before giving up.
  for (let i = 0; i < 3 && !acct; i++) {
    if (i) await sleep(Math.min(6000, ((last as BufferError)?.retryAfterSec ?? 1.2 * i) * 1000));
    acct = await bufferAccountOf(t.access).catch((e) => {
      last = e;
      return undefined;
    });
    if (last instanceof BufferError && (last.auth || last.status === 400)) break;
  }
  if (!acct) {
    const e = last as BufferError;
    console.error(`[buffer] connected, but reading the account failed for ${user.id}: ${(last as Error)?.message ?? last}`);
    if (e instanceof BufferError && (e.auth || e.status === 400)) throw new SocialError(e.auth ? "Connected, but couldn’t read your Buffer. Try again." : e.message, 502);
    // Buffer granted the connection but wouldn't answer just now (rate limit, outage): keep it.
    // Whose Buffer it is gets checked on the first successful read, before anything can be posted.
    await saveLink(user.id, { access: seal(t.access), refresh: t.refresh ? seal(t.refresh) : "", expiresAt: t.expiresAt, orgId: "", orgName: "", email: "", connectedAt: new Date().toISOString() });
    channelsCache.delete(user.id);
    lastRead.delete(user.id);
    return;
  }
  // The studio's Buffer holds every advisor's channels: never let an advisor act through it.
  if (bufferConfigured() && !isAdmin(user)) {
    const studio = await getOrganization().catch(() => null);
    if (studio && studio.id === acct.organization.id) throw new SocialError("That’s the studio’s Buffer. Sign in to Buffer with your own account and connect again.", 403);
  }
  const channels = acct.channels.map(toChannel);
  await saveLink(user.id, { access: seal(t.access), refresh: t.refresh ? seal(t.refresh) : "", expiresAt: t.expiresAt, orgId: acct.organization.id, orgName: acct.organization.name, email: acct.email, connectedAt: new Date().toISOString(), channels });
  channelsCache.set(user.id, { at: Date.now(), channels });
}

export async function disconnect(user: User) {
  await saveLink(user.id, null);
  channelsCache.delete(user.id);
}

const RECONNECT = "Buffer disconnected Renom. Connect again.";

/** Reads in flight, and when each advisor's Buffer was last asked: several parts of a page ask at once. */
const reading = new Map<string, Promise<SocialStatus>>();
const lastRead = new Map<string, number>();

export async function socialStatus(user: User, fresh = false): Promise<SocialStatus> {
  if (!socialAvailable()) return { available: false, connected: false, channels: [] };
  const l = await readLink(user.id);
  if (!l) return { available: true, connected: false, channels: [] };
  const base = { available: true, connected: true, email: l.email, organization: l.orgName || "your Buffer" };
  if (l.broken) return { ...base, channels: [], error: l.refresh ? RECONNECT : "Your Buffer connection timed out. Connect again (one click)." };
  const hit = channelsCache.get(user.id);
  // Fresh means "not older than a few seconds", not "ask Buffer on every call".
  if (hit && Date.now() - hit.at < (fresh ? 10_000 : 60_000)) return { ...base, channels: hit.channels };
  const running = reading.get(user.id);
  if (running) return running;
  // Buffer can't be reached right now, but the connection stands: show the channels as last read.
  const known = hit?.channels ?? l.channels;
  const later = (limited = false): SocialStatus =>
    known?.length ? { ...base, channels: known } : { ...base, channels: [], error: limited ? "Connected. Buffer is limiting requests right now, so your channels will show up in a few minutes." : "Couldn’t reach Buffer just now. Your connection is still in place; try again in a minute." };
  // After a refusal, give Buffer a moment before asking again.
  if (Date.now() - (lastRead.get(user.id) ?? 0) < 15_000 && !hit) return later(true);
  const p = (async (): Promise<SocialStatus> => {
    let st = await tokenState(user.id);
    for (let attempt = 0; attempt < 2; attempt++) {
      if (st.token === null) return st.reason === "transient" ? later() : { ...base, channels: [], error: l.refresh ? RECONNECT : "Your Buffer connection timed out. Connect again (one click)." };
      try {
        const acct = await bufferAccountOf(st.token);
        const channels = acct.channels.map(toChannel);
        // Connected while Buffer wouldn't answer: check whose Buffer it is now, before it can be used.
        if (!l.orgId && bufferConfigured() && !isAdmin(user)) {
          const studio = await getOrganization().catch(() => null);
          if (!studio) return later();
          if (studio.id === acct.organization.id) {
            await saveLink(user.id, null);
            return { available: true, connected: false, channels: [], error: "That’s the studio’s Buffer. Sign in to Buffer with your own account and connect again." };
          }
        }
        channelsCache.set(user.id, { at: Date.now(), channels });
        if (!l.orgId || JSON.stringify(channels) !== JSON.stringify(l.channels ?? null)) {
          // Keep them with the link (re-read first: the tokens may have just been refreshed).
          const cur = await readLink(user.id).catch(() => null);
          if (cur && !cur.broken) await saveLink(user.id, { ...cur, orgId: acct.organization.id, orgName: acct.organization.name, email: acct.email, channels }).catch(() => {});
        }
        return { ...base, email: acct.email, organization: acct.organization.name, channels };
      } catch (e) {
        // Buffer refused the access token: it may have expired early. Refresh once and try again.
        if (e instanceof BufferError && e.auth && attempt === 0) {
          st = await tokenState(user.id, st.token);
          continue;
        }
        lastRead.set(user.id, Date.now());
        console.warn(`[buffer] reading channels failed for ${user.id}: ${(e as Error).message}`);
        if (e instanceof BufferError && e.auth) return { ...base, channels: [], error: RECONNECT };
        return later(e instanceof BufferError && e.status === 429);
      }
    }
    return later();
  })().finally(() => reading.delete(user.id));
  reading.set(user.id, p);
  return p;
}

// ── posts ──

interface StoredPost extends SocialPost {
  userId: string;
}
const allPosts = async () => (await getJSON<{ posts: StoredPost[] }>(POSTS))?.posts ?? [];
const savePosts = (posts: StoredPost[]) => putJSON(POSTS, { posts: posts.slice(0, 5000) });
const forUser = ({ userId: _u, ...p }: StoredPost): SocialPost => p;

export interface PublishInput {
  /** The video, or the text/image post, this belongs to. */
  videoId: string;
  title: string;
  /** A video post; leave out for a text or image post. */
  videoUrl?: string;
  /** An image post's picture. */
  imageUrl?: string;
  /** One per channel: which of our platforms' captions goes to it. */
  posts: { channelId: string; platform: PlatformId; text: string; title?: string }[];
  disclosureVersion: string;
  /** ISO; omitted to post now. */
  scheduleAt?: string;
  /** Where the cover is, for networks where Buffer picks the thumbnail frame. */
  thumbnailOffsetMs?: number;
}

const statusFrom = (s: string): SocialPostStatus => (s === "sent" ? "posted" : s === "error" ? "failed" : s === "sending" ? "posting" : "scheduled");

/** Post (or schedule) to the advisor's own channels. Each channel succeeds or fails on its own. */
export async function publish(user: User, i: PublishInput) {
  const ts = await tokenState(user.id);
  if (ts.token === null) throw ts.reason === "transient" ? new SocialError("Couldn’t reach Buffer just now. Your connection is still in place; try again in a minute.", 503) : new SocialError("Connect your Buffer first (Settings → Publishing).");
  const token = ts.token;
  const { channels } = await socialStatus(user, true);
  const now = new Date().toISOString();
  const made: StoredPost[] = [];
  const errors: { platform: PlatformId; channel: string; error: string }[] = [];
  for (const p of i.posts) {
    // Only ever the advisor's own channels, of the right kind.
    const ch = channels.find((c) => c.id === p.channelId && c.service === SERVICE_OF[p.platform]);
    if (!ch) {
      errors.push({ platform: p.platform, channel: p.channelId, error: "That channel isn’t in your Buffer." });
      continue;
    }
    const r = await createBufferPost({ channelId: ch.id, service: SERVICE_OF[p.platform], text: p.text, mode: i.scheduleAt ? "schedule" : "now", dueAt: i.scheduleAt, videoUrl: i.videoUrl, imageUrl: i.imageUrl, title: p.title || i.title, thumbnailOffsetMs: i.thumbnailOffsetMs }, token);
    if (!r.ok) {
      errors.push({ platform: p.platform, channel: ch.name, error: r.error });
      continue;
    }
    made.push({
      id: r.post.id,
      userId: user.id,
      videoId: i.videoId,
      platform: p.platform,
      channelId: ch.id,
      channelName: ch.name,
      caption: p.text,
      disclosureVersion: i.disclosureVersion,
      status: i.scheduleAt ? "scheduled" : statusFrom(r.post.status) === "posted" ? "posted" : "posting",
      createdAt: now,
      scheduledFor: i.scheduleAt ?? r.post.dueAt ?? undefined,
      postUrl: r.post.externalLink ?? undefined,
    });
  }
  if (made.length) await savePosts([...made, ...(await allPosts())]);
  return { posts: made.map(forUser), errors };
}

/** The advisor's posts (for one video), with anything in flight checked against their Buffer. */
export async function postsFor(user: User, videoId?: string): Promise<SocialPost[]> {
  const all = await allPosts();
  const mine = all.filter((x) => x.userId === user.id && (!videoId || x.videoId === videoId));
  const due = mine.filter((x) => x.status === "posting" || (x.status === "scheduled" && (!x.scheduledFor || Date.parse(x.scheduledFor) < Date.now())));
  const token = due.length ? await tokenFor(user.id) : null;
  if (token) {
    let changed = false;
    for (const x of due.slice(0, 10)) {
      try {
        const p = await getPost(x.id, token);
        const s = statusFrom(p.status);
        if (s !== x.status || (p.externalLink ?? undefined) !== x.postUrl) {
          x.status = s;
          x.postUrl = p.externalLink ?? x.postUrl;
          if (s === "posted") x.postedAt = p.sentAt ?? x.scheduledFor ?? new Date().toISOString();
          if (s === "failed") x.error = p.error?.message ?? "Buffer couldn’t post it.";
          changed = true;
        }
      } catch {
        // leave it; we'll look again next time
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
  const token = await tokenFor(user.id);
  if (!token) throw new SocialError("Connect your Buffer again to cancel this one.");
  await deletePost(id, token).catch((e) => {
    throw new SocialError((e as Error).message, 502);
  });
  x.status = "cancelled";
  await savePosts(all);
  return forUser(x);
}
