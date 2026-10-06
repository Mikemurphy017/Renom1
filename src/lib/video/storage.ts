import { randomBytes } from "node:crypto";
import { getJSON, objects, putJSON, readBytes } from "@/lib/storage/objects";

/**
 * Uploaded takes and job records, kept in the platform object store
 * (the storage bucket in production, .data/ locally). See src/lib/storage.
 */

/** Ids are generated here and validated on every way in, so they can't escape their prefix. */
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
const metaKey = (id: string) => `uploads/${id}.json`;
export const uploadKey = (rec: StoredUpload) => `uploads/${rec.id}.${extFor(rec.mimeType)}`;

export async function saveUpload(meta: Omit<StoredUpload, "id" | "createdAt">, bytes: Uint8Array): Promise<StoredUpload> {
  const rec: StoredUpload = { ...meta, id: newId("up"), createdAt: new Date().toISOString() };
  await objects().put(uploadKey(rec), bytes, rec.mimeType);
  await putJSON(metaKey(rec.id), rec);
  return rec;
}

export async function getUpload(id: string): Promise<StoredUpload | null> {
  if (!isStorageId(id)) return null;
  return getJSON<StoredUpload>(metaKey(id));
}

export async function updateUpload(id: string, patch: Partial<StoredUpload>) {
  const rec = await getUpload(id);
  if (!rec) throw new Error("Upload not found");
  const next = { ...rec, ...patch, id: rec.id };
  await putJSON(metaKey(id), next);
  return next;
}

export async function uploadBytes(rec: StoredUpload) {
  const bytes = await readBytes(uploadKey(rec));
  if (!bytes) throw new Error("Upload file is missing");
  return bytes;
}

export async function saveJob<T extends { id: string }>(job: T) {
  await putJSON(`jobs/${job.id}.json`, job);
}

export async function getJob<T>(id: string): Promise<T | null> {
  if (!isStorageId(id)) return null;
  return getJSON<T>(`jobs/${id}.json`);
}
