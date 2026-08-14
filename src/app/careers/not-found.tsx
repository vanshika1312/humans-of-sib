import Link from "next/link";
import { CareersChrome } from "./_components/careers-chrome";

export default function CareersNotFound() {
  return (
    <CareersChrome>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-ink-900">This page isn’t available</h1>
        <p className="text-sm text-ink-500">
          The role may have closed, or the link is out of date. You can browse open roles and apply from there.
        </p>
        <Link
          href="/careers/jobs"
          className="inline-flex items-center rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
        >
          See open roles
        </Link>
      </div>
    </CareersChrome>
  );
}
