import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAppViewer } from "@/lib/app-viewer";
import { isLiaEnabled } from "@/lib/lia-config";
import { PageHeader } from "@/components/ui/page-header";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { LiaPageClient } from "@/components/lia/lia-page-client";

export default function LiaPage() {
  return (
    <div>
      <PageHeader
        title="LIA"
        emoji="✨"
        subtitle="Your guide to Humans of SIB — policies, how-tos, and quick answers."
      />
      <Suspense fallback={<RouteBodyFallback />}>
        <LiaPageBody />
      </Suspense>
    </div>
  );
}

async function LiaPageBody() {
  const me = await requireAppViewer();
  if (!me) redirect("/sign-in");

  if (!isLiaEnabled()) {
    return (
      <div className="rounded-xl border border-dashed border-ink-200 bg-white px-6 py-10 text-center text-sm text-ink-500">
        <p className="font-medium text-ink-700 mb-2">LIA is not available yet</p>
        <p>
          HR is still setting this up. For urgent questions, email{" "}
          <a className="text-sky-600 hover:underline" href="mailto:hr@skillinabox.in">
            hr@skillinabox.in
          </a>
          .
        </p>
        <Link href="/home" className="inline-block mt-4 text-sky-600 hover:underline text-sm font-medium">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <Suspense fallback={<RouteBodyFallback />}>
      <LiaPageClient />
    </Suspense>
  );
}
