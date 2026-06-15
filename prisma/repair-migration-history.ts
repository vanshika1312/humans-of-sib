/**
 * One-time repair for shared Supabase when `_prisma_migrations` drifted from `prisma/migrations/`.
 *
 * - Syncs checksums for migrations that exist both locally and in the DB
 * - Removes failed duplicate rows (finished_at IS NULL) left over from rolled-back migrate dev runs
 *
 * Run: `pnpm db:migrate:repair`
 * Safe to re-run (idempotent).
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/lib/prisma";

function migrationChecksum(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

async function main() {
  const migrationsDir = join(process.cwd(), "prisma/migrations");
  const dirs = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  let checksumsUpdated = 0;
  for (const dir of dirs) {
    const sqlPath = join(migrationsDir, dir, "migration.sql");
    const sql = readFileSync(sqlPath, "utf8");
    const checksum = migrationChecksum(sql);
    const updated = await prisma.$executeRaw`
      UPDATE "_prisma_migrations"
      SET "checksum" = ${checksum}
      WHERE "migration_name" = ${dir}
        AND "checksum" <> ${checksum}
    `;
    checksumsUpdated += Number(updated);
  }

  const duplicatesRemoved = await prisma.$executeRaw`
    DELETE FROM "_prisma_migrations"
    WHERE "finished_at" IS NULL
  `;

  console.log({
    localMigrations: dirs.length,
    checksumsUpdated,
    duplicateRowsRemoved: Number(duplicatesRemoved),
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
