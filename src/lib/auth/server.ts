import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getJSON, objects, putJSON } from "@/lib/storage/objects";

/**
 * Accounts and sessions, kept in the platform object store (the storage
 * bucket in production): users/<email hash>.json, sessions/<token hash>.json,
 * state/<user id>.json. Passwords are hashed with scrypt; the session cookie
 * holds a random token and only its hash is stored.
 *
 * Who can create an account: the first account is open. After that, new
 * accounts need an invite: a single-use link from the admin dashboard, or
 * INVITE_CODE when set. Without either, sign-ups are closed.
 *
 * Admins (ADMIN_EMAILS, comma-separated) can see every account, send reset
 * links, disable accounts and create invites.
 */

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = "renom_session";
export const SESSION_DAYS = 30;

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}
interface StoredUser extends User {
  salt: string;
  hash: string;
  disabled?: boolean;
  lastSignInAt?: string;
  /** Sessions created before this (ms) are no longer valid: set by a password reset or "sign out everywhere". */
  sessionsValidAfter?: number;
  /** Reset links issued before this (ms) no longer work. */
  passwordChangedAt?: number;
}
interface Session {
  userId: string;
  expiresAt: number;
  createdAt?: number;
  user: User;
}

/** One row per account, so the admin can list them. */
export interface IndexEntry {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastSignInAt?: string;
  disabled?: boolean;
}
interface Index {
  ids: string[];
  users?: Record<string, IndexEntry>;
}

const h40 = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 40);
export const normEmail = (e: string) => e.trim().toLowerCase();
const userKey = (email: string) => `users/${h40(normEmail(email))}.json`;
const sessionKey = (token: string) => `sessions/${h40(token)}.json`;
const INDEX = "meta/userindex.json";
const INVITES = "meta/invites.json";
const resetKey = (token: string) => `resets/${h40(token)}.json`;

const DEFAULT_ADMIN = "mike@bluestonepartnersllc.com";
const adminEmails = () => (process.env.ADMIN_EMAILS?.trim() || DEFAULT_ADMIN).split(",").map(normEmail).filter(Boolean);
export const isAdmin = (user: Pick<User, "email"> | null | undefined) => !!user && adminEmails().includes(normEmail(user.email));

async function hashPassword(password: string, salt = randomBytes(16)) {
  const hash = await scrypt(password.normalize("NFKC"), salt, 64);
  return { salt: salt.toString("hex"), hash: hash.toString("hex") };
}

const readIndex = async (): Promise<Index> => (await getJSON<Index>(INDEX)) ?? { ids: [] };

export async function userCount() {
  return (await readIndex()).ids.length;
}

async function indexUser(u: StoredUser) {
  const index = await readIndex();
  const entry: IndexEntry = { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt, lastSignInAt: u.lastSignInAt, disabled: u.disabled };
  const ids = index.ids.includes(u.id) ? index.ids : [...index.ids, u.id];
  await putJSON(INDEX, { ids, users: { ...index.users, [u.id]: entry } } satisfies Index);
}

/** Accounts made before the index kept details are filled in the next time they're seen. */
export async function ensureIndexed(user: User) {
  const index = await readIndex();
  if (index.users?.[user.id]) return;
  const u = await getJSON<StoredUser>(userKey(user.email));
  if (u) await indexUser(u);
}

export async function signupPolicy(): Promise<{ open: boolean; needsCode: boolean }> {
  if ((await userCount()) === 0) return { open: true, needsCode: false };
  const invitesOut = (await readInvites()).some(inviteUsable);
  return process.env.INVITE_CODE?.trim() || invitesOut ? { open: true, needsCode: true } : { open: false, needsCode: false };
}

export class AuthError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export async function createUser(input: { email: string; password: string; name: string; invite?: string }): Promise<User> {
  const email = normEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) throw new AuthError("Enter a valid email address.");
  if (input.password.length < 10) throw new AuthError("Use at least 10 characters for your password.");
  if (input.password.length > 200) throw new AuthError("That password is too long.");
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new AuthError("Enter your name.");

  const policy = await signupPolicy();
  if (!policy.open) throw new AuthError("New accounts are by invitation. Ask your administrator for an invite.", 403);
  let invite: Invite | null = null;
  if (policy.needsCode) {
    const given = (input.invite ?? "").trim();
    const code = process.env.INVITE_CODE?.trim() ?? "";
    const codeOk = !!code && given.length === code.length && timingSafeEqual(Buffer.from(given), Buffer.from(code));
    if (!codeOk) {
      invite = given ? ((await readInvites()).find((i) => i.id === h40(given)) ?? null) : null;
      if (!invite || !inviteUsable(invite)) throw new AuthError(invite ? "That invite has already been used or has expired." : "That invite code isn’t right.", 403);
      if (invite.email && invite.email !== email) throw new AuthError(`This invite is for ${invite.email}.`, 403);
    }
  }
  if (await objects().stat(userKey(email))) throw new AuthError("An account with that email already exists. Sign in instead.", 409);

  const now = new Date().toISOString();
  const user: StoredUser = { id: `u${randomBytes(9).toString("hex")}`, email, name, createdAt: now, lastSignInAt: now, ...(await hashPassword(input.password)) };
  await putJSON(userKey(email), user);
  await indexUser(user);
  if (invite) await updateInvite(invite.id, { usedAt: now, usedBy: email });
  return publicUser(user);
}

