"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { CandidateAuthPanel } from "./candidate-auth-panel";

export function ApplyNowAuthModal({
  jobId,
  openOnMount = false,
  initialMode = "register",
  flashError,
}: {
  jobId: string;
  openOnMount?: boolean;
  initialMode?: "register" | "signin";
  flashError?: string;
}) {
  const dlgRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [mode, setMode] = useState<"register" | "signin">(initialMode);
  const [error, setError] = useState(flashError);

  function stripAuthQuery() {
    router.replace(`/careers/${jobId}`, { scroll: false });
  }

  function openDialog() {
    setMode("register");
    setError(undefined);
    dlgRef.current?.showModal();
  }

  function closeDialog() {
    dlgRef.current?.close();
  }

  useEffect(() => {
    if (!openOnMount) return;
    dlgRef.current?.showModal();
  }, [openOnMount]);

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex items-center rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
      >
        Apply now
      </button>
      <dialog
        ref={dlgRef}
        aria-labelledby="candidate-auth-heading"
        aria-modal="true"
        className="fixed left-[50%] top-[50%] z-50 w-[calc(100vw-2rem)] max-w-md max-h-[min(90vh,40rem)] translate-x-[-50%] translate-y-[-50%] overflow-hidden rounded-2xl border border-ink-200 bg-white p-0 text-ink-800 shadow-xl [&::backdrop]:bg-black/40"
        onClose={() => {
          if (openOnMount || flashError) stripAuthQuery();
        }}
        onClick={(event) => {
          if (event.target === dlgRef.current) closeDialog();
        }}
      >
        <div className="max-h-[min(90vh,40rem)] overflow-y-auto p-5">
          <div className="flex justify-end -mt-1 -mr-1 mb-1">
            <button
              type="button"
              onClick={closeDialog}
              className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
              aria-label="Close"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <CandidateAuthPanel
            callbackUrl={`/careers/${jobId}/apply`}
            mode={mode}
            flashError={error}
            chrome="plain"
            onSwitchMode={(next) => {
              setMode(next);
              setError(undefined);
            }}
          />
        </div>
      </dialog>
    </>
  );
}
