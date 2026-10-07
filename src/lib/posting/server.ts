import { randomBytes } from "node:crypto";
import { getJSON, putJSON } from "@/lib/storage/objects";
import type { User } from "@/lib/auth/server";
import type { AdvisorPostRequest, PostRequest } from "./types";

/**
 * Posting requests live in one list in the store (meta/postqueue.json), and
 * which Buffer channels belong to which advisor in meta/channelmap.json.
 * Only the admin side ever talks to Buffer.
 */

const QUEUE = "meta/postqueue.json";
const CHANNELS = "meta/channelmap.json";

export const allRequests = async () => (await getJSON<{ requests: PostRequest[] }>(QUEUE))?.requests ?? [];
const save = (requests: PostRequest[]) => putJSON(QUEUE, { requests });

export const forAdvisor = ({ buffer: _buffer, ...r }: PostRequest): AdvisorPostRequest => r;

export async function requestsFor(userId: string) {
  return (await allRequests()).filter((r) => r.userId === userId).map(forAdvisor);
}

/** A new request, or an update to this video's open one (re-submitting after changes). */
export async function submitRequest(user: User, input: Omit<PostRequest, "id" | "userId" | "advisorEmail" | "status" | "submittedAt" | "updatedAt" | "teamNote" | "scheduledFor" | "postedAt" | "buffer">) {
  const all = await allRequests();
  const now = new Date().toISOString();
  const open = all.find((r) => r.userId === user.id && r.videoId === input.videoId && (r.status === "submitted" || r.status === "returned"));
  const base = { ...input, userId: user.id, advisorEmail: user.email, status: "submitted" as const, updatedAt: now, teamNote: undefined };
  const req: PostRequest = open ? { ...open, ...base } : { ...base, id: `p${randomBytes(9).toString("hex")}`, submittedAt: now };
  await save(open ? all.map((r) => (r.id === open.id ? req : r)) : [req, ...all]);
  return forAdvisor(req);
}

export async function updateRequest(id: string, patch: Partial<PostRequest>) {
  const all = await allRequests();
  const cur = all.find((r) => r.id === id);
  if (!cur) return null;
  const next: PostRequest = { ...cur, ...patch, id, userId: cur.userId, updatedAt: new Date().toISOString() };
  await save(all.map((r) => (r.id === id ? next : r)));
  return next;
}

// ── which Buffer channels post for which advisor ──
export const channelMap = async () => (await getJSON<{ byUser: Record<string, string[]> }>(CHANNELS))?.byUser ?? {};
export async function setChannelsFor(userId: string, channelIds: string[]) {
  const byUser = await channelMap();
  await putJSON(CHANNELS, { byUser: { ...byUser, [userId]: channelIds } });
}
