"use client";

import { useRef, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { Download, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { deleteMemberDocument, updateMemberDocument } from "../actions";

const DOCUMENT_TYPES = [
  { value: "OFFER_LETTER", label: "Offer Letter" },
  { value: "APPOINTMENT_LETTER", label: "Appointment Letter" },
  { value: "APPRECIATION", label: "Appreciation" },
  { value: "PAYSLIP", label: "Payslip" },
  { value: "FORM_16", label: "Form 16" },
  { value: "ID_PROOF", label: "ID Proof" },
  { value: "ADDRESS_PROOF", label: "Address Proof" },
  { value: "NDA", label: "NDA" },
  { value: "ESOP", label: "ESOP" },
  { value: "POLICY", label: "Policy" },
  { value: "CERTIFICATE", label: "Certificate" },
  { value: "OTHER", label: "Other" },
] as const;

export type DocumentRowItem = {
  id: string;
  title: string;
  type: string;
  url: string;
};

function DeleteSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="ghost"
      size="sm"
      disabled={pending}
      className="h-8 px-3 text-xs font-medium text-rose-700 hover:bg-rose-50"
    >
      <Trash2 className="size-3.5" aria-hidden />
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}

export function DocumentRowActions({
  document,
  canManage,
}: {
  document: DocumentRowItem;
  canManage: boolean;
}) {
  const dlgRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(document.title);
  const [docType, setDocType] = useState(document.type);

  function openDialog() {
    setTitle(document.title);
    setDocType(document.type);
    queueMicrotask(() => {
      dlgRef.current?.showModal();
    });
  }

  function closeDialog() {
    dlgRef.current?.close();
  }

  function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    startTransition(async () => {
      const fd = new FormData(ev.currentTarget);
      await updateMemberDocument(fd);
      closeDialog();
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <a
        href={document.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100"
      >
        <Download className="size-3.5" /> Open
      </a>

      {canManage ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-xs font-medium text-ink-700 hover:bg-ink-100"
            onClick={openDialog}
          >
            <Pencil className="size-3.5" aria-hidden />
            Edit
          </Button>
          <form
            action={deleteMemberDocument}
            onSubmit={(e) => {
              if (!confirm(`Delete “${document.title}”? This cannot be undone.`)) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="documentId" value={document.id} />
            <DeleteSubmit />
          </form>

          <dialog
            ref={dlgRef}
            aria-labelledby={`document-edit-heading-${document.id}`}
            aria-modal="true"
            className="fixed left-[50%] top-[40%] z-50 w-[calc(100vw-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-xl border border-ink-200 bg-white p-5 text-ink-800 shadow-xl [&::backdrop]:bg-black/40"
          >
            <h2
              id={`document-edit-heading-${document.id}`}
              className="text-lg font-semibold text-ink-700"
            >
              Edit document
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Change the title or category. Leave the file blank to keep the current one.
            </p>

            <form onSubmit={onSubmit} encType="multipart/form-data" className="mt-4 space-y-3">
              <input type="hidden" name="documentId" value={document.id} />

              <div className="space-y-1.5">
                <Label htmlFor={`document-edit-title-${document.id}`}>Title</Label>
                <Input
                  id={`document-edit-title-${document.id}`}
                  name="title"
                  autoComplete="off"
                  maxLength={280}
                  disabled={pending}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`document-edit-type-${document.id}`}>Category</Label>
                <Select
                  id={`document-edit-type-${document.id}`}
                  name="type"
                  disabled={pending}
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  required
                >
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`document-edit-file-${document.id}`}>Replace file (optional)</Label>
                <input
                  id={`document-edit-file-${document.id}`}
                  name="file"
                  type="file"
                  disabled={pending}
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sky-900 hover:file:bg-sky-200 disabled:opacity-50"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-ink-600"
                  disabled={pending}
                  onClick={closeDialog}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={pending}>
                  {pending ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          </dialog>
        </>
      ) : null}
    </div>
  );
}
