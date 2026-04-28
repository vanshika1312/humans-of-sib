import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea, Label } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { updateProfile } from "./actions";

export default async function MePage() {
  const session = await auth();
  const me = await prisma.user.findUnique({
    where: { email: session!.user!.email! },
    include: { department: true, city: true, manager: true, reports: true, compensation: true },
  });
  if (!me) return null;

  const tenure = Math.floor((Date.now() - me.joinedAt.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div>
      <PageHeader title="My Profile" emoji="🙋" subtitle="Your face at SIB." />

      <Card className="mb-5 overflow-hidden">
        <div className="h-24 brand-gradient confetti" />
        <CardContent className="pt-0 -mt-10">
          <div className="flex items-end gap-4">
            <Avatar src={me.image} name={me.name} size="xl" className="ring-4 ring-white" />
            <div className="pb-1">
              <h2 className="text-xl font-bold text-ink-700">{me.name}</h2>
              <div className="text-sm text-ink-500">{me.title || "Team member"}</div>
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                {me.department && <Badge tone="sky">{me.department.emoji} {me.department.name}</Badge>}
                {me.city && <Badge tone="ink">📍 {me.city.name}</Badge>}
                <Badge tone="orange">{me.role}</Badge>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3 mt-5 pt-5 border-t border-ink-100">
            <Info label="Email" value={me.email} />
            <Info label="Joined" value={`${formatDate(me.joinedAt)} · ${tenure}d`} />
            <Info label="Manager" value={me.manager?.name || "—"} />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-5">
        <CardContent className="pt-5">
          <h3 className="font-semibold text-ink-700 mb-3">Edit profile</h3>
          <form action={updateProfile} className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" defaultValue={me.title || ""} placeholder="e.g. Senior Product Designer" />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" defaultValue={me.phone || ""} placeholder="+91…" />
              </div>
            </div>
            <div>
              <Label htmlFor="birthday">Birthday</Label>
              <Input id="birthday" name="birthday" type="date" defaultValue={me.birthday ? me.birthday.toISOString().slice(0, 10) : ""} />
            </div>
            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" name="bio" rows={3} defaultValue={me.bio || ""} placeholder="A sentence or two about you." />
            </div>
            <Button type="submit">Save</Button>
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
                {me.compensation.note && (
                  <div className="text-xs text-ink-400 mt-0.5">{me.compensation.note}</div>
                )}
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
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-ink-400">{label}</div>
      <div className="text-sm font-medium text-ink-700 truncate">{value}</div>
    </div>
  );
}
