# Integration: HRMS (Database 1) → EOD app (Database 2)

## Decision (ADR)

**Primary:** Authenticated **read API** on HRMS (`GET /api/integrations/eod/snapshot`) called on a schedule (e.g. every 15–60 minutes) and on-demand when a recruiter opens the EOD app.

**Secondary (optional at scale):** Read-replica **ETL** into Database 2 for heavy analytics; not required for v1.

**Not chosen for v1:**

| Approach | Why not v1 |
|----------|------------|
| Direct write access from EOD app to HRMS Postgres | Violates read-only boundary; couples write schemas |
| Shared Prisma client / monolith | Standalone app is a separate deployable |
| Session-cookie scraping of `/hiring/*` | Fragile, not machine-to-machine |
| Real-time webhooks on every `HiringActivity` | Higher ops cost; add later if needed |

## API contract

**Endpoint:** `GET /api/integrations/eod/snapshot`

**Auth:** `Authorization: Bearer ${EOD_INTEGRATION_SECRET}`  
If `EOD_INTEGRATION_SECRET` is unset, the route returns `503` (integration disabled).

**Query parameters:**

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `date` | No | Today in `timezone` | Calendar date `YYYY-MM-DD` for activity rollups |
| `timezone` | No | `Asia/Kolkata` | IANA TZ for start/end of report day |

**Response (summary):**

- `pipelineStages` — full stage config (`key`, `label`, `isHired`, `isRejected`, …)
- `stageMetricMap` — configured `key` → EOD bucket (see [stage-metric-map.md](./stage-metric-map.md))
- `currentPipelineCounts` — live `HiringApplication` counts by stage
- `activitySummary` — events on `date` (`byKind`, `stageTransitionsTo`, `byRecruiter`)
- `hrRoster`, `departments`, `cities` — reference data for forms

## EOD app sync pattern

1. **Reference sync** (infrequent): stages, departments, cities, HR roster — refresh when HRMS admin changes pipeline.
2. **Daily snapshot pull** (frequent): for each `date`, `GET …/snapshot?date=…` → upsert into Database 2 `HrmsDailySnapshot` (see [database-2-schema.prisma](./database-2-schema.prisma)).
3. **Human EOD submit** writes only to Database 2 (`EodReport`, `Interview`, …); never to HRMS.

## Security

- Use a long random `EOD_INTEGRATION_SECRET`; rotate via env on both sides.
- Restrict route to server-side callers (EOD backend / cron), never expose the secret in the browser.
- Snapshot responses include candidate PII only indirectly via activity summaries; prefer storing snapshot JSON in DB2 over re-fetching full candidate rows unless needed.

## Environment

HRMS (`.env`):

```bash
EOD_INTEGRATION_SECRET="generate-a-long-random-string"
```

EOD app:

```bash
HRMS_BASE_URL="https://humans-of-sib.example.com"
EOD_INTEGRATION_SECRET="same-as-hrms"
```

## Future: read replica ETL

If snapshot latency or HRMS load becomes an issue:

- Grant EOD app a **read-only** Postgres role on a replica.
- Nightly job: `INSERT INTO hrms_daily_snapshot … SELECT …` from SQL aggregations mirroring [`src/lib/eod/snapshot.ts`](../../src/lib/eod/snapshot.ts).
- Keep the HTTP snapshot as a backfill / reconciliation tool.
