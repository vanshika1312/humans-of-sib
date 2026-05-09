import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Label, Textarea } from "@/components/ui/input";
import { displayName } from "@/lib/user-display-name";
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
          subtitle={`Hi ${displayName(user)} (${user.email}). A few details left — then you can sign in with Google.`}
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

              <div>
                <Label htmlFor="personalEmail">Personal email *</Label>
                <Input
                  id="personalEmail"
                  name="personalEmail"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@gmail.com"
                />
              </div>

              <div>
                <Label htmlFor="birthday">Date of birth *</Label>
                <Input id="birthday" name="birthday" type="date" required />
              </div>

              <div>
                <Label htmlFor="gender">Gender *</Label>
                <Select id="gender" name="gender" required defaultValue="">
                  <option value="" disabled>
                    Choose…
                  </option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="NON_BINARY">Non-binary</option>
                  <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="cityId">Location (city) *</Label>
                <Select id="cityId" name="cityId" required defaultValue="">
                  <option value="" disabled>
                    Choose your city…
                  </option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.isHQ ? " (HQ)" : ""}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="residentialAddress">Full address *</Label>
                <Textarea
                  id="residentialAddress"
                  name="residentialAddress"
                  required
                  placeholder="House no., street, area, PIN code"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pan">PAN *</Label>
                  <Input id="pan" name="pan" required placeholder="ABCDE1234F" maxLength={10} />
                </div>
                <div>
                  <Label htmlFor="aadhar">Aadhaar (12 digits) *</Label>
                  <Input id="aadhar" name="aadhar" required inputMode="numeric" maxLength={12} />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fatherName">Father&apos;s name *</Label>
                  <Input id="fatherName" name="fatherName" required />
                </div>
                <div>
                  <Label htmlFor="motherName">Mother&apos;s name *</Label>
                  <Input id="motherName" name="motherName" required />
                </div>
              </div>

              <div>
                <Label htmlFor="emergencyContactName">Emergency contact name *</Label>
                <Input id="emergencyContactName" name="emergencyContactName" required />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emergencyContactPhone">Emergency contact phone *</Label>
                  <Input id="emergencyContactPhone" name="emergencyContactPhone" required />
                </div>
                <div>
                  <Label htmlFor="emergencyContactRelation">Relationship *</Label>
                  <Input
                    id="emergencyContactRelation"
                    name="emergencyContactRelation"
                    required
                    placeholder="e.g. Spouse"
                  />
                </div>
              </div>

              <p className="text-xs text-ink-400">
                Your official work email is <span className="font-medium text-ink-600">{user.email}</span> — use
                that account when you sign in with Google after submitting.
              </p>

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
