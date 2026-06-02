# HR EOD Reporting — Architecture (HRMS + standalone app)

This folder records decisions and schemas for the **standalone HR EOD Reporting & Interview Tracker** (Database 2) and its **read-only** integration with Humans of SIB (Database 1 / HRMS).

| Document | Purpose |
|----------|---------|
| [integration.md](./integration.md) | How Database 2 reads from HRMS (API vs replica) |
| [stage-metric-map.md](./stage-metric-map.md) | `HiringPipelineStage.key` → EOD funnel buckets |
| [legacy-recruitment.md](./legacy-recruitment.md) | Fate of `RecruitmentFunnelStage` / `RecruitmentDailyReport` |
| [database-2-schema.prisma](./database-2-schema.prisma) | Prisma design for the standalone app database |

## HRMS implementation

- **Stage → metric mapping:** [`src/lib/eod/stage-metric-map.ts`](../../src/lib/eod/stage-metric-map.ts)
- **Daily snapshot builder:** [`src/lib/eod/snapshot.ts`](../../src/lib/eod/snapshot.ts)
- **Integration API:** `GET /api/integrations/eod/snapshot?date=YYYY-MM-DD`

Set `EOD_INTEGRATION_SECRET` in HRMS and send `Authorization: Bearer <secret>` from the EOD app (or cron).
