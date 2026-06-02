import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea, Label } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { genderDisplayLabel } from "@/lib/employee-self-profile";
import { EmployeeSelfProfileFields } from "@/components/profile/employee-self-profile-fields";
import { updateProfile } from "./actions";

type Props = { searchParams: Promise<{ error?: string; saved?: string }> };

export default function MePage({ searchParams }: Props) {
  return (
    <div>
      <PageHeader title="My Profile" emoji="🙋" subtitle="Your details at SIB — you can update these anytime." />
      <Suspense fallback={<RouteBodyFallback />}>
        <MePageBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function MePageBody({ searchParams }: Props) {
  const { error: errorParam, saved } = await searchParams;
  const base = await requireAppViewer();
  if (!base) return null;

  const profile = await prisma.user.findUnique({
    where: { id: base.id },
    include: {
      manager: true,
      reports: { orderBy: { name: "asc" } },
      compensation: true,
      city: true,
    },
  });
  if (!profile) return null;

  const cities = await prisma.city.findMany({ orderBy: { name: "asc" } });
  const me = { ...base, ...profile };
  const tenure = Math.floor((Date.now() - me.joinedAt.getTime()) / (1000 * 60 * 60 * 24));

  const emergencyContactDisplay =
    me.emergencyContactName || me.emergencyContactPhone || me.emergencyContactRelation
      ? [me.emergencyContactName, me.emergencyContactRelation ? `(${me.emergencyContactRelation})` : "", me.emergencyContactPhone]
          .filter(Boolean)
          .join(" ")
      : "—";

  return (
    <>
      <Card className="mb-5 overflow-hidden">
        <div className="h-24 brand-gradient confetti" />
        <CardContent className="pt-0 -mt-10">
          <div className="flex items-end gap-4">
            <Avatar src={me.image} name={me.name} size="xl" className="ring-4 ring-white" />
            <div className="pb-1">
              <h2 className="text-xl font-bold text-ink-700">{me.name}</h2>
              <div className="text-sm text-ink-500">{me.title || "Team member"}</div>
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                {me.department && (
                  <Badge tone="sky">
                    {me.department.emoji} {me.department.name}
                  </Badge>
                )}
                {me.city && <Badge tone="ink">📍 {me.city.name}</Badge>}
                <Badge tone="orange">{me.role}</Badge>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3 mt-5 pt-5 border-t border-ink-100">
            <Info label="Employee ID" value={me.employeeCode || "—"} />
            <Info label="Joined" value={`${formatDate(me.joinedAt)} · ${tenure}d`} />
            <Info label="Manager" value={me.manager?.name || "—"} />
          </div>

          <p className="mt-4 text-sm">
            <Link href={`/people/${me.id}`} className="text-sky-600 hover:underline font-medium">
              View your public profile
            </Link>
          </p>
        </CardContent>
      </Card>

      <Card className="mb-5">
        <CardContent className="pt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-3">
            Contact &amp; personal
          </h3>
          <div className="grid sm:grid-cols-2 gap-3 mb-5">
            <Info label="Official email" value={me.email} />
            <Info label="Personal email" value={me.personalEmail || "—"} />
            <Info label="Phone" value={me.phone || "—"} />
            <Info label="Date of birth" value={me.birthday ? formatDate(me.birthday) : "—"} />
            <Info label="Gender" value={genderDisplayLabel(me.gender)} />
            <Info label="Location" value={me.city?.name || "—"} />
            <Info label="Address" value={me.residentialAddress || "—"} className="sm:col-span-2" />
            <Info label="Emergency contact" value={emergencyContactDisplay} className="sm:col-span-2" />
            <Info label="Father's name" value={me.fatherName || "—"} />
            <Info label="Mother's name" value={me.motherName || "—"} />
            <Info label="PAN" value={me.pan || "—"} />
            <Info label="Aadhaar" value={me.aadhar || "—"} />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-5">
        <CardContent className="pt-5">
          <h3 className="font-semibold text-ink-700 mb-1">Edit profile</h3>
          <p className="text-sm text-ink-400 mb-4">
            Update your contact and personal details, title, and bio.
          </p>

          {saved === "1" && (
            <div className="mb-4 rounded-md bg-emerald-50 text-emerald-800 text-sm px-4 py-3">
              Profile saved.
            </div>
          )}
          {errorParam && (
            <div className="mb-4 rounded-md bg-red-50 text-red-700 text-sm px-4 py-3">
              {decodeURIComponent(errorParam)}
            </div>
          )}

          <form action={updateProfile} className="space-y-5">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="title">Job title</Label>
                <Input
                  id="title"
                  name="title"
                  defaultValue={me.title || ""}
                  placeholder="e.g. Senior Product Designer"
                />
              </div>
              <div>
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  name="bio"
                  rows={2}
                  defaultValue={me.bio || ""}
                  placeholder="A sentence or two about you."
                  className="min-h-[2.5rem]"
                />
              </div>
            </div>

            <EmployeeSelfProfileFields
              cities={cities}
              officialEmail={me.email}
              defaults={{
                personalEmail: me.personalEmail,
                birthday: me.birthday,
                gender: me.gender,
                cityId: me.cityId,
                residentialAddress: me.residentialAddress,
                pan: me.pan,
                aadhar: me.aadhar,
                fatherName: me.fatherName,
                motherName: me.motherName,
                emergencyContactName: me.emergencyContactName,
                emergencyContactPhone: me.emergencyContactPhone,
                emergencyContactRelation: me.emergencyContactRelation,
                phone: me.phone,
              }}
            />

            <Button type="submit">Save changes</Button>
          </form>
        </CardContent>
      </Card>

      {me.compensation && (
        <Card className="mb-5">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-ink-700">💰 My Salary</h3>
                <p className="text-xs text-ink-400 mt-0.5">Only visible to you and HR/Admin</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-ink-700">
                  ₹{me.compensation.monthlySalary.toLocaleString("en-IN")}
                  <span className="text-sm font-normal text-ink-400">/mo</span>
                </div>
                {me.compensation.note && <div className="text-xs text-ink-400 mt-0.5">{me.compensation.note}</div>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {me.reports.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <h3 className="font-semibold text-ink-700 mb-3">My team ({me.reports.length})</h3>
            <div className="grid md:grid-cols-2 gap-3">
              {me.reports.map((r) => (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-ink-50">
                  <Avatar src={r.image} name={r.name} />
                  <div>
                    <div className="font-medium text-ink-700">{r.name}</div>
                    <div className="text-xs text-ink-400">{r.title}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function Info({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-xs text-ink-400 uppercase tracking-wide">{label}</div>
      <div className="text-sm font-medium text-ink-700">{value}</div>
    </div>
  );
}
