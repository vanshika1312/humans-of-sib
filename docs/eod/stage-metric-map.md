# Pipeline stage → EOD metric buckets

HRMS stores configurable stages in `HiringPipelineStage` (`key`, `label`, `isHired`, `isRejected`). The standalone EOD app rolls activity into **buckets** aligned with the legacy recruitment strip:

`applied` · `screening` · `round1` · `round2` · `final` · `offers` · `joined` · `rejected` · `dnp` · `other`

## Resolution order

Implemented in [`src/lib/eod/stage-metric-map.ts`](../../src/lib/eod/stage-metric-map.ts):

1. **Exact match** on `STAGE_KEY_TO_EOD_BUCKET` (e.g. `APPLIED` → `applied`, `PHONE_SCREEN` → `screening`)
2. **Substring rules** (e.g. key contains `ROUND_2` → `round2`)
3. **Stage flags:** `isHired` → `joined`, `isRejected` → `rejected`
4. Fallback → `other`

## Default key mapping (excerpt)

| `HiringPipelineStage.key` | EOD bucket |
|---------------------------|------------|
| `APPLIED`, `NEW` | `applied` |
| `SCREENING`, `PHONE_SCREEN`, `HR_SCREEN` | `screening` |
| `ROUND_1`, `R1`, `INTERVIEW_1` | `round1` |
| `ROUND_2`, `R2`, `INTERVIEW_2` | `round2` |
| `FINAL`, `BAR_RAISER` | `final` |
| `OFFER`, `NEGOTIATION` | `offers` |
| `HIRED`, `JOINED` | `joined` |
| `REJECTED`, `NOT_SELECTED` | `rejected` |
| `DNP`, `NO_SHOW` | `dnp` |

Custom stages created in **Hiring → Pipeline stages** should use keys that match this table, or they land in `other` until you extend the map.

## Using in rollups

- **Snapshot counts (current state):** group `HiringApplication` by stage, map each stage’s `key` → bucket, sum counts.
- **Daily activity:** on `APPLICATION_STAGE_CHANGED`, read `payloadJson.toStageKey` and increment that bucket for `actorUserId` on the report date.

## Database 2 override (optional)

`EodStageMetricOverride` in [database-2-schema.prisma](./database-2-schema.prisma) lets the EOD app store per-`stageId` bucket overrides without changing HRMS.
