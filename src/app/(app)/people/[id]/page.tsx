import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, relativeTime, calendarDaysSincePastDate } from "@/lib/utils";
import { getPeopleProfileAccess, roleLabel, canSeeGovernmentIds } from "@/lib/people-profile-access";
import { displayName } from "@/lib/user-display-name";
import { Trophy, Target, GraduationCap, Compass, ArrowLeft } from "lucide-react";

type Props = { params: Promise<{ id: string }> };

function formatInr(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency || "INR"} ${amount.toLocaleString("en-IN")}`;
  }
}

export default async function PersonPage({ params }: Props) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.email) notFound();

  const viewer = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      role: true,
      headedDept: { select: { id: true } },
    },
  });
  if (!viewer) notFound();

  const person = await prisma.user.findUnique({
    where: { id },
    include: {
      department: true,
      city: true,
      manager: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          image: true,
          title: true,
        },
      },
      reports: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          image: true,
          title: true,
        },
      },
      compensation: true,
    },
  });

  if (!person || person.status === "EXITED") notFound();

  const access = getPeopleProfileAccess({
    viewerUserId: viewer.id,
    viewerRole: viewer.role,
    subjectUserId: person.id,
    subjectManagerId: person.managerId,
    subjectDepartmentId: person.departmentId,
    viewerHeadedDepartmentId: viewer.headedDept?.id ?? null,
  });

  const pn = displayName(person);
  const showGovIds = canSeeGovernmentIds({
    viewerUserId: viewer.id,
    viewerRole: viewer.role,
    subjectUserId: person.id,
  });
  const managerDn = person.manager ? displayName(person.manager) : null;

  const [wins, okrs, certs, journeyEvents] =
    access.showEngagementSections
      ? await Promise.all([
          prisma.win.findMany({
            where: { userId: id },
            orderBy: { createdAt: "desc" },
            take: 5,
            include: { _count: { select: { claps: true } } },
          }),
          prisma.oKR.findMany({
            where: { userId: id, status: { in: ["ON_TRACK", "AT_RISK", "OFF_TRACK"] } },
            orderBy: { createdAt: "desc" },
            take: 5,
          }),
          prisma.certificate.findMany({
            where: { userId: id },
            orderBy: { issuedAt: "desc" },
            take: 5,
            include: { training: { select: { title: true } } },
          }),
          prisma.journeyEvent.findMany({
            where: { userId: id },
            orderBy: { occurredAt: "desc" },
            take: 5,
          }),
        ])
      : [[], [], [], []];

  const tenure = calendarDaysSincePastDate(person.joinedAt);
  const tenureLabel =
    tenure < 30
      ? `${tenure} days`
      : tenure < 365
        ? `${Math.floor(tenure / 30)} months`
        : `${(tenure / 365).toFixed(1)} years`;

  const okrStatusColors: Record<string, string> = {
    ON_TRACK: "bg-emerald-100 text-emerald-700",
    AT_RISK: "bg-amber-100 text-amber-700",
    OFF_TRACK: "bg-red-100 text-red-700",
  };

  const showContactBlock = access.level !== "limited";
  const showSalary = access.canSeeSalary && person.compensation;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link
        href="/people"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-700 transition-colors"
      >
        <ArrowLeft className="size-3.5" /> Back to team
      </Link>

      <Card className="overflow-hidden">
        <div className="h-24 brand-gradient confetti" />
        <CardContent className="pt-0 -mt-10">
          <div className="flex items-end gap-4">
            <Avatar
              src={person.image}
              name={pn}
              size="xl"
              className="ring-4 ring-white"
            />
            <div className="pb-1 min-w-0">
              <h1 className="text-xl font-bold text-ink-700 truncate">{pn}</h1>
              {showContactBlock && (
                <>
                  <div className="text-sm text-ink-500">
                    {person.title || "Team member"}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {person.department && (
                      <Badge tone="sky">
                        {person.department.emoji} {person.department.name}
                      </Badge>
                    )}
                    {person.city && <Badge tone="ink">📍 {person.city.name}</Badge>}
                    <Badge tone="orange">{roleLabel(person.role)}</Badge>
                  </div>
                </>
              )}
              {access.level === "limited" && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <Badge tone="orange">{roleLabel(person.role)}</Badge>
                </div>
              )}
            </div>
          </div>

          {access.level === "limited" ? (
            <div className="grid sm:grid-cols-2 gap-3 mt-5 pt-5 border-t border-ink-100">
              <InfoItem
                label="Department"
                value={
                  person.department
                    ? `${person.department.emoji ?? ""} ${person.department.name}`.trim()
                    : "—"
                }
              />
              <InfoItem label="Role" value={roleLabel(person.role)} />
              <InfoItem
                label="Manager"
                value={
                  person.manager ? (
                    <Link
                      href={`/people/${person.manager.id}`}
                      className="text-sky-600 hover:underline font-medium"
                    >
                      {managerDn}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              <InfoItem label="Date of joining" value={formatDate(person.joinedAt)} />
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 mt-5 pt-5 border-t border-ink-100">
                <InfoItem
                  label="Joined"
                  value={`${formatDate(person.joinedAt)} · ${tenureLabel}`}
                />
                <InfoItem
                  label="Manager"
                  value={
                    person.manager ? (
                      <Link
                        href={`/people/${person.manager.id}`}
                        className="text-sky-600 hover:underline font-medium"
                      >
                        {managerDn}
                      </Link>
                    ) : (
                      "—"
                    )
                  }
                />
                <InfoItem
                  label="Team"
                  value={
                    person.reports.length > 0
                      ? `${person.reports.length} direct reports`
                      : "Individual contributor"
                  }
                />
              </div>

              {showContactBlock && (
                <div className="mt-5 pt-5 border-t border-ink-100 space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                    Contact &amp; personal
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {person.employeeCode && (
                      <InfoItem label="Employee ID" value={person.employeeCode} />
                    )}
                    <InfoItem label="Official email" value={person.email} />
                    <InfoItem label="Personal email" value={person.personalEmail || "—"} />
                    <InfoItem label="Phone" value={person.phone || "—"} />
                    <InfoItem
                      label="Date of birth"
                      value={person.birthday ? formatDate(person.birthday) : "—"}
                    />
                    <InfoItem
                      label="Gender"
                      value={
                        person.gender
                          ? person.gender === "MALE"
                            ? "Male"
                            : person.gender === "FEMALE"
                              ? "Female"
                              : person.gender === "NON_BINARY"
                                ? "Non-binary"
                                : person.gender === "PREFER_NOT_TO_SAY"
                                  ? "Prefer not to say"
                                  : person.gender
                          : "—"
                      }
                    />
                    {person.dateOfLeaving && (
                      <InfoItem label="Date of leaving" value={formatDate(person.dateOfLeaving)} />
                    )}
                    <InfoItem
                      label="Address"
                      value={person.residentialAddress || "—"}
                      className="sm:col-span-2"
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <InfoItem
                      label="Emergency contact"
                      value={
                        person.emergencyContactName ||
                        person.emergencyContactPhone ||
                        person.emergencyContactRelation
                          ? [
                              person.emergencyContactName,
                              person.emergencyContactRelation
                                ? `(${person.emergencyContactRelation})`
                                : "",
                              person.emergencyContactPhone,
                            ]
                              .filter(Boolean)
                              .join(" ")
                          : "—"
                      }
                    />
                    <InfoItem label="Father's name" value={person.fatherName || "—"} />
                    <InfoItem label="Mother's name" value={person.motherName || "—"} />
                  </div>
                  {showGovIds && (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <InfoItem label="PAN" value={person.pan || "—"} />
                      <InfoItem label="Aadhaar" value={person.aadhar || "—"} />
                    </div>
                  )}
                </div>
              )}

              {showSalary && person.compensation && (
                <div className="mt-5 pt-5 border-t border-ink-100 space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                    Compensation
                  </h3>
                  <InfoItem
                    label="Monthly salary"
                    value={formatInr(
                      person.compensation.monthlySalary,
                      person.compensation.currency,
                    )}
                  />
                  {person.compensation.note && (
                    <InfoItem label="Note" value={person.compensation.note} />
                  )}
                </div>
              )}

              {person.bio && (
                <p className="mt-4 text-sm text-ink-600 border-t border-ink-100 pt-4">
                  {person.bio}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {access.showEngagementSections && (
        <div className="grid md:grid-cols-2 gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="size-4 text-orange-500" /> Wins
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {wins.length === 0 && (
                <p className="text-sm text-ink-400">No wins shared yet.</p>
              )}
              {wins.map((w) => (
                <div key={w.id} className="p-3 rounded-lg bg-ink-50/60">
                  <div className="text-sm font-medium text-ink-700">{w.title}</div>
                  {w.description && (
                    <p className="text-xs text-ink-500 mt-0.5 line-clamp-2">{w.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs text-ink-400">{relativeTime(w.createdAt)}</span>
                    <span className="text-xs text-ink-400">👏 {w._count.claps}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="size-4 text-sun-600" /> Active OKRs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {okrs.length === 0 && (
                <p className="text-sm text-ink-400">No active OKRs right now.</p>
              )}
              {okrs.map((o) => (
                <div key={o.id} className="p-3 rounded-lg bg-ink-50/60">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium text-ink-700 flex-1">{o.title}</div>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${okrStatusColors[o.status]}`}
                    >
                      {o.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-ink-100">
                      <div
                        className="h-full rounded-full bg-sky-500"
                        style={{ width: `${o.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-ink-400 shrink-0">{o.progress}%</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <GraduationCap className="size-4 text-sky-600" /> Certificates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {certs.length === 0 && (
                <p className="text-sm text-ink-400">No certificates yet.</p>
              )}
              {certs.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg bg-ink-50/60">
                  <div className="size-7 rounded-md bg-sky-50 text-sky-600 flex items-center justify-center text-xs font-bold shrink-0">
                    🎓
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink-700 truncate">
                      {c.training.title}
                    </div>
                    <div className="text-xs text-ink-400">{formatDate(c.issuedAt)}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Compass className="size-4 text-emerald-600" /> Journey highlights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {journeyEvents.length === 0 && (
                <p className="text-sm text-ink-400">No journey events yet.</p>
              )}
              {journeyEvents.map((e) => (
                <div key={e.id} className="flex items-start gap-3 p-2 rounded-lg bg-ink-50/60">
                  <span className="text-base shrink-0">{e.emoji || "✨"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink-700">{e.title}</div>
                    <div className="text-xs text-ink-400">{formatDate(e.occurredAt)}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {access.showEngagementSections && person.reports.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <h3 className="font-semibold text-ink-700 mb-3">
              Team ({person.reports.length})
            </h3>
            <div className="grid md:grid-cols-2 gap-3">
              {person.reports.map((r) => {
                const rn = displayName(r);
                return (
                  <Link
                    key={r.id}
                    href={`/people/${r.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-ink-50 hover:bg-ink-100 transition-colors"
                  >
                    <Avatar src={r.image} name={rn} />
                    <div>
                      <div className="font-medium text-ink-700">{rn}</div>
                      {r.title && <div className="text-xs text-ink-400">{r.title}</div>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoItem({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-xs text-ink-400">{label}</div>
      <div className="text-sm font-medium text-ink-700 [&_a]:font-medium break-words">
        {value}
      </div>
    </div>
  );
}
