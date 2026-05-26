import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { NewOpeningForm } from "@/components/hiring/new-opening-form";
import { firstSearchParam } from "@/lib/search-param";
import { loadJobProfileTemplatesForPicker } from "@/lib/hiring-load-job-templates";

type Props = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function NewHiringJobPage(props: Props) {
  const sp = await props.searchParams;
  const error = firstSearchParam(sp.error);
  const jobProfileTemplates = await loadJobProfileTemplatesForPicker();

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-8">
      <PageHeader
        title="New job opening"
        subtitle="Drafts autosave in this browser so you don't lose entries before you click Save opening."
        action={
          <Link href="/hiring/jobs">
            <Button variant="outline" size="md">
              ← Jobs
            </Button>
          </Link>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {decodeURIComponent(error)}
        </div>
      )}

      <NewOpeningForm jobProfileTemplates={jobProfileTemplates} />
    </div>
  );
}
