import type {
  BufferChannel,
  BufferIdea,
  BufferIdeaGroup,
  BufferMetricsRange,
  BufferMetricsResult,
  BufferPageInfo,
  BufferPost,
  BufferQueuePosition,
  BufferScheduledPost,
  BufferStatus,
  BufferTag,
  CreateBufferIdeaRequest,
  CreateBufferPostRequest,
  CreateBufferPostResponse,
  EditBufferPostRequest,
  ListBufferPostsParams,
} from "./types";

/**
 * Server-only Buffer GraphQL client. The API key never leaves the server:
 * set BUFFER_API_KEY in .env.local (create one at publish.buffer.com/settings/api).
 */
const API_URL = process.env.BUFFER_API_URL || "https://api.buffer.com";

/** `status` is the HTTP status our routes should answer with. */
export class BufferError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const key = process.env.BUFFER_API_KEY;
  if (!key) throw new BufferError("Buffer is not connected", 503);
  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    });
  } catch {
    throw new BufferError("Couldn’t reach Buffer. Try again in a moment.", 502);
  }
  const text = await res.text();
  let body: { data?: T; errors?: { message: string }[] };
  try {
    body = JSON.parse(text);
  } catch {
    throw new BufferError(`Buffer returned ${res.status}: ${text.slice(0, 200)}`);
  }
  if (res.status === 401 || res.status === 403) throw new BufferError("Buffer rejected the API key. Check BUFFER_API_KEY.", 502);
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
          edges { node { id text status dueAt channelId channelService shareMode allowedActions } }
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

/** Networks don't take custom thumbnail images; Buffer can only pick a frame, and only on these. */
const FRAME_THUMBNAIL_SERVICES = new Set(["instagram", "tiktok", "pinterest"]);

function videoMetadataFor(req: CreateBufferPostRequest) {
  const m: { title?: string; thumbnailOffset?: number } = {};
  if (req.title) m.title = req.title.slice(0, 100);
  if (req.thumbnailOffsetMs !== undefined && FRAME_THUMBNAIL_SERVICES.has(req.service)) m.thumbnailOffset = Math.max(0, Math.round(req.thumbnailOffsetMs));
  return Object.keys(m).length ? m : undefined;
}

