import { redirect } from "next/navigation";
import { requireAppViewer } from "@/lib/app-viewer";
import { canSubmitJobRequisition } from "@/lib/hiring-requisition-access";

export default async function RequisitionsLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAppViewer();
  if (!me || !canSubmitJobRequisition(me.role)) redirect("/home");

  return <div className="pb-12">{children}</div>;
}
