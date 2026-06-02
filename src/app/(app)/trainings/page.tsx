import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { EmptyState } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { loadTrainingLeaderboard } from "@/lib/training-data";
import { TrainingHubChrome, parseTrainingTab } from "./_components/training-hub-chrome";
import { TrainingCatalogCard, TrainingLeaderboard } from "./_components/training-catalog";
import { firstSearchParam } from "@/lib/search-param";

type SearchParams = Promise<{ tab?: string | string[] }>;

export default function TrainingsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<RouteBodyFallback />}>
      <TrainingsPageInner searchParams={searchParams} />
    </Suspense>
  );
}

async function TrainingsPageInner({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireAppViewer();
  if (!me) return null;

  const sp = await searchParams;
  const tab = parseTrainingTab(firstSearchParam(sp.tab));
  const year = new Date().getFullYear();

  const [trainings, myCerts, enrollments, leaderboard] = await Promise.all([
    prisma.training.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.certificate.findMany({
      where: { userId: me.id },
      include: { training: true },
      orderBy: { issuedAt: "desc" },
    }),
    prisma.trainingEnrollment.findMany({
      where: { userId: me.id },
      include: { training: true },
      orderBy: { completedAt: "desc" },
    }),
    loadTrainingLeaderboard(year),
  ]);

  const enrollmentByTraining = new Map(enrollments.map((e) => [e.trainingId, e]));
  const books = trainings.filter((t) => t.type === "READING");
  const courses = trainings.filter((t) => t.type === "EXTERNAL_COURSE");
  const other = trainings.filter((t) => t.type !== "READING" && t.type !== "EXTERNAL_COURSE");

  const trainingPoints = await prisma.win.aggregate({
    where: { userId: me.id, source: "TRAINING", createdAt: { gte: new Date(year, 0, 1) } },
    _sum: { pointsAwarded: true },
  });
  const myPoints = trainingPoints._sum.pointsAwarded ?? 0;

  return (
    <div className="max-w-5xl">
      <TrainingHubChrome tab={tab} />
      <TrainingLeaderboard entries={leaderboard} year={year} />

      {tab === "books" && (
        <>
          {books.length === 0 && other.length === 0 ? (
            <EmptyState emoji="📖" title="No books yet" description="HR will add motivational reads here soon." />
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {[...books, ...other].map((t) => (
                <TrainingCatalogCard
                  key={t.id}
                  training={t}
                  enrollmentStatus={enrollmentByTraining.get(t.id)?.status}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === "courses" && (
        <>
          {courses.length === 0 ? (
            <EmptyState emoji="🌐" title="No courses yet" description="Free external courses will appear here." />
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {courses.map((t) => (
                <TrainingCatalogCard
                  key={t.id}
                  training={t}
                  enrollmentStatus={enrollmentByTraining.get(t.id)?.status}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === "progress" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-5">
              <div className="text-sm text-ink-500">Your learning points in {year}</div>
              <div className="text-3xl font-bold text-ink-800 mt-1">{myPoints} pts</div>
              <p className="text-xs text-ink-400 mt-1">Also counts toward the Win Wall yearly leaderboard.</p>
            </CardContent>
          </Card>
          {enrollments.length === 0 ? (
            <EmptyState emoji="📚" title="Nothing in progress" description="Start a book or course from the other tabs." />
          ) : (
            <div className="space-y-3">
              {enrollments.map((e) => (
                <Card key={e.id}>
                  <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-ink-700">{e.training.title}</div>
                      <div className="text-xs text-ink-400 mt-0.5">
                        <Badge tone={e.status === "COMPLETED" ? "green" : e.status === "IN_PROGRESS" ? "orange" : "ink"}>
                          {e.status.replace("_", " ")}
                        </Badge>
                        {e.score != null ? ` · Quiz ${e.score}%` : ""}
                      </div>
                    </div>
                    <Link href={`/trainings/${e.trainingId}`}>
                      <Button size="sm" variant="outline">Open</Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "certificates" && (
        <>
          {myCerts.length === 0 ? (
            <EmptyState emoji="🏅" title="No certificates yet" description="Pass a quiz to earn your first certificate." />
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {myCerts.map((c) => (
                <Card key={c.id}>
                  <CardContent className="py-4 flex items-center gap-3">
                    <div className="size-10 rounded-md brand-gradient flex items-center justify-center text-lg">🎓</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-ink-700 truncate">{c.training.title}</div>
                      <div className="text-xs text-ink-400">#{c.number} · {formatDate(c.issuedAt)}</div>
                    </div>
                    <Link href={`/trainings/certificates/${c.id}/print`}>
                      <Button size="sm" variant="outline">Print</Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
