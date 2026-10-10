import { getJSON, putJSON } from "@/lib/storage/objects";
import { isAdmin, type User } from "@/lib/auth/server";
import { BufferError, bufferAccountOf, bufferConfigured, createBufferPost, deletePost, getOrganization, getPost } from "@/lib/buffer/server";
import { seal, secretsConfigured, unseal } from "@/lib/secrets";
import { OAuthError, oauthConfigured, refreshTokens, type Tokens } from "./oauth";
import type { PlatformId } from "@/lib/types";
import { SERVICE_OF, type OwnChannel, type SocialPost, type SocialPostStatus, type SocialStatus } from "./types";

/**
 * Advisors' own Buffer accounts, connected through Buffer's consent screen
 * (see oauth.ts). Tokens are stored encrypted (meta/ownbuffer.json) and only
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
}
const links = async () => (await getJSON<{ byUser: Record<string, Link> }>(LINKS))?.byUser ?? {};
async function saveLink(userId: string, l: Link | null) {
  const all = await links();
  if (l) all[userId] = l;
  else delete all[userId];
  await putJSON(LINKS, { byUser: all });
}

/** One refresh at a time per advisor: a reused refresh token revokes the whole grant. */
const refreshing = new Map<string, Promise<string | null>>();

/** The advisor's current access token (refreshed when due), or null when not connected. Server only. */
async function tokenFor(userId: string): Promise<string | null> {
  const l = (await links())[userId];
  if (!l || l.broken) return null;
  if (l.expiresAt > Date.now()) return unseal(l.access);
  const running = refreshing.get(userId);
  if (running) return running;
  const p = (async () => {
    // Re-read: another request may have refreshed while we waited.
    const cur = (await links())[userId];
    if (!cur || cur.broken) return null;
    if (cur.expiresAt > Date.now()) return unseal(cur.access);
    const refresh = cur.refresh ? unseal(cur.refresh) : null;
    // Connected without a refresh token: the advisor reconnects (one click) when the access token runs out.
    if (!refresh) {
      await saveLink(userId, { ...cur, broken: true });
      return null;
    }
    try {
      const t = await refreshTokens(refresh);
      // Save the new pair before anything uses it.
      await saveLink(userId, { ...cur, access: seal(t.access), refresh: seal(t.refresh), expiresAt: t.expiresAt });
      return t.access;
    } catch (e) {
      if (e instanceof OAuthError && e.code === "invalid_grant") await saveLink(userId, { ...cur, broken: true });
      return null;
    }
  })().finally(() => refreshing.delete(userId));
  refreshing.set(userId, p);
  return p;
}

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
  const acct = await bufferAccountOf(t.access).catch(() => {
    throw new SocialError("Connected, but couldn’t read your Buffer. Try again.", 502);
  });
  // The studio's Buffer holds every advisor's channels: never let an advisor act through it.
  if (bufferConfigured() && !isAdmin(user)) {
    const studio = await getOrganization().catch(() => null);
    if (studio && studio.id === acct.organization.id) throw new SocialError("That’s the studio’s Buffer. Sign in to Buffer with your own account and connect again.", 403);
  }
  await saveLink(user.id, { access: seal(t.access), refresh: t.refresh ? seal(t.refresh) : "", expiresAt: t.expiresAt, orgId: acct.organization.id, orgName: acct.organization.name, email: acct.email, connectedAt: new Date().toISOString() });
  channelsCache.set(user.id, { at: Date.now(), channels: acct.channels.map(toChannel) });
}

export async function disconnect(user: User) {
  await saveLink(user.id, null);
  channelsCache.delete(user.id);
}

export async function socialStatus(user: User, fresh = false): Promise<SocialStatus> {
  if (!socialAvailable()) return { available: false, connected: false, channels: [] };
  const l = (await links())[user.id];
  if (!l) return { available: true, connected: false, channels: [] };
  const base = { available: true, connected: true, email: l.email, organization: l.orgName };
  if (l.broken) return { ...base, channels: [], error: l.refresh ? "Buffer disconnected Renom. Connect again." : "Your Buffer connection timed out. Connect again (one click)." };
  const hit = channelsCache.get(user.id);
  if (!fresh && hit && Date.now() - hit.at < 60_000) return { ...base, channels: hit.channels };
  const token = await tokenFor(user.id);
  if (!token) return { ...base, channels: [], error: "Buffer disconnected Renom. Connect again." };
  try {
    const acct = await bufferAccountOf(token);
    const channels = acct.channels.map(toChannel);
    channelsCache.set(user.id, { at: Date.now(), channels });
    return { ...base, channels };
  } catch (e) {
    return { ...base, channels: [], error: e instanceof BufferError && e.status === 400 ? "Buffer disconnected Renom. Connect again." : "Couldn’t reach Buffer just now." };
  }
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
  videoUrl: string;
  /** One per channel: which of our platforms' captions goes to it. */
  posts: { channelId: string; platform: PlatformId; text: string; title?: string }[];
  disclosureVersion: string;
  /** ISO; omitted to post now. */
  scheduleAt?: string;
}

const statusFrom = (s: string): SocialPostStatus => (s === "sent" ? "posted" : s === "error" ? "failed" : s === "sending" ? "posting" : "scheduled");

/** Post (or schedule) to the advisor's own channels. Each channel succeeds or fails on its own. */
export async function publish(user: User, i: PublishInput) {
  const token = await tokenFor(user.id);
  if (!token) throw new SocialError("Connect your Buffer first (Settings → Publishing).");
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
    const r = await createBufferPost({ channelId: ch.id, service: SERVICE_OF[p.platform], text: p.text, mode: i.scheduleAt ? "schedule" : "now", dueAt: i.scheduleAt, videoUrl: i.videoUrl, title: p.title || i.title }, token);
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
