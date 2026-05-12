import { redirect } from "next/navigation";
import { requireAppViewer } from "@/lib/app-viewer";
import { HiringSubnav } from "./_components/hiring-subnav";

const RECRUITER_ROLES = ["CEO", "ADMIN", "HR"];

export default async function HiringLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAppViewer();
  if (!me || !RECRUITER_ROLES.includes(me.role)) redirect("/home");

  return (
    <div className="space-y-6 pb-10">
      <HiringSubnav />
      {children}
    </div>
  );
}
