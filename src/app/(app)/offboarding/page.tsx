import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const DEFAULT_CHECKLIST = [
  { title: "Knowledge transfer doc with teammate", ownedBy: "You" },
  { title: "Handover active projects", ownedBy: "You" },
  { title: "Return laptop & ID card", ownedBy: "You" },
  { title: "Exit interview with HR", ownedBy: "HR" },
  { title: "Revoke system access (email, tools)", ownedBy: "IT" },
  { title: "Full & final settlement", ownedBy: "Finance" },
  { title: "Issue experience letter", ownedBy: "HR" },
  { title: "Remove from payroll", ownedBy: "Finance" },
];

export default async function OffboardingPage() {
  const session = await auth();
  const me = await prisma.user.findUnique({ where: { email: session!.user!.email! } });
  if (!me) return null;

  const tasks = await prisma.offboardingTask.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: "asc" },
  });

  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <div>
      <PageHeader
        title="Offboarding"
        emoji="👋"
        subtitle="If you ever decide to move on, here's what happens. We make it clean, kind, and complete."
      />

      {me.status !== "NOTICE_PERIOD" && me.status !== "EXITED" && (
        <Card className="mb-6 p-5 bg-sky-50 border-sky-200">
          <div className="text-sm text-sky-700">
            You&apos;re not in offboarding. This page becomes active when HR starts the process.
          </div>
        </Card>
      )}

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="pt-5">
            <h3 className="font-semibold text-ink-700 mb-3">Standard exit checklist</h3>
            <ul className="divide-y divide-ink-100">
              {DEFAULT_CHECKLIST.map((c) => (
                <li key={c.title} className="py-3 flex items-center gap-3">
                  <div className="size-5 rounded-md border-2 border-ink-200" />
                  <div className="flex-1 text-sm text-ink-600">{c.title}</div>
                  <Badge tone="ink">{c.ownedBy}</Badge>
                </li>
              ))}
            </ul>
            <div className="mt-4 text-xs text-ink-400">
              This is the template. When offboarding starts, personalized tasks appear here.
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-5">
            <div className="mb-3 text-sm text-ink-500">
              {completedCount} of {tasks.length} done
            </div>
            <ul className="divide-y divide-ink-100">
              {tasks.map((t) => (
                <li key={t.id} className="py-3 flex items-center gap-3">
                  <div className={`size-5 rounded-md border-2 flex items-center justify-center ${
                    t.completed ? "bg-sky-500 border-sky-500 text-white text-xs" : "border-ink-200"
                  }`}>
                    {t.completed && "✓"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${t.completed ? "line-through text-ink-400" : "text-ink-700"}`}>
                      {t.title}
                    </div>
                    {t.description && <p className="text-xs text-ink-400 mt-0.5">{t.description}</p>}
                  </div>
                  {t.ownedBy && <Badge tone="ink">{t.ownedBy}</Badge>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
