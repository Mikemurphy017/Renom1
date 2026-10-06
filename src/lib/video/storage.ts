import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

/**
 * Server-only local disk storage for uploaded takes and job records.
 * Lives in .data/ (git-ignored). Fine for one server; swap for object storage
 * (S3, R2, GCS) before running more than one instance.
 */
const ROOT = path.resolve(process.env.VIDEO_DATA_DIR || ".data");
const UPLOADS = path.join(ROOT, "uploads");
const JOBS = path.join(ROOT, "jobs");

/** Ids are generated here and validated on every way in, so they can't escape the folder. */
const ID_RE = /^[a-z0-9]{6,40}$/;
export const isStorageId = (id: unknown): id is string => typeof id === "string" && ID_RE.test(id);
export const newId = (prefix: string) => `${prefix}${randomBytes(9).toString("hex")}`;

export interface StoredUpload {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  durationSec: number;
  createdAt: string;
  /** The video in the app this take belongs to. */
  videoId?: string;
  /** Provider-side id once it has been sent on (e.g. Mirage). */
  remoteId?: string;
}

const extFor = (mime: string) => (mime.includes("mp4") ? "mp4" : mime.includes("quicktime") ? "mov" : "webm");

export async function saveUpload(meta: Omit<StoredUpload, "id" | "createdAt">, bytes: Uint8Array): Promise<StoredUpload> {
  await fs.mkdir(UPLOADS, { recursive: true });
  const rec: StoredUpload = { ...meta, id: newId("up"), createdAt: new Date().toISOString() };
  await fs.writeFile(path.join(UPLOADS, `${rec.id}.${extFor(rec.mimeType)}`), bytes);
  await fs.writeFile(path.join(UPLOADS, `${rec.id}.json`), JSON.stringify(rec, null, 2));
  return rec;
}

export async function getUpload(id: string): Promise<StoredUpload | null> {
  if (!isStorageId(id)) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(UPLOADS, `${id}.json`), "utf8")) as StoredUpload;
  } catch {
    return null;
  }
}

export async function updateUpload(id: string, patch: Partial<StoredUpload>) {
  const rec = await getUpload(id);
  if (!rec) throw new Error("Upload not found");
  const next = { ...rec, ...patch, id: rec.id };
  await fs.writeFile(path.join(UPLOADS, `${id}.json`), JSON.stringify(next, null, 2));
  return next;
}

export function uploadFilePath(rec: StoredUpload) {
  return path.join(UPLOADS, `${rec.id}.${extFor(rec.mimeType)}`);
}

export async function saveJob<T extends { id: string }>(job: T) {
  await fs.mkdir(JOBS, { recursive: true });
  await fs.writeFile(path.join(JOBS, `${job.id}.json`), JSON.stringify(job, null, 2));
}

export async function getJob<T>(id: string): Promise<T | null> {
  if (!isStorageId(id)) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(JOBS, `${id}.json`), "utf8")) as T;
  } catch {
    return null;
  }
}
