import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

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

class NotConfiguredDriver implements StorageDriver {
  constructor(private name: string) {}
  private fail(): never {
    throw new Error(
      `Storage driver "${this.name}" is not implemented yet. Use STORAGE_DRIVER=local in development; see docs/SETUP.md for the S3/Supabase Storage step.`,
    );
  }
  put(): Promise<void> {
    this.fail();
  }
  get(): Promise<Buffer | null> {
    this.fail();
  }
  delete(): Promise<void> {
    this.fail();
  }
  publicUrl(): string {
    this.fail();
  }
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
  } else {
    driver = new NotConfiguredDriver(kind);
  }
  return driver;
}
