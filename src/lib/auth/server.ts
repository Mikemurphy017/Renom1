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
 * accounts need INVITE_CODE (when set); without one, sign-ups are closed.
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
}
interface Session {
  userId: string;
  expiresAt: number;
}

const h40 = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 40);
export const normEmail = (e: string) => e.trim().toLowerCase();
const userKey = (email: string) => `users/${h40(normEmail(email))}.json`;
const sessionKey = (token: string) => `sessions/${h40(token)}.json`;
const INDEX = "meta/userindex.json";

async function hashPassword(password: string, salt = randomBytes(16)) {
  const hash = await scrypt(password.normalize("NFKC"), salt, 64);
  return { salt: salt.toString("hex"), hash: hash.toString("hex") };
}

export async function userCount() {
  return (await getJSON<{ ids: string[] }>(INDEX))?.ids.length ?? 0;
}

export async function signupPolicy(): Promise<{ open: boolean; needsCode: boolean }> {
  if ((await userCount()) === 0) return { open: true, needsCode: false };
  return process.env.INVITE_CODE?.trim() ? { open: true, needsCode: true } : { open: false, needsCode: false };
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
  if (!policy.open) throw new AuthError("New accounts are by invitation. Ask your administrator for an invite code.", 403);
  if (policy.needsCode) {
    const code = process.env.INVITE_CODE!.trim();
    const given = (input.invite ?? "").trim();
    if (given.length !== code.length || !timingSafeEqual(Buffer.from(given), Buffer.from(code))) throw new AuthError("That invite code isn’t right.", 403);
  }
  if (await objects().stat(userKey(email))) throw new AuthError("An account with that email already exists. Sign in instead.", 409);

  const user: StoredUser = { id: `u${randomBytes(9).toString("hex")}`, email, name, createdAt: new Date().toISOString(), ...(await hashPassword(input.password)) };
  await putJSON(userKey(email), user);
  const index = (await getJSON<{ ids: string[] }>(INDEX)) ?? { ids: [] };
  await putJSON(INDEX, { ids: [...index.ids, user.id] });
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
  return a.length === b.length && timingSafeEqual(a, b) ? publicUser(u) : null;
}

export async function changePassword(user: User, current: string, next: string) {
  if (!(await verifyPassword(user.email, current))) throw new AuthError("Your current password isn’t right.", 403);
  if (next.length < 10) throw new AuthError("Use at least 10 characters for your new password.");
  const u = await getJSON<StoredUser>(userKey(user.email));
  if (!u) throw new AuthError("Account not found.", 404);
  await putJSON(userKey(user.email), { ...u, ...(await hashPassword(next)) });
}

// ── sessions ──────────────────────────────────────────────────────────────────

const cache = new Map<string, { user: User; until: number }>();

export async function createSession(user: User) {
  const token = randomBytes(32).toString("base64url");
  await putJSON(sessionKey(token), { userId: user.id, expiresAt: Date.now() + SESSION_DAYS * 86400_000, user } satisfies Session & { user: User });
  return token;
}

/** The signed-in user for a session token, or null. Cached briefly to spare the store. */
export async function userForToken(token: string | undefined): Promise<User | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const hit = cache.get(token);
  if (hit && hit.until > Date.now()) return hit.user;
  const s = await getJSON<Session & { user: User }>(sessionKey(token)).catch(() => null);
  if (!s || s.expiresAt < Date.now()) {
    cache.delete(token);
    return null;
  }
  cache.set(token, { user: s.user, until: Date.now() + 60_000 });
  return s.user;
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
/** At most 8 tries per email + address in 15 minutes. */
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
