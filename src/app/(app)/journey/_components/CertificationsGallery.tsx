"use client";

import { useState } from "react";
import { FileBadge } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Certification } from "../_data/mockEmployeeData";

type Props = {
  certifications: Certification[];
};

function CertificateModal({
  cert,
  onClose,
}: {
  cert: Certification;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal
      aria-labelledby="cert-modal-title"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <Card
        className="max-h-[90vh] w-full max-w-lg overflow-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <CardContent className="pt-6">
          <h3 id="cert-modal-title" className="text-lg font-semibold text-ink-700">
            {cert.name}
          </h3>
          <p className="mt-1 text-sm text-ink-400">{cert.issuer}</p>
          <div className="mt-6 flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-ink-200 bg-ink-50">
            <div className="text-center text-ink-400">
              <FileBadge className="mx-auto size-12 text-sky-500/60" aria-hidden />
              <p className="mt-2 text-sm">Certificate preview</p>
              <p className="text-xs">Replace with document URL from API</p>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function CertificationsGallery({ certifications }: Props) {
  const [active, setActive] = useState<Certification | null>(null);

  return (
    <section aria-label="Certifications">
      <h2 className="text-sm font-semibold text-ink-600 mb-1">Certifications</h2>
      <p className="text-sm text-ink-400 mb-4">
        Credentials you have earned along the way
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {certifications.map((cert) => (
          <Card key={cert.id}>
            <CardContent className="py-4">
              <div className="size-10 rounded-md brand-gradient flex items-center justify-center text-lg">
                📜
              </div>
              <h3 className="mt-3 font-semibold leading-snug text-ink-700">{cert.name}</h3>
              <p className="mt-1 text-sm text-ink-500">{cert.issuer}</p>
              <p className="mt-2 text-xs text-ink-400">
                Issued {formatDate(cert.date)}
                {cert.validUntil && (
                  <> · Valid until {formatDate(cert.validUntil)}</>
                )}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 w-full"
                onClick={() => setActive(cert)}
              >
                View certificate
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {active && (
        <CertificateModal cert={active} onClose={() => setActive(null)} />
      )}
    </section>
  );
}
