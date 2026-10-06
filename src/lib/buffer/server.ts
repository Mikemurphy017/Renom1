import type { BufferChannel, BufferScheduledPost, BufferStatus, CreateBufferPostRequest, CreateBufferPostResponse } from "./types";

/**
 * Server-only Buffer GraphQL client. The API key never leaves the server:
 * set BUFFER_API_KEY in .env.local (create one at publish.buffer.com/settings/api).
 */
const API_URL = process.env.BUFFER_API_URL || "https://api.buffer.com";

class BufferError extends Error {}

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const key = process.env.BUFFER_API_KEY;
  if (!key) throw new BufferError("BUFFER_API_KEY is not set");
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  const text = await res.text();
  let body: { data?: T; errors?: { message: string }[] };
  try {
    body = JSON.parse(text);
  } catch {
    throw new BufferError(`Buffer returned ${res.status}: ${text.slice(0, 200)}`);
  }
  if (res.status === 401 || res.status === 403) throw new BufferError("Buffer rejected the API key. Check BUFFER_API_KEY.");
  if (body.errors?.length) throw new BufferError(body.errors.map((e) => e.message).join("; "));
  if (!res.ok || !body.data) throw new BufferError(`Buffer request failed (${res.status})`);
  return body.data;
}

export const bufferConfigured = () => !!process.env.BUFFER_API_KEY;

export async function getBufferStatus(): Promise<BufferStatus> {
  if (!bufferConfigured()) return { configured: false, reason: "BUFFER_API_KEY is not set" };
  try {
    const { account } = await gql<{
      account: {
        name: string | null;
        email: string;
        timezone: string | null;
        organizations: { id: string; name: string; channelCount: number; limits: { channels: number } }[];
      };
    }>(`query { account { name email timezone organizations { id name channelCount limits { channels } } } }`);
    const wanted = process.env.BUFFER_ORGANIZATION_ID;
    const org = account.organizations.find((o) => o.id === wanted) ?? account.organizations[0];
    if (!org) return { configured: true, error: "This Buffer account has no organizations." };

    const data = await gql<{ channels: BufferChannel[]; posts: { edges: { node: BufferScheduledPost }[] | null } }>(
      `query RenomBuffer($org: OrganizationId!) {
        channels(input: { organizationId: $org }) {
          id name displayName service type avatar timezone isDisconnected isLocked isQueuePaused
        }
        posts(first: 50, input: { organizationId: $org, filter: { status: [scheduled] }, sort: [{ field: dueAt, direction: asc }] }) {
          edges { node { id text status dueAt channelId channelService } }
        }
      }`,
      { org: org.id }
    );
    return {
      configured: true,
      account: { name: account.name, email: account.email, timezone: account.timezone },
      organization: { id: org.id, name: org.name, channelCount: org.channelCount, channelLimit: org.limits.channels },
      channels: data.channels,
      upcoming: (data.posts.edges ?? []).map((e) => e.node),
    };
  } catch (e) {
    return { configured: true, error: (e as Error).message };
  }
}

function metadataFor(req: CreateBufferPostRequest) {
  switch (req.service) {
    case "youtube":
      return { youtube: { title: (req.title || req.text.split("\n")[0]).slice(0, 100), privacy: "public", madeForKids: false, notifySubscribers: true } };
    case "instagram":
      return { instagram: { type: "reel", shouldShareToFeed: true } };
    case "facebook":
      return { facebook: { type: "reel" } };
    case "tiktok":
      return req.title ? { tiktok: { title: req.title.slice(0, 90) } } : undefined;
    default:
      return undefined;
  }
}

export async function createBufferPost(req: CreateBufferPostRequest): Promise<CreateBufferPostResponse> {
  const input: Record<string, unknown> = {
    channelId: req.channelId,
    text: req.text,
    schedulingType: "automatic",
    mode: req.mode === "now" ? "shareNow" : req.mode === "queue" ? "addToQueue" : "customScheduled",
    assets: req.videoUrl
      ? [{ video: { url: req.videoUrl, thumbnailUrl: req.thumbnailUrl || undefined, metadata: req.title ? { title: req.title.slice(0, 100) } : undefined } }]
      : [],
    source: "renom",
  };
  if (req.mode === "schedule") input.dueAt = req.dueAt;
  if (req.draft) input.saveToDraft = true;
  const metadata = metadataFor(req);
  if (metadata) input.metadata = metadata;

  try {
    const { createPost } = await gql<{
      createPost: { __typename: string; post?: { id: string; status: string; dueAt: string | null; externalLink: string | null }; message?: string };
    }>(
      `mutation RenomCreatePost($input: CreatePostInput!) {
        createPost(input: $input) {
          __typename
          ... on PostActionSuccess { post { id status dueAt externalLink } }
          ... on MutationError { message }
        }
      }`,
      { input }
    );
    if (createPost.post) return { ok: true, post: createPost.post };
    return { ok: false, error: createPost.message || createPost.__typename };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
