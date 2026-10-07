import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Where everything the platform keeps lives: recorded takes, rendered videos,
 * headshots, thumbnails and job records.
 *
 * - With a bucket configured (Railway Storage Bucket, S3, R2…) objects go there
 *   and survive redeploys.
 * - Without one they go to local disk (.data/), which is fine for local
 *   development but is wiped every time a container is replaced.
 *
 * Bucket env (Railway's bucket "Credentials" presets work as-is):
 *   BUCKET, ENDPOINT, REGION, ACCESS_KEY_ID, SECRET_ACCESS_KEY
 * STORAGE_* / AWS_* spellings are accepted too. STORAGE_PATH_STYLE=1 for
 * path-style buckets.
 */

export interface ObjectInfo {
  size: number;
  contentType: string;
}

export interface ReadResult extends ObjectInfo {
  body: ReadableStream;
  /** Present when a byte range was served. */
  range?: { start: number; end: number };
}

interface Store {
  kind: "bucket" | "disk";
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** Store a file from local disk, streamed (big takes never sit in memory). */
  putFile(key: string, file: string, contentType: string): Promise<void>;
  stat(key: string): Promise<ObjectInfo | null>;
  read(key: string, range?: { start: number; end: number }): Promise<ReadResult | null>;
  remove(key: string): Promise<void>;
  /** A time-limited public https link (bucket only). */
  signedUrl(key: string, expiresSec: number): Promise<string | null>;
}

const env = (...names: string[]) => names.map((n) => process.env[n]?.trim()).find(Boolean);

function bucketConfig() {
  const bucket = env("STORAGE_BUCKET", "BUCKET", "AWS_S3_BUCKET_NAME");
  const endpoint = env("STORAGE_ENDPOINT", "ENDPOINT", "AWS_ENDPOINT_URL_S3", "AWS_ENDPOINT_URL");
  const accessKeyId = env("STORAGE_ACCESS_KEY_ID", "ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID");
  const secretAccessKey = env("STORAGE_SECRET_ACCESS_KEY", "SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY");
  if (!bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    bucket,
    endpoint,
    region: env("STORAGE_REGION", "REGION", "AWS_REGION", "AWS_DEFAULT_REGION") || "auto",
    accessKeyId,
    secretAccessKey,
    pathStyle: /^(1|true|yes)$/i.test(env("STORAGE_PATH_STYLE") ?? ""),
  };
}

/** Keys are built by our code from validated ids; this is a second line of defence. */
const KEY_RE = /^[a-z]+\/[a-z0-9]{6,40}\.[a-z0-9]{2,5}$/;
function checkKey(key: string) {
  if (!KEY_RE.test(key)) throw new Error(`Bad object key: ${key}`);
}

const notFound = (e: unknown) => {
  const err = e as { name?: string; $metadata?: { httpStatusCode?: number }; code?: string };
  return err?.name === "NoSuchKey" || err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404 || err?.code === "ENOENT";
};

function bucketStore(cfg: NonNullable<ReturnType<typeof bucketConfig>>): Store {
  const s3 = new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    forcePathStyle: cfg.pathStyle,
    // No default CRC32 on uploads: for a streamed body it means aws-chunked
    // encoding, which some S3-compatible buckets handle slowly or not at all.
    requestChecksumCalculation: "WHEN_REQUIRED",
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  });
  const Bucket = cfg.bucket;
  return {
    kind: "bucket",
    async put(key, bytes, contentType) {
      checkKey(key);
      await s3.send(new PutObjectCommand({ Bucket, Key: key, Body: bytes, ContentType: contentType, ContentLength: bytes.byteLength }));
    },
    async putFile(key, file, contentType) {
      checkKey(key);
      // One streamed PUT: fine up to S3's 5 GB single-object limit, well above our upload cap.
      const { size } = await fs.stat(file);
      await s3.send(new PutObjectCommand({ Bucket, Key: key, Body: createReadStream(file), ContentType: contentType, ContentLength: size }));
    },
    async stat(key) {
      checkKey(key);
      try {
        const h = await s3.send(new HeadObjectCommand({ Bucket, Key: key }));
        return { size: Number(h.ContentLength ?? 0), contentType: h.ContentType || "application/octet-stream" };
      } catch (e) {
        if (notFound(e)) return null;
        throw e;
      }
    },
    async read(key, range) {
      checkKey(key);
      try {
        const o = await s3.send(new GetObjectCommand({ Bucket, Key: key, Range: range ? `bytes=${range.start}-${range.end}` : undefined }));
        if (!o.Body) return null;
        const total = range ? Number(/\/(\d+)$/.exec(o.ContentRange ?? "")?.[1] ?? 0) : Number(o.ContentLength ?? 0);
        return {
          body: o.Body.transformToWebStream() as ReadableStream,
          size: total,
          contentType: o.ContentType || "application/octet-stream",
          range,
        };
      } catch (e) {
        if (notFound(e)) return null;
        throw e;
      }
    },
    async remove(key) {
      checkKey(key);
      await s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
    },
    async signedUrl(key, expiresSec) {
      checkKey(key);
      return getSignedUrl(s3, new GetObjectCommand({ Bucket, Key: key }), { expiresIn: Math.min(expiresSec, 7 * 24 * 3600) });
    },
  };
}