const publicUser = (u: StoredUser): User => ({ id: u.id, email: u.email, name: u.name, createdAt: u.createdAt });

export async function verifyPassword(emailRaw: string, password: string): Promise<User | null> {
  const u = await getJSON<StoredUser>(userKey(emailRaw));
  // Hash anyway when the account doesn't exist, so timing doesn't reveal which emails have accounts.
  const { hash } = await hashPassword(password, u ? Buffer.from(u.salt, "hex") : randomBytes(16));
  if (!u) return null;
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(u.hash, "hex");
  if (!(a.length === b.length && timingSafeEqual(a, b))) return null;
  if (u.disabled) throw new AuthError("This account has been disabled. Contact your administrator.", 403);
  return publicUser(u);
}

/** Notes the sign-in time (shown on the admin dashboard). */
export async function recordSignIn(user: User) {
  const u = await getJSON<StoredUser>(userKey(user.email));
  if (!u) return;
  const next = { ...u, lastSignInAt: new Date().toISOString() };
  await putJSON(userKey(user.email), next);
  await indexUser(next);
}

function checkNewPassword(next: string) {
  if (next.length < 10) throw new AuthError("Use at least 10 characters for your new password.");
  if (next.length > 200) throw new AuthError("That password is too long.");
}

export async function changePassword(user: User, current: string, next: string) {
  if (!(await verifyPassword(user.email, current))) throw new AuthError("Your current password isn’t right.", 403);
  checkNewPassword(next);
  const u = await getJSON<StoredUser>(userKey(user.email));
  if (!u) throw new AuthError("Account not found.", 404);
  await putJSON(userKey(user.email), { ...u, ...(await hashPassword(next)), passwordChangedAt: Date.now() });
}

// ── password reset ───────────────────────────────────────────────────────────

interface Reset {
  userId: string;
  email: string;
  createdAt: number;
  expiresAt: number;
  usedAt?: number;
}
export const RESET_MINUTES = 60;

/** A one-time reset token for this email, or null when there's no usable account. */
export async function createResetToken(emailRaw: string, minutes = RESET_MINUTES): Promise<{ token: string; user: User } | null> {
  const u = await getJSON<StoredUser>(userKey(emailRaw));
  if (!u || u.disabled) return null;
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  await putJSON(resetKey(token), { userId: u.id, email: u.email, createdAt: now, expiresAt: now + minutes * 60_000 } satisfies Reset);
  return { token, user: publicUser(u) };
}

async function usableReset(token: string) {
  if (!token || token.length < 20 || token.length > 100) return null;
  const r = await getJSON<Reset>(resetKey(token)).catch(() => null);
  if (!r || r.usedAt || r.expiresAt < Date.now()) return null;
  const u = await getJSON<StoredUser>(userKey(r.email));
  // A newer password (or a removed or disabled account) retires older links.
  if (!u || u.id !== r.userId || u.disabled || (u.passwordChangedAt ?? 0) > r.createdAt) return null;
  return { r, u };
}

/** Whose link this is (for the reset page), or null if it no longer works. */
export async function checkResetToken(token: string) {
  const ok = await usableReset(token);
  return ok ? { email: ok.u.email } : null;
}

/** Sets the new password, retires the link and signs the account out everywhere. */
export async function resetPassword(token: string, next: string): Promise<User> {
  const ok = await usableReset(token);
  if (!ok) throw new AuthError("This reset link has expired or was already used. Request a new one.", 410);
  checkNewPassword(next);
  const now = Date.now();
  await putJSON(resetKey(token), { ...ok.r, usedAt: now } satisfies Reset);
  await putJSON(userKey(ok.u.email), { ...ok.u, ...(await hashPassword(next)), passwordChangedAt: now, sessionsValidAfter: now });
  cache.clear();
  return publicUser(ok.u);
}

// ── sessions ──────────────────────────────────────────────────────────────────

const cache = new Map<string, { user: User; until: number }>();

export async function createSession(user: User) {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  // Sessions are created a moment after a reset stamps sessionsValidAfter; keep them clear of it.
  await putJSON(sessionKey(token), { userId: user.id, createdAt: now + 1, expiresAt: now + SESSION_DAYS * 86400_000, user } satisfies Session);
  return token;
}

/** The signed-in user for a session token, or null. Cached briefly to spare the store. */
export async function userForToken(token: string | undefined): Promise<User | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const hit = cache.get(token);
  if (hit && hit.until > Date.now()) return hit.user;
  const s = await getJSON<Session>(sessionKey(token)).catch(() => null);
  // The account itself decides too: removed, disabled or signed out everywhere ends the session.
  const u = s && s.expiresAt >= Date.now() ? await getJSON<StoredUser>(userKey(s.user.email)).catch(() => null) : null;
  const created = s?.createdAt ?? (s ? s.expiresAt - SESSION_DAYS * 86400_000 : 0);
  if (!s || !u || u.id !== s.userId || u.disabled || created <= (u.sessionsValidAfter ?? 0)) {
    cache.delete(token);
    return null;
  }
  const user = publicUser(u);
  cache.set(token, { user, until: Date.now() + 60_000 });
  return user;
}

