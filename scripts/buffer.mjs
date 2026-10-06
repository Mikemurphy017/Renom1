#!/usr/bin/env node
/**
 * Renom Buffer CLI: check your Buffer API key from the terminal (read-only).
 *
 *   npm run buffer -- account
 *   npm run buffer -- channels
 *   npm run buffer -- posts --status scheduled [--channel <id>] [--first 10] [--sort dueAt|createdAt] [--desc]
 *   npm run buffer -- post <id>
 *   npm run buffer -- metrics [--days 30] [--channel <id>]
 *   npm run buffer -- ideas [--first 10]
 *   npm run buffer -- tags
 *   add --json to any command for the raw response
 *
 * Reads BUFFER_API_KEY, BUFFER_ORGANIZATION_ID and BUFFER_API_URL from the environment or .env.local.
 * Sends `Authorization: Bearer <key>` to the GraphQL endpoint, exactly like the app's server client.
 * The key is never printed. No dependencies.
 */
import fs from "node:fs";
import path from "node:path";

/* ---------- env ---------- */
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || m[1] in process.env) continue;
    let v = m[2];
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, "");
    process.env[m[1]] = v;
  }
}
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, ".env"));

const API_URL = process.env.BUFFER_API_URL || "https://api.buffer.com";
const KEY = process.env.BUFFER_API_KEY;

/* ---------- args ---------- */
const argv = process.argv.slice(2);
const cmd = argv[0];
const positional = [];
const flags = {};
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) {
    const eq = a.indexOf("=");
    const k = eq === -1 ? a.slice(2) : a.slice(2, eq);
    if (eq !== -1) flags[k] = a.slice(eq + 1);
    else if (argv[i + 1] && !argv[i + 1].startsWith("--")) flags[k] = argv[++i];
    else flags[k] = true;
  } else positional.push(a);
}
const asJson = !!flags.json;
const list = (v) => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);
const die = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

/* ---------- GraphQL ---------- */
async function gql(query, variables = {}) {
  if (!KEY) die("BUFFER_API_KEY is not set (add it to .env.local).");
  let res;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ query, variables }),
    });
  } catch (e) {
    die(`Couldn't reach ${API_URL}: ${e.cause?.code || e.cause?.errors?.[0]?.code || e.message}`);
  }
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    die(`${API_URL} answered ${res.status}: ${text.slice(0, 200)}`);
  }
  if (res.status === 401 || res.status === 403) die(`Buffer rejected the key (HTTP ${res.status}). Check BUFFER_API_KEY.`);
  if (body.errors?.length) die(body.errors.map((e) => e.message).join("; "));
  if (!res.ok || !body.data) die(`Request failed (HTTP ${res.status})`);
  return body.data;
}

async function org() {
  const { account } = await gql(`query { account { organizations { id name } } }`);
  const wanted = process.env.BUFFER_ORGANIZATION_ID;
  const o = account.organizations.find((x) => x.id === wanted) ?? account.organizations[0];
  if (!o) die("This Buffer account has no organizations.");
  return o;
}

