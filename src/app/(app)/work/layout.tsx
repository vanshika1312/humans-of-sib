import { requireAppViewer } from "@/lib/app-viewer";
import { PageHeader } from "@/components/ui/page-header";
import { canViewTeamWork } from "@/lib/work-tracking/access";
import { OkrSectionTabs } from "./_components/okr-section-tabs";

export default async function WorkLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAppViewer();
  if (!me) return null;

  const showTeamTab = canViewTeamWork({
    viewerRole: me.role,
    viewerPermissions: me.permissions,
    viewerUserId: me.id,
    viewerHeadedDepartmentId: me.headedDept?.id ?? null,
  });

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="OKRs"
        emoji="🎯"
        subtitle="Daily tasks, team assignments, department goals, and personal OKRs."
      />
      <OkrSectionTabs showTeamTab={showTeamTab} />
      {children}
    </div>
  );
}
