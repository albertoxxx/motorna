import "server-only";
import sharp, { type Metadata } from "sharp";

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const IMAGE_MAX_COUNT = 20;
export const IMAGE_MIN_COUNT = 3;
export const IMAGE_MIN_WIDTH = 640;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

export type ImageError = "imageType" | "imageSize" | "imageTooSmall";

export type ProcessedImage = {
  full: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
};

/**
 * Validates by decoding (not by trusting the extension or MIME header),
 * auto-rotates, strips all metadata (EXIF/GPS), and re-encodes to WebP.
 */
export async function processListingImage(input: Buffer): Promise<ProcessedImage | { error: ImageError }> {
  if (input.byteLength > IMAGE_MAX_BYTES) return { error: "imageSize" };
  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: 50_000_000 }).metadata();
  } catch {
    return { error: "imageType" };
  }
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) return { error: "imageType" };
  const base = sharp(input, { limitInputPixels: 50_000_000 }).rotate();
  const oriented = await base.clone().toBuffer({ resolveWithObject: true });
  if (oriented.info.width < IMAGE_MIN_WIDTH) return { error: "imageTooSmall" };

  const full = await sharp(oriented.data)
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  const thumb = await sharp(oriented.data)
    .resize({ width: 640, height: 480, fit: "cover", position: "attention" })
    .webp({ quality: 74 })
    .toBuffer();
  return { full: full.data, thumb, width: full.info.width, height: full.info.height };
}

export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Credential documents: a PDF (checked by its signature, stored as-is) or a photo/scan
 * (decoded, metadata stripped, re-encoded to WebP). Anything else is rejected.
 */
export async function processDocument(input: Buffer): Promise<{ data: Buffer; contentType: string; ext: string } | { error: ImageError }> {
  if (input.byteLength > DOCUMENT_MAX_BYTES) return { error: "imageSize" };
  if (input.subarray(0, 5).toString("latin1") === "%PDF-") return { data: input, contentType: "application/pdf", ext: "pdf" };
  try {
    const meta = await sharp(input, { limitInputPixels: 50_000_000 }).metadata();
    if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) return { error: "imageType" };
    const data = await sharp(input, { limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    return { data, contentType: "image/webp", ext: "webp" };
  } catch {
    return { error: "imageType" };
  }
}
