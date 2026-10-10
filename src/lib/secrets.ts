import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

/**
 * Server-side secret for encrypting stored credentials (advisors' Buffer keys)
 * and signing public file links. Set SECRETS_KEY (any long random string) in
 * production; changing it means advisors reconnect Buffer.
 */
const raw = () => process.env.SECRETS_KEY?.trim() || (process.env.NODE_ENV === "production" ? "" : "renom-dev-only-secret");
export const secretsConfigured = () => !!raw();

const keyFor = (purpose: string) => {
  if (!raw()) throw new Error("SECRETS_KEY is not set");
  return createHash("sha256").update(`${purpose}:${raw()}`).digest();
};

/** AES-256-GCM; the result is iv.tag.ciphertext in base64url. */
export function seal(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keyFor("seal"), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

export function unseal(sealed: string): string | null {
  try {
    const [iv, tag, body] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
    const d = createDecipheriv("aes-256-gcm", keyFor("seal"), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(body), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export const sign = (purpose: string, data: string) => createHmac("sha256", keyFor(purpose)).update(data).digest("hex");