export async function endSession(token: string | undefined) {
  if (!token) return;
  cache.delete(token);
  await objects().remove(sessionKey(token)).catch(() => {});
}

export function readCookie(request: Request, name = SESSION_COOKIE) {
  const raw = request.headers.get("cookie") ?? "";
  for (const part of raw.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return undefined;
}

export const currentUser = (request: Request) => userForToken(readCookie(request));

export function sessionCookie(token: string, request: Request) {
  const secure = new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? "; Secure" : ""}`;
}
export const clearedCookie = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

// ── admin ────────────────────────────────────────────────────────────────────

export async function listUsers(): Promise<IndexEntry[]> {
  const index = await readIndex();
  return index.ids.map((id) => index.users?.[id] ?? { id, email: "", name: "(signs in to fill in)", createdAt: "" });
}

async function storedById(id: string) {
  const e = (await readIndex()).users?.[id];
  const u = e ? await getJSON<StoredUser>(userKey(e.email)) : null;
  if (!u || u.id !== id) throw new AuthError("Account not found.", 404);
  return u;
}
export const userById = async (id: string) => publicUser(await storedById(id));

export async function setDisabled(id: string, disabled: boolean) {
  const u = await storedById(id);
  const next = { ...u, disabled, ...(disabled ? { sessionsValidAfter: Date.now() } : {}) };
  await putJSON(userKey(u.email), next);
  await indexUser(next);
  cache.clear();
}

export async function signOutEverywhere(id: string) {
  const u = await storedById(id);
  await putJSON(userKey(u.email), { ...u, sessionsValidAfter: Date.now() });
  cache.clear();
}

/** Removes the account and its saved studio. Recorded media stays in storage. */
export async function deleteUser(id: string) {
  const u = await storedById(id);
  await objects().remove(userKey(u.email));
  await objects().remove(`state/${u.id}.json`).catch(() => {});
  const index = await readIndex();
  const users = { ...index.users };
  delete users[id];
  await putJSON(INDEX, { ids: index.ids.filter((x) => x !== id), users } satisfies Index);
  cache.clear();
}

// ── invites ──────────────────────────────────────────────────────────────────

export interface Invite {
  /** Hash of the code; the code itself is shown once, when it's made. */
  id: string;
  email?: string;
  note?: string;
  createdAt: string;
  createdBy: string;
  expiresAt: string;
  usedAt?: string;
  usedBy?: string;
  revokedAt?: string;
}
const inviteUsable = (i: Invite) => !i.usedAt && !i.revokedAt && Date.parse(i.expiresAt) > Date.now();
export const readInvites = async () => (await getJSON<{ invites: Invite[] }>(INVITES))?.invites ?? [];

export async function createInvite(by: User, o: { email?: string; note?: string; days?: number }) {
  const email = o.email?.trim() ? normEmail(o.email) : undefined;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError("Enter a valid email address.");
  const code = randomBytes(18).toString("base64url");
  const days = Math.min(Math.max(o.days ?? 14, 1), 90);
  const invite: Invite = { id: h40(code), email, note: o.note?.trim().slice(0, 120) || undefined, createdAt: new Date().toISOString(), createdBy: by.email, expiresAt: new Date(Date.now() + days * 86400_000).toISOString() };
  const invites = await readInvites();
  // Keep the list tidy: drop invites that ended more than 30 days ago.
  const keep = invites.filter((i) => inviteUsable(i) || Date.now() - Date.parse(i.usedAt ?? i.revokedAt ?? i.expiresAt) < 30 * 86400_000);
  await putJSON(INVITES, { invites: [invite, ...keep] });
  return { code, invite };
}

async function updateInvite(id: string, patch: Partial<Invite>) {
  const invites = await readInvites();
  await putJSON(INVITES, { invites: invites.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
}
export const revokeInvite = (id: string) => updateInvite(id, { revokedAt: new Date().toISOString() });

// ── per-user app state ────────────────────────────────────────────────────────

export interface SavedState {
  state: unknown;
  drafts?: unknown;
  updatedAt: string;
}
export const loadState = (userId: string) => getJSON<SavedState>(`state/${userId}.json`);
export const saveState = (userId: string, s: Omit<SavedState, "updatedAt">) => putJSON(`state/${userId}.json`, { ...s, updatedAt: new Date().toISOString() });

// ── brute-force protection ───────────────────────────────────────────────────

const attempts = new Map<string, { n: number; until: number }>();
/** At most 8 tries per key (e.g. email + address) in 15 minutes. */
export function throttle(key: string): boolean {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.until < now) {
    attempts.set(key, { n: 1, until: now + 15 * 60_000 });
    return true;
  }
  a.n++;
  return a.n <= 8;
}
