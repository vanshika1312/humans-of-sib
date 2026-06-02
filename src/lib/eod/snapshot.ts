import type { HiringActivityKind } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
  eodBucketForStageKey,
  getStageMetricMapForApi,
  type EodMetricBucket,
} from "@/lib/eod/stage-metric-map";
import { hiringOpenJobsWhere } from "@/lib/hiring-job-active";
import { zonedDayBounds } from "@/lib/eod/zoned-day";

const HR_ROLES = ["CEO", "ADMIN", "HR"] as const;

const EOD_ACTIVITY_KINDS: HiringActivityKind[] = [
  "APPLICATION_CREATED",
  "APPLICATION_STAGE_CHANGED",
  "APPLICATION_DELETED",
  "CANDIDATE_CREATED",
  "CANDIDATE_UPDATED",
  "APPLICATION_REVIEW_ADDED",
  "APPLICATION_REVIEW_UPDATED",
  "APPLICATION_REVIEW_DELETED",
  "APPLICATION_EMAIL_SENT",
];

type StageTransitionPayload = {
  toStageKey?: string;
  fromStageKey?: string;
};

export type EodSnapshot = {
  reportDate: string;
  timezone: string;
  generatedAt: string;
  stageMetricMap: Record<string, EodMetricBucket>;
  pipelineStages: {
    id: string;
    key: string;
    label: string;
    sortOrder: number;
    isHired: boolean;
    isRejected: boolean;
    eodBucket: EodMetricBucket;
  }[];
  currentPipelineCounts: {
    byStageId: Record<string, number>;
    byStageKey: Record<string, number>;
    byEodBucket: Record<EodMetricBucket, number>;
    totalApplications: number;
  };
  activitySummary: {
    totalEvents: number;
    byKind: Partial<Record<HiringActivityKind, number>>;
    stageTransitionsTo: Partial<Record<EodMetricBucket, number>>;
    byRecruiter: {
      userId: string;
      email: string;
      name: string | null;
      eventCount: number;
      stageTransitionsTo: Partial<Record<EodMetricBucket, number>>;
    }[];
  };
  hrRoster: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    cityId: string | null;
    departmentId: string | null;
  }[];
  departments: { id: string; name: string; slug: string; emoji: string | null }[];
  cities: { id: string; name: string; slug: string; isHQ: boolean }[];
  openJobs: {
    id: string;
    title: string;
    departmentName: string | null;
    departmentEmoji: string | null;
  }[];
};

function emptyBucketCounts(): Record<EodMetricBucket, number> {
  return {
    applied: 0,
    screening: 0,
    round1: 0,
    round2: 0,
    final: 0,
    offers: 0,
    joined: 0,
    rejected: 0,
    dnp: 0,
    other: 0,
  };
}

export async function buildEodSnapshot(args: {
  reportDate: string;
  timezone: string;
}): Promise<EodSnapshot> {
  const { reportDate, timezone } = args;
  const { startInclusive, endExclusive } = zonedDayBounds(reportDate, timezone);

  const [stages, applicationGroups, activities, hrRoster, departments, cities, openJobs] =
    await Promise.all([
    prisma.hiringPipelineStage.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.hiringApplication.groupBy({
      by: ["pipelineStageId"],
      _count: { _all: true },
    }),
    prisma.hiringActivity.findMany({
      where: {
        createdAt: { gte: startInclusive, lt: endExclusive },
        kind: { in: EOD_ACTIVITY_KINDS },
      },
      select: {
        kind: true,
        actorUserId: true,
        payloadJson: true,
        actor: {
          select: { id: true, email: true, name: true },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: { in: [...HR_ROLES] }, status: "ACTIVE" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        cityId: true,
        departmentId: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.department.findMany({
      select: { id: true, name: true, slug: true, emoji: true },
      orderBy: { name: "asc" },
    }),
    prisma.city.findMany({
      select: { id: true, name: true, slug: true, isHQ: true },
      orderBy: { name: "asc" },
    }),
    prisma.hiringJob.findMany({
      where: hiringOpenJobsWhere(),
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        department: { select: { name: true, emoji: true } },
      },
    }),
  ]);

  const stageById = new Map(stages.map((s) => [s.id, s]));

  const pipelineStages = stages.map((s) => ({
    id: s.id,
    key: s.key,
    label: s.label,
    sortOrder: s.sortOrder,
    isHired: s.isHired,
    isRejected: s.isRejected,
    eodBucket: eodBucketForStageKey(s.key, {
      isHired: s.isHired,
      isRejected: s.isRejected,
    }),
  }));

  const byStageId: Record<string, number> = {};
  const byStageKey: Record<string, number> = {};
  const byEodBucket = emptyBucketCounts();
  let totalApplications = 0;

  for (const row of applicationGroups) {
    const count = row._count._all;
    const stage = stageById.get(row.pipelineStageId);
    if (!stage) continue;
    byStageId[stage.id] = count;
    byStageKey[stage.key] = (byStageKey[stage.key] ?? 0) + count;
    const bucket = eodBucketForStageKey(stage.key, {
      isHired: stage.isHired,
      isRejected: stage.isRejected,
    });
    byEodBucket[bucket] += count;
    totalApplications += count;
  }

  const byKind: Partial<Record<HiringActivityKind, number>> = {};
  const stageTransitionsTo = emptyBucketCounts();
  const recruiterMap = new Map<
    string,
    {
      userId: string;
      email: string;
      name: string | null;
      eventCount: number;
      stageTransitionsTo: Record<EodMetricBucket, number>;
    }
  >();

  for (const act of activities) {
    byKind[act.kind] = (byKind[act.kind] ?? 0) + 1;

    const recruiterId = act.actorUserId ?? "unknown";
    let rec = recruiterMap.get(recruiterId);
    if (!rec) {
      rec = {
        userId: recruiterId,
        email: act.actor?.email ?? "",
        name: act.actor?.name ?? null,
        eventCount: 0,
        stageTransitionsTo: emptyBucketCounts(),
      };
      recruiterMap.set(recruiterId, rec);
    }
    rec.eventCount += 1;

    if (act.kind === "APPLICATION_STAGE_CHANGED" && act.payloadJson) {
      try {
        const payload = JSON.parse(act.payloadJson) as StageTransitionPayload;
        const key = payload.toStageKey?.trim();
        if (key) {
          const stage = stages.find((s) => s.key === key);
          const bucket = eodBucketForStageKey(key, {
            isHired: stage?.isHired,
            isRejected: stage?.isRejected,
          });
          stageTransitionsTo[bucket] += 1;
          rec.stageTransitionsTo[bucket] += 1;
        }
      } catch {
        // ignore malformed payload
      }
    }
  }

  const byRecruiter = [...recruiterMap.values()]
    .filter((r) => r.userId !== "unknown")
    .sort((a, b) => b.eventCount - a.eventCount);

  return {
    reportDate,
    timezone,
    generatedAt: new Date().toISOString(),
    stageMetricMap: getStageMetricMapForApi(),
    pipelineStages,
    currentPipelineCounts: {
      byStageId,
      byStageKey,
      byEodBucket,
      totalApplications,
    },
    activitySummary: {
      totalEvents: activities.length,
      byKind,
      stageTransitionsTo,
      byRecruiter,
    },
    hrRoster,
    departments,
    cities,
    openJobs: openJobs.map((j) => ({
      id: j.id,
      title: j.title,
      departmentName: j.department?.name ?? null,
      departmentEmoji: j.department?.emoji ?? null,
    })),
  };
}
