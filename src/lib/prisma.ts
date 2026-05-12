import { Prisma, PrismaClient } from "@/generated/prisma";

declare global {
  // eslint-disable-next-line no-var
  var _prisma: PrismaClient | undefined;
  /** Invalidates cached client after `prisma generate` changes models or fields (e.g. new columns). */
  // eslint-disable-next-line no-var
  var _prismaSchemaFingerprint: string | undefined;
}

/**
 * Tune Prisma Postgres URL for pooled / serverless (Vercel + Supabase PgBouncer, Neon pooler, etc.).
 * - Higher `pool_timeout` avoids premature P2024 when one connection slot is briefly busy.
 * - With transaction poolers, `connection_limit=1` is too small for parallel RSC streams (Suspense siblings);
 *   allow a small pool per Lambda when the hostname/port indicates pooled access.
 */
function databaseUrlPoolTune(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const u = new URL(url);
    const isPooled =
      u.port === "6543" || /pooler/i.test(u.hostname) || u.searchParams.get("pgbouncer") === "true";

    if (!u.searchParams.has("pool_timeout")) {
      u.searchParams.set("pool_timeout", process.env.NODE_ENV === "development" ? "30" : "60");
    }

    if (isPooled && u.searchParams.get("connection_limit") === "1") {
      u.searchParams.set("connection_limit", "5");
    }

    return u.toString();
  } catch {
    return url;
  }
}

function makePrisma() {
  const url = databaseUrlPoolTune(process.env.DATABASE_URL) ?? process.env.DATABASE_URL;
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources:
      url && url !== process.env.DATABASE_URL
        ? {
            db: { url },
          }
        : undefined,
  });
}

/** Stable hash of all model fields so we drop a stale singleton when the generated client shape changes. */
function prismaDatamodelFingerprint(): string {
  try {
    const models = Prisma.dmmf.datamodel.models;
    return models
      .map((m) => `${m.name}:${m.fields.map((f) => f.name).sort().join(",")}`)
      .sort()
      .join("|");
  } catch {
    return "";
  }
}

const PRISMA_SCHEMA_FINGERPRINT = prismaDatamodelFingerprint();

/**
 * Reuse one client per runtime, but replace it after `prisma generate` changes anything in the schema.
 * A stale singleton either misses delegates (e.g. `leaveBalance`) or rejects new `create` fields
 * (`PrismaClientValidationError`: unknown argument) until dev server restart.
 */
function getPrisma(): PrismaClient {
  const cached = global._prisma;
  const fingerprintOk = global._prismaSchemaFingerprint === PRISMA_SCHEMA_FINGERPRINT;
  const hasLeaveBalanceDelegate = cached && "leaveBalance" in (cached as object);
  const fresh = cached && fingerprintOk && hasLeaveBalanceDelegate;

  if (fresh) return cached;

  if (cached) {
    void cached.$disconnect().catch(() => {});
    global._prisma = undefined;
    global._prismaSchemaFingerprint = undefined;
  }

  const client = makePrisma();
  global._prisma = client;
  global._prismaSchemaFingerprint = PRISMA_SCHEMA_FINGERPRINT;
  return client;
}

export const prisma = getPrisma();
