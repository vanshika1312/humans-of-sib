import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

function trimEnv(s: string | undefined): string | undefined {
  const t = s?.trim();
  return t || undefined;
}

/** Normalized public URL base (no trailing slash). Undefined if unset. */
export function r2PublicBaseUrlNormalized(): string | undefined {
  const b = trimEnv(process.env.R2_PUBLIC_BASE_URL);
  if (!b) return undefined;
  return b.replace(/\/+$/, "");
}

export function r2ConfigComplete(): boolean {
  return !!(
    trimEnv(process.env.R2_ACCOUNT_ID) &&
    trimEnv(process.env.R2_BUCKET_NAME) &&
    trimEnv(process.env.R2_ACCESS_KEY_ID) &&
    trimEnv(process.env.R2_SECRET_ACCESS_KEY) &&
    r2PublicBaseUrlNormalized()
  );
}

export function isR2StoredResumeUrl(url: string): boolean {
  const base = r2PublicBaseUrlNormalized();
  if (!base) return false;
  const u = url.trim();
  return u.startsWith(`${base}/`);
}

function r2S3Client(): S3Client {
  const accountId = trimEnv(process.env.R2_ACCOUNT_ID)!;
  const endpoint =
    trimEnv(process.env.R2_ENDPOINT) ?? `https://${accountId}.r2.cloudflarestorage.com`;
  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: trimEnv(process.env.R2_ACCESS_KEY_ID)!,
      secretAccessKey: trimEnv(process.env.R2_SECRET_ACCESS_KEY)!,
    },
  });
}

export async function persistBufferToR2(buf: Buffer, ext: string, contentType: string): Promise<string> {
  const bucket = trimEnv(process.env.R2_BUCKET_NAME)!;
  const key = `hiring-uploads/${randomUUID()}${ext}`;
  const client = r2S3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buf,
      ContentType: contentType,
    }),
  );
  const base = r2PublicBaseUrlNormalized()!;
  return `${base}/${key}`;
}
