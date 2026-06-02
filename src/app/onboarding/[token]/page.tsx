import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { displayName } from "@/lib/user-display-name";
import { EmployeeSelfProfileFields } from "@/components/profile/employee-self-profile-fields";
import { completeEmployeeOnboarding } from "../actions";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> };

export default async function OnboardingInvitePage({ params, searchParams }: Props) {
  const { token } = await params;
  const { error: errorParam } = await searchParams;
  const now = new Date();

  const user = await prisma.user.findFirst({
    where: {
      onboardingInviteToken: token,
      invitationPending: true,
      onboardingInviteExpiresAt: { gt: now },
    },
    select: {
      id: true,
      email: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      name: true,
    },
  });

  if (!user) notFound();

  const cities = await prisma.city.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-6 md:p-10 bg-ink-50/80">
      <div className="w-full max-w-lg">
        <PageHeader
          title="Complete your profile"
          emoji="👋"
          subtitle={`Hi ${displayName(user)} (${user.email}). Add your personal details here, or skip and fill them in when you sign in with Google for the first time.`}
        />

        {user.employeeCode && (
          <p className="text-sm text-ink-500 mb-4">
            Your employee ID: <span className="font-semibold text-ink-700">{user.employeeCode}</span>
          </p>
        )}

        {errorParam && (
          <div className="mb-4 rounded-md bg-red-50 text-red-700 text-sm px-4 py-3">
            {errorParam === "invalid_invite"
              ? "This invite is no longer valid."
              : decodeURIComponent(errorParam)}
          </div>
        )}

        <Card>
          <CardContent className="pt-6">
            <form action={completeEmployeeOnboarding} className="space-y-4">
              <input type="hidden" name="inviteToken" value={token} />
              <EmployeeSelfProfileFields cities={cities} officialEmail={user.email} />
              <Button type="submit" variant="accent" className="w-full">
                Submit &amp; continue to sign in
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-ink-400">
          <Link href="/sign-in" className="text-sky-600 hover:underline">
            Already finished? Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