function diskStore(): Store {
  const root = path.resolve(process.env.VIDEO_DATA_DIR || ".data");
  const file = (key: string) => (checkKey(key), path.join(root, key));
  const typeFile = (key: string) => file(key) + ".type";
  return {
    kind: "disk",
    async put(key, bytes, contentType) {
      const f = file(key);
      await fs.mkdir(path.dirname(f), { recursive: true });
      await fs.writeFile(f, bytes);
      await fs.writeFile(typeFile(key), contentType);
    },
    async putFile(key, src, contentType) {
      const f = file(key);
      await fs.mkdir(path.dirname(f), { recursive: true });
      await fs.copyFile(src, f);
      await fs.writeFile(typeFile(key), contentType);
    },
    async stat(key) {
      try {
        const [st, type] = await Promise.all([fs.stat(file(key)), fs.readFile(typeFile(key), "utf8").catch(() => "application/octet-stream")]);
        return { size: st.size, contentType: type };
      } catch (e) {
        if (notFound(e)) return null;
        throw e;
      }
    },
    async read(key, range) {
      const info = await this.stat(key);
      if (!info) return null;
      const body = Readable.toWeb(createReadStream(file(key), range)) as ReadableStream;
      return { ...info, body, range };
    },
    async remove(key) {
      await fs.rm(file(key), { force: true });
      await fs.rm(typeFile(key), { force: true });
    },
    async signedUrl() {
      return null;
    },
  };
}

let store: Store | undefined;
export function objects(): Store {
  if (!store) {
    const cfg = bucketConfig();
    store = cfg ? bucketStore(cfg) : diskStore();
    if (!cfg && process.env.NODE_ENV === "production") {
      console.warn("[storage] No bucket configured — files are on local disk and will be lost on redeploy. Set BUCKET, ENDPOINT, ACCESS_KEY_ID, SECRET_ACCESS_KEY.");
    }
  }
  return store;
}

export async function putJSON(key: string, value: unknown) {
  await objects().put(key, new TextEncoder().encode(JSON.stringify(value, null, 2)), "application/json");
}

export async function getJSON<T>(key: string): Promise<T | null> {
  const r = await objects().read(key);
  if (!r) return null;
  try {
    return JSON.parse(await new Response(r.body).text()) as T;
  } catch {
    return null;
  }
}

/** Stream an object to a file on local disk. False if it doesn't exist. */
export async function downloadTo(key: string, file: string): Promise<boolean> {
  const r = await objects().read(key);
  if (!r) return false;
  await pipeline(Readable.fromWeb(r.body as import("node:stream/web").ReadableStream), createWriteStream(file));
  return true;
}

/**
 * Serve an object as an HTTP response, honouring Range so video can seek.
 * Always streams through the app (same origin), so canvases can read frames.
 */
export async function serveObject(request: Request, key: string, cache = "private, max-age=3600", extra: Record<string, string> = {}): Promise<Response> {
  const info = await objects().stat(key);
  if (!info) return Response.json({ error: "Not found" }, { status: 404 });
  const headers: Record<string, string> = { "Content-Type": info.contentType, "Accept-Ranges": "bytes", "Cache-Control": cache, ...extra };
  const m = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (m && (m[1] || m[2]) && info.size > 0) {
    let start = m[1] ? Number(m[1]) : info.size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : info.size - 1;
    start = Math.max(0, start);
    end = Math.min(info.size - 1, end);
    if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
    const r = await objects().read(key, { start, end });
    if (!r) return Response.json({ error: "Not found" }, { status: 404 });
    return new Response(r.body, { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${info.size}`, "Content-Length": String(end - start + 1) } });
  }
  const r = await objects().read(key);
  if (!r) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(r.body, { headers: { ...headers, "Content-Length": String(info.size) } });
}