const when = (iso) => (iso ? new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—");
const oneLine = (t, n = 70) => {
  const s = (t || "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};
const fmtMetric = (m) => (m.unit === "percentage" ? `${m.value}%` : Number(m.value).toLocaleString("en-US"));
const out = (data, pretty) => (asJson ? console.log(JSON.stringify(data, null, 2)) : pretty(data));

/* ---------- commands ---------- */
const commands = {
  async account() {
    const data = await gql(`query { account { name email timezone organizations { id name channelCount limits { channels } } } }`);
    out(data, ({ account }) => {
      console.log(`✓ Key works. ${account.name ?? ""} <${account.email}> · ${account.timezone ?? "no timezone"}`);
      for (const o of account.organizations) {
        const mark = o.id === process.env.BUFFER_ORGANIZATION_ID ? " (BUFFER_ORGANIZATION_ID)" : "";
        console.log(`  ${o.id}  ${o.name} · ${o.channelCount}/${o.limits.channels} channels${mark}`);
      }
    });
  },

  async channels() {
    const o = await org();
    const data = await gql(
      `query C($org: OrganizationId!) { channels(input: { organizationId: $org }) { id name displayName service type timezone isDisconnected isLocked isQueuePaused } }`,
      { org: o.id }
    );
    out(data, ({ channels }) => {
      console.log(`${o.name}: ${channels.length} channel(s)`);
      for (const c of channels) {
        const flags = [c.isDisconnected && "disconnected", c.isLocked && "locked", c.isQueuePaused && "queue paused"].filter(Boolean).join(", ");
        console.log(`  ${c.id}  ${c.service.padEnd(10)} ${c.displayName || c.name}${flags ? ` [${flags}]` : ""}`);
      }
    });
  },

  async posts() {
    const o = await org();
    const status = list(flags.status);
    const allowed = ["draft", "error", "needs_approval", "scheduled", "sending", "sent"];
    if (status.some((s) => !allowed.includes(s))) die(`--status must be one of ${allowed.join(", ")}`);
    const filter = {};
    if (status.length) filter.status = status;
    if (flags.channel) filter.channelIds = list(flags.channel);
    const sort = flags.sort === "createdAt" ? "createdAt" : "dueAt";
    const data = await gql(
      `query P($first: Int, $after: String, $input: PostsInput!) {
        posts(first: $first, after: $after, input: $input) {
          edges { node { id text status dueAt sentAt channelService shareMode externalLink } }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      {
        first: Number(flags.first) || 10,
        after: typeof flags.after === "string" ? flags.after : undefined,
        input: { organizationId: o.id, filter, sort: [{ field: sort, direction: flags.desc ? "desc" : "asc" }] },
      }
    );
    out(data, ({ posts }) => {
      const edges = posts.edges ?? [];
      console.log(`${o.name}: ${edges.length} post(s)${status.length ? ` (${status.join(", ")})` : ""}`);
      for (const { node: p } of edges) {
        console.log(`  ${p.id}  ${p.status.padEnd(9)} ${when(p.sentAt || p.dueAt).padEnd(22)} ${p.channelService.padEnd(9)} ${oneLine(p.text)}`);
      }
      if (posts.pageInfo.hasNextPage) console.log(`  … more: --after ${posts.pageInfo.endCursor}`);
    });
  },

  async post() {
    const id = positional[0];
    if (!/^[a-f\d]{24}$/i.test(id || "")) die("Usage: post <24-hex id>");
    const data = await gql(
      `query P($input: PostInput!) { post(input: $input) { id text status dueAt sentAt channelId channelService shareMode externalLink allowedActions metrics { name value unit } } }`,
      { input: { id } }
    );
    out(data, ({ post: p }) => {
      console.log(`${p.id} · ${p.status} · ${p.channelService} · ${p.shareMode}`);
      console.log(`due ${when(p.dueAt)} · sent ${when(p.sentAt)}${p.externalLink ? ` · ${p.externalLink}` : ""}`);
      if (p.metrics?.length) console.log(p.metrics.map((m) => `${m.name}: ${fmtMetric(m)}`).join(" · "));
      console.log(`\n${p.text}`);
    });
  },

  async metrics() {
    const o = await org();
    const days = Number(flags.days ?? 30);
    if (!Number.isInteger(days) || days < 1 || days > 365) die("--days must be 1–365");
    const end = new Date();
    const start = new Date(end.getTime() - days * 86_400_000);
    const input = { organizationId: o.id, startDateTime: start.toISOString(), endDateTime: end.toISOString() };
    if (flags.channel) input.channelIds = list(flags.channel);
    const data = await gql(
      `query M($input: AggregatedPostMetricsInput!) { aggregatedPostMetrics(input: $input) { metricsUpdatedAt metrics { type name value unit } } }`,
      { input }
    );
    out(data, ({ aggregatedPostMetrics: a }) => {
      console.log(`${o.name}: last ${days} days (updated ${when(a.metricsUpdatedAt)})`);
      for (const m of a.metrics) console.log(`  ${m.name.padEnd(20)} ${fmtMetric(m).padStart(10)}`);
    });
  },

  async ideas() {
    const o = await org();
    const data = await gql(
      `query I($first: Int, $input: IdeasInput!, $groups: IdeaGroupsInput!) {
        ideas(first: $first, input: $input) { edges { node { id groupId content { title text } } } pageInfo { hasNextPage } }
        ideaGroups(input: $groups) { id name }
      }`,
      { first: Number(flags.first) || 10, input: { organizationId: o.id }, groups: { organizationId: o.id } }
    );
    out(data, ({ ideas, ideaGroups }) => {
      const group = Object.fromEntries(ideaGroups.map((g) => [g.id, g.name]));
      console.log(`${o.name}: ${ideas.edges.length} idea(s) · groups: ${ideaGroups.map((g) => g.name).join(", ") || "none"}`);
      for (const { node: i } of ideas.edges) console.log(`  ${i.id}  [${group[i.groupId] ?? "ungrouped"}] ${oneLine(i.content.title || i.content.text)}`);
    });
  },

  async tags() {
    const o = await org();
    const data = await gql(`query T($input: TagsInput!) { tagsV2(first: 100, input: $input) { totalCount edges { node { id name color } } } }`, {
      input: { organizationId: o.id },
    });
    out(data, ({ tagsV2 }) => {
      console.log(`${o.name}: ${tagsV2.totalCount} tag(s)`);
      for (const { node: t } of tagsV2.edges) console.log(`  ${t.id}  ${t.name} (${t.color})`);
    });
  },
};

if (!cmd || cmd === "help" || flags.help || !commands[cmd]) {
  const lines = fs.readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(2, 16).map((l) => l.replace(/^ \*\s?/, ""));
  console.log(lines.join("\n"));
  process.exit(cmd && !commands[cmd] && cmd !== "help" ? 1 : 0);
}
console.error(`→ ${API_URL} · key ${KEY ? "set" : "missing"}${process.env.BUFFER_ORGANIZATION_ID ? " · org from BUFFER_ORGANIZATION_ID" : ""}`);
await commands[cmd]();
