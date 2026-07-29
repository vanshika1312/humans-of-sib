import type { JourneyEventType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import type { AppViewer } from "@/lib/app-viewer";
import { displayName } from "@/lib/user-display-name";
import type {
  EmployeeJourney,
  JourneyMilestone,
  MilestoneType,
} from "./journey-types";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mapJourneyEventType(type: JourneyEventType): MilestoneType {
  switch (type) {
    case "JOINED":
      return "joining";
    case "PROMOTION":
      return "promotion";
    case "AWARD":
    case "WIN":
      return "award";
    case "TRAINING_COMPLETED":
      return "training";
    case "ANNIVERSARY":
      return "anniversary";
    case "FEEDBACK_RECEIVED":
      return "recognition";
    case "MILESTONE":
    case "CUSTOM":
    default:
      return "recognition";
  }
}

function issuedByFromMeta(meta: unknown): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const record = meta as Record<string, unknown>;
  const candidate = record.issuedBy ?? record.givenBy ?? record.author;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : undefined;
}

function buildGrowthCurve(
  joinedAt: Date,
  currentTitle: string,
  promotionEvents: { occurredAt: Date; title: string }[],
): EmployeeJourney["growthCurve"] {
  const points: EmployeeJourney["growthCurve"] = [
    {
      date: toDateString(joinedAt),
      seniorityLevel: 1,
      designation: currentTitle ? `${currentTitle} — Start` : "Joined SIB",
    },
  ];

  const sortedPromotions = [...promotionEvents].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );

  sortedPromotions.forEach((event, index) => {
    points.push({
      date: toDateString(event.occurredAt),
      seniorityLevel: index + 2,
      designation: event.title,
    });
  });

  const last = points[points.length - 1];
  const today = toDateString(new Date());
  if (currentTitle && (last.designation !== currentTitle || last.date !== today)) {
    points.push({
      date: today,
      seniorityLevel: Math.max(last.seniorityLevel, sortedPromotions.length + 1),
      designation: currentTitle,
    });
  }

  return points;
}

function seniorityLabelsFromCurve(
  growthCurve: EmployeeJourney["growthCurve"],
): Record<number, string> {
  const labels: Record<number, string> = {};
  for (const point of growthCurve) {
    labels[point.seniorityLevel] = point.designation;
  }
  return labels;
}

export async function loadEmployeeJourney(viewer: AppViewer): Promise<EmployeeJourney> {
  const name = displayName(viewer);
  const designation = viewer.title?.trim() || "Team member";
  const department = viewer.department?.name ?? "—";
  const location = viewer.city?.name ?? "—";
  const joinedAt = viewer.joinedAt;

  const [
    journeyEvents,
    certificates,
    wins,
    trainingsCompleted,
    promotionEvents,
  ] = await Promise.all([
    prisma.journeyEvent.findMany({
      where: { userId: viewer.id },
      orderBy: { occurredAt: "desc" },
    }),
    prisma.certificate.findMany({
      where: { userId: viewer.id },
      orderBy: { issuedAt: "desc" },
      include: { training: { select: { title: true, provider: true } } },
    }),
    prisma.win.findMany({
      where: { userId: viewer.id },
      orderBy: { createdAt: "desc" },
      include: {
        celebratedBy: {
          select: { name: true, firstName: true, lastName: true },
        },
      },
    }),
    prisma.trainingEnrollment.count({
      where: { userId: viewer.id, status: "COMPLETED" },
    }),
    prisma.journeyEvent.findMany({
      where: { userId: viewer.id, type: "PROMOTION" },
      orderBy: { occurredAt: "asc" },
      select: { occurredAt: true, title: true },
    }),
  ]);

  const eventMilestones: JourneyMilestone[] = journeyEvents.map((event) => ({
    id: event.id,
    type: mapJourneyEventType(event.type),
    title: event.title,
    date: toDateString(event.occurredAt),
    description: event.description?.trim() || "",
    issuedBy: issuedByFromMeta(event.meta),
  }));

  const hasJoinedEvent = journeyEvents.some((e) => e.type === "JOINED");
  const milestones: JourneyMilestone[] = hasJoinedEvent
    ? eventMilestones
    : [
        {
          id: `joined-${viewer.id}`,
          type: "joining",
          title: "Joined Skillinabox",
          date: toDateString(joinedAt),
          description: "Welcome to the SIB family.",
          issuedBy: "People Operations",
        },
        ...eventMilestones,
      ];

  const growthCurve = buildGrowthCurve(joinedAt, designation, promotionEvents);
  const designationsHeld = new Set(
    growthCurve.map((p) => p.designation.replace(/\s+—\s+Start$/, "")),
  ).size;

  return {
    employee: {
      name,
      designation,
      department,
      location,
      joinedAt: toDateString(joinedAt),
      companyName: "Skillinabox",
      avatarInitials: initialsFromName(name),
      avatarUrl: viewer.image ?? undefined,
    },
    stats: {
      trainingsCompleted,
      certificationsEarned: certificates.length,
      awardsCount: wins.length,
      designationsHeld,
      performanceSummary: "—",
    },
    growthCurve,
    seniorityLabels: seniorityLabelsFromCurve(growthCurve),
    milestones,
    certifications: certificates.map((cert) => ({
      id: cert.id,
      name: cert.training.title,
      issuer: cert.training.provider?.trim() || "SIB Learning",
      date: toDateString(cert.issuedAt),
    })),
    awards: wins.map((win) => ({
      id: win.id,
      name: win.title,
      givenBy: win.celebratedBy ? displayName(win.celebratedBy) : "SIB",
      date: toDateString(win.createdAt),
      occasion: win.category ? win.category.replace(/_/g, " ") : "Win wall",
    })),
    taggedFeedPhotos: [],
  };
}