export async function createBufferPost(req: CreateBufferPostRequest): Promise<CreateBufferPostResponse> {
  const input: Record<string, unknown> = {
    channelId: req.channelId,
    text: req.text,
    schedulingType: "automatic",
    mode: req.mode === "now" ? "shareNow" : req.mode === "schedule" ? "customScheduled" : "addToQueue",
    assets: req.videoUrl ? [{ video: { url: req.videoUrl, metadata: videoMetadataFor(req) } }] : [],
    source: "renom",
  };
  if (req.mode === "schedule") input.dueAt = req.dueAt;
  if (req.draft || req.mode === "draft") input.saveToDraft = true;
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

/* ------------------------------------------------------------------------------------------------
 * Toolkit: posts, metrics, ideas, tags. Every name below comes from Buffer's GraphQL schema.
 * These throw BufferError (with an HTTP status) so routes can answer with clean JSON.
 * ---------------------------------------------------------------------------------------------- */

let orgCache: { key: string; org: { id: string; name: string } } | null = null;

/** The organization Renom works in: BUFFER_ORGANIZATION_ID, else the account's first one. */
export async function getOrganization(): Promise<{ id: string; name: string }> {
  const cacheKey = `${process.env.BUFFER_API_KEY?.slice(-6)}:${process.env.BUFFER_ORGANIZATION_ID ?? ""}`;
  if (orgCache?.key === cacheKey) return orgCache.org;
  const { account } = await gql<{ account: { organizations: { id: string; name: string }[] } }>(
    `query RenomOrg { account { organizations { id name } } }`
  );
  const wanted = process.env.BUFFER_ORGANIZATION_ID;
  const org = account.organizations.find((o) => o.id === wanted) ?? account.organizations[0];
  if (!org) throw new BufferError("This Buffer account has no organizations.", 502);
  orgCache = { key: cacheKey, org };
  return org;
}

const POST_FIELDS = `id text status dueAt sentAt createdAt channelId channelService externalLink shareMode allowedActions
  error { message } tags { id name color } metrics { type name value unit }`;

/** Mutation payloads are unions; map the error member to an HTTP status. */
type MutationResult = { __typename: string; message?: string };
function mutationError(r: MutationResult): never {
  const status =
    r.__typename === "NotFoundError" ? 404
    : r.__typename === "InvalidInputError" ? 400
    : r.__typename === "UnauthorizedError" ? 403
    : r.__typename === "LimitReachedError" ? 409
    : 502;
  throw new BufferError(r.message || `Buffer could not do that (${r.__typename})`, status);
}

export async function listPosts(params: ListBufferPostsParams = {}): Promise<{ posts: BufferPost[]; pageInfo: BufferPageInfo }> {
  const org = await getOrganization();
  const filter: Record<string, unknown> = {};
  if (params.status?.length) filter.status = params.status;
  if (params.channelIds?.length) filter.channelIds = params.channelIds;
  if (params.tagIds?.length) filter.tags = { in: params.tagIds };
  if (params.dueFrom || params.dueTo) filter.dueAt = { start: params.dueFrom, end: params.dueTo };
  const data = await gql<{ posts: { edges: { node: BufferPost }[] | null; pageInfo: BufferPageInfo } }>(
    `query RenomPosts($first: Int, $after: String, $input: PostsInput!) {
      posts(first: $first, after: $after, input: $input) {
        edges { node { ${POST_FIELDS} } }
        pageInfo { hasNextPage endCursor }
      }
    }`,
    {
      first: params.first ?? 20,
      after: params.after,
      input: {
        organizationId: org.id,
        filter,
        sort: [{ field: params.sort ?? "dueAt", direction: params.direction ?? "asc" }],
      },
    }
  );
  return { posts: (data.posts.edges ?? []).map((e) => e.node), pageInfo: data.posts.pageInfo };
}

export async function getPost(id: string): Promise<BufferPost> {
  const { post } = await gql<{ post: BufferPost }>(
    `query RenomPost($input: PostInput!) { post(input: $input) { ${POST_FIELDS} } }`,
    { input: { id } }
  );
  return post;
}

/** Change a post's text and/or move it to a set time. */
export async function editPost(id: string, req: EditBufferPostRequest): Promise<BufferPost> {
  const input: Record<string, unknown> = { id };
  if (req.text !== undefined) input.text = req.text;
  if (req.dueAt) {
    input.dueAt = req.dueAt;
    input.mode = "customScheduled";
  }
  const { editPost } = await gql<{ editPost: MutationResult & { post?: BufferPost } }>(
    `mutation RenomEditPost($input: EditPostInput!) {
      editPost(input: $input) {
        __typename
        ... on PostActionSuccess { post { ${POST_FIELDS} } }
        ... on MutationError { message }
      }
    }`,
    { input }
  );
  if (editPost.post) return editPost.post;
  mutationError(editPost);
}

export async function deletePost(id: string): Promise<{ id: string }> {
  const { deletePost } = await gql<{ deletePost: MutationResult & { id?: string } }>(
    `mutation RenomDeletePost($input: DeletePostInput!) {
      deletePost(input: $input) {
        __typename
        ... on DeletePostSuccess { id }
        ... on MutationError { message }
      }
    }`,
    { input: { id } }
  );
  if (deletePost.id) return { id: deletePost.id };
  mutationError(deletePost);
}

export async function movePostInQueue(id: string, position: BufferQueuePosition): Promise<BufferPost> {
  const { movePostInQueue } = await gql<{ movePostInQueue: MutationResult & { post?: BufferPost } }>(
    `mutation RenomMovePost($input: MovePostInQueueInput!) {
      movePostInQueue(input: $input) {
        __typename
        ... on PostActionSuccess { post { ${POST_FIELDS} } }
        ... on MutationError { message }
      }
    }`,
    { input: { id, position } }
  );
  if (movePostInQueue.post) return movePostInQueue.post;
  mutationError(movePostInQueue);
}

/** Totals across every post published in the range (optionally limited to some channels). */
export async function getAggregatedMetrics(range: BufferMetricsRange): Promise<BufferMetricsResult> {
  const org = await getOrganization();
  const input: Record<string, unknown> = { organizationId: org.id, startDateTime: range.start, endDateTime: range.end };
  if (range.channelIds?.length) input.channelIds = range.channelIds;
  const { aggregatedPostMetrics } = await gql<{ aggregatedPostMetrics: { metrics: BufferMetricsResult["metrics"]; metricsUpdatedAt: string | null } }>(
    `query RenomMetrics($input: AggregatedPostMetricsInput!) {
      aggregatedPostMetrics(input: $input) { metricsUpdatedAt metrics { type name description value unit } }
    }`,
    { input }
  );
  return { organization: org, range: { start: range.start, end: range.end }, ...aggregatedPostMetrics };
}

export async function listIdeas(params: { first?: number; after?: string } = {}): Promise<{ ideas: BufferIdea[]; groups: BufferIdeaGroup[]; pageInfo: BufferPageInfo }> {
  const org = await getOrganization();
  const data = await gql<{ ideas: { edges: { node: BufferIdea }[]; pageInfo: BufferPageInfo }; ideaGroups: BufferIdeaGroup[] }>(
    `query RenomIdeas($first: Int, $after: String, $input: IdeasInput!, $groups: IdeaGroupsInput!) {
      ideas(first: $first, after: $after, input: $input) {
        edges { node { id groupId createdAt updatedAt content { title text services date tags { id name color } } } }
        pageInfo { hasNextPage endCursor }
      }
      ideaGroups(input: $groups) { id name isLocked }
    }`,
    { first: params.first ?? 20, after: params.after, input: { organizationId: org.id }, groups: { organizationId: org.id } }
  );
  return { ideas: data.ideas.edges.map((e) => e.node), groups: data.ideaGroups, pageInfo: data.ideas.pageInfo };
}

export async function createIdea(req: CreateBufferIdeaRequest): Promise<BufferIdea> {
  const org = await getOrganization();
  const content: Record<string, unknown> = { title: req.title };
  if (req.text) content.text = req.text;
  if (req.services?.length) content.services = req.services;
  if (req.date) content.date = req.date;
  if (req.aiAssisted) content.aiAssisted = true;
  const input: Record<string, unknown> = { organizationId: org.id, content };
  if (req.groupId) input.group = { groupId: req.groupId };
  const IDEA = `id groupId createdAt updatedAt content { title text services date tags { id name color } }`;
  const { createIdea } = await gql<{ createIdea: MutationResult & Partial<BufferIdea> & { idea?: BufferIdea | null } }>(
    `mutation RenomCreateIdea($input: CreateIdeaInput!) {
      createIdea(input: $input) {
        __typename
        ... on Idea { ${IDEA} }
        ... on IdeaResponse { idea { ${IDEA} } }
        ... on MutationError { message }
      }
    }`,
    { input }
  );
  if (createIdea.__typename === "Idea" && createIdea.id && createIdea.content) {
    const { id, groupId = null, createdAt = 0, updatedAt = 0, content } = createIdea;
    return { id, groupId, createdAt, updatedAt, content };
  }
  if (createIdea.idea) return createIdea.idea;
  mutationError(createIdea);
}

export async function listTags(): Promise<BufferTag[]> {
  const org = await getOrganization();
  const { tagsV2 } = await gql<{ tagsV2: { edges: { node: BufferTag }[] } }>(
    `query RenomTags($input: TagsInput!) { tagsV2(first: 100, input: $input) { edges { node { id name color } } } }`,
    { input: { organizationId: org.id } }
  );
  return tagsV2.edges.map((e) => e.node);
}
