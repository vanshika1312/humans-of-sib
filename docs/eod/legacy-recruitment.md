# Legacy recruitment module vs Hiring ATS

## Decision

| Artifact | Fate |
|----------|------|
| **`RecruitmentFunnelStage`** (manual counts on `/recruitment`) | **Freeze for operations** — do not use as source of truth for the new EOD app. Optional read-only display on HRMS overview until ATS-backed metrics replace it. |
| **`RecruitmentDailyReport`** (recruiter + location strings only) | **Read-only archive** — historical submissions remain queryable; **no new writes** from the standalone EOD app. New daily reports live in Database 2 (`EodReport`). |
| **Hiring ATS (`Hiring*` + `HiringActivity`)** | **Source of truth** for pipeline state and machine-derived daily metrics. |

## Rationale

- Legacy funnel counts are **manually edited** and **not linked** to `HiringApplication` ([`src/lib/recruitment-funnel.ts`](../../src/lib/recruitment-funnel.ts)).
- `RecruitmentDailyReport` stores **free-text** recruiter/location (no FK to `User` / `City`) and **no activity metrics**.
- Duplicating EOD into HRMS would perpetuate two conflicting numbers; the standalone app consolidates reporting while HRMS stays the ATS.

## HRMS UI (short term)

- Keep `/recruitment` for executives who still use the manual strip.
- Add a banner/link: “Operational recruiting → Hiring”; “EOD reports → [EOD app URL]”.
- **Do not** auto-sync `RecruitmentFunnelStage.count` from ATS in v1 (risk of breaking executive expectations without sign-off).

## Optional phase 2 (HRMS-only)

If leadership wants one dashboard inside HRMS:

- Nightly job: aggregate `HiringApplication` + `HiringActivity` → update `RecruitmentFunnelStage.count` using [`stage-metric-map.ts`](../../src/lib/eod/stage-metric-map.ts).
- Redirect “Submit daily report” to Database 2 or embed EOD app via SSO.

Until then, **EOD app owns submissions**; **ATS owns applicant truth**.
