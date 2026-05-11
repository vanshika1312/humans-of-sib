import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { HiringSubnav } from "./_components/hiring-subnav";

const RECRUITER_ROLES = ["CEO", "ADMIN", "HR"];

export default async function HiringLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const me = await prisma.user.findUnique({ where: { email: session!.user!.email! } });
  if (!me || !RECRUITER_ROLES.includes(me.role)) redirect("/home");

  return (
    <div className="space-y-6 pb-10">
      <HiringSubnav />
      {children}
    </div>
  );
}
