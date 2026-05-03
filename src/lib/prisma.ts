import { Prisma, PrismaClient } from "@/generated/prisma";

declare global {
  // eslint-disable-next-line no-var
  var _prisma: PrismaClient | undefined;
  /** Invalidates cached client after `prisma generate` changes models or fields (e.g. new columns). */
  // eslint-disable-next-line no-var
  var _prismaSchemaFingerprint: string | undefined;
}

function makePrisma() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
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
