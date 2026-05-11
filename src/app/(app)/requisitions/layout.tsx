import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { canSubmitJobRequisition } from "@/lib/hiring-requisition-access";

export default async function RequisitionsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const me = await prisma.user.findUnique({ where: { email: session!.user!.email! } });
  if (!me || !canSubmitJobRequisition(me.role)) redirect("/home");

  return <div className="pb-12">{children}</div>;
}
