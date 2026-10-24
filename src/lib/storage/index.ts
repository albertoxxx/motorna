import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export interface StorageDriver {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}

const SAFE_KEY = /^[a-z0-9][a-z0-9/_\-.]{0,200}$/i;

export function assertSafeKey(key: string) {
  if (!SAFE_KEY.test(key) || key.includes("..")) throw new Error("Invalid storage key");
}

class LocalDriver implements StorageDriver {
  constructor(private root: string) {}
  private resolve(key: string) {
    assertSafeKey(key);
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Invalid storage key");
    return full;
  }
  async put(key: string, data: Buffer) {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  }
  async get(key: string) {
    try {
      return await fs.readFile(this.resolve(key));
    } catch {
      return null;
    }
  }
  async delete(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }
  publicUrl(key: string) {
    return `/media/${key}`;
  }
}

/**
 * S3-compatible driver (Supabase Storage, Cloudflare R2, AWS S3).
 * Objects are served from a public bucket via S3_PUBLIC_BASE_URL.
 */
class S3Driver implements StorageDriver {
  private client: S3Client;
  constructor(
    private bucket: string,
    private publicBase: string,
    opts: { endpoint?: string; region: string; accessKeyId: string; secretAccessKey: string },
  ) {
    this.client = new S3Client({
      endpoint: opts.endpoint,
      region: opts.region,
      forcePathStyle: true,
      credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
    });
  }
  async put(key: string, data: Buffer, contentType: string) {
    assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  }
  async get(key: string) {
    assertSafeKey(key);
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return res.Body ? Buffer.from(await res.Body.transformToByteArray()) : null;
    } catch {
      return null;
    }
  }
  async delete(key: string) {
    assertSafeKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
  publicUrl(key: string) {
    return `${this.publicBase}/${key}`;
  }
}

function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required when STORAGE_DRIVER=s3`);
  return v;
}

let driver: StorageDriver | null = null;

export function storage(): StorageDriver {
  if (driver) return driver;
  const kind = process.env.STORAGE_DRIVER ?? "local";
  if (kind === "local") {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_STORAGE_IN_PROD !== "1") {
      throw new Error("Local storage is for development only. Configure STORAGE_DRIVER=s3 for production.");
    }
    driver = new LocalDriver(path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_LOCAL_DIR ?? "./storage/uploads"));
  } else if (kind === "s3") {
    driver = new S3Driver(required("S3_BUCKET"), required("S3_PUBLIC_BASE_URL").replace(/\/$/, ""), {
      endpoint: process.env.S3_ENDPOINT || undefined,
      region: process.env.S3_REGION || "auto",
      accessKeyId: required("S3_ACCESS_KEY_ID"),
      secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
    });
  } else {
    throw new Error(`Unknown STORAGE_DRIVER "${kind}". Use "local" or "s3".`);
  }
  return driver;
}
