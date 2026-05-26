"use client";

import { useRef, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { displayName } from "@/lib/user-display-name";
import { uploadMemberDocument } from "../actions";

export type DocumentUploadMember = {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  title: string | null;
};

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

type Props = {
  canManageAllDocuments: boolean;
  currentUserId: string;
  members: DocumentUploadMember[];
  variant?: "primary" | "outline";
};

function stripExtension(name: string): string {
  return name.replace(/\.(pdf|docx?)$/i, "").trim() || name;
}

export function DocumentUploadDialog({
  canManageAllDocuments,
  currentUserId,
  members,
  variant = "primary",
}: Props) {
  const dlgRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [scope, setScope] = useState<"PERSONAL" | "FOR_ALL">("PERSONAL");
  const [targetUserId, setTargetUserId] = useState(currentUserId);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState<string>("OTHER");

  const showMemberPicker = canManageAllDocuments && scope === "PERSONAL";
  const memberOptions = members.length > 0 ? members : [];

  function openDialog() {
    setScope("PERSONAL");
    setTargetUserId(currentUserId);
    setTitle("");
    setDocType("OTHER");
    queueMicrotask(() => {
      dlgRef.current?.showModal();
      fileRef.current?.focus();
    });
  }

  function closeDialog() {
    dlgRef.current?.close();
  }

  function onFileChange() {
    const file = fileRef.current?.files?.[0];
    if (file && !title.trim()) {
      setTitle(stripExtension(file.name));
    }
  }

  function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    startTransition(async () => {
      const fd = new FormData(ev.currentTarget);
      await uploadMemberDocument(fd);
      closeDialog();
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={variant === "outline" ? "outline" : "primary"}
        size="sm"
        className="shrink-0 gap-1.5"
        onClick={openDialog}
      >
        <Upload className="size-4" aria-hidden />
        Upload
      </Button>

      <dialog
        ref={dlgRef}
        aria-labelledby="document-upload-heading"
        aria-modal="true"
        className="fixed left-[50%] top-[40%] z-50 w-[calc(100vw-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-xl border border-ink-200 bg-white p-5 text-ink-800 shadow-xl [&::backdrop]:bg-black/40"
      >
        <h2 id="document-upload-heading" className="text-lg font-semibold text-ink-700">
          Upload document
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          PDF, DOC, or DOCX up to 12 MB. Personal files are visible only to the selected member; For all
          is visible to everyone.
        </p>

        <form onSubmit={onSubmit} encType="multipart/form-data" className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="document-upload-file">File</Label>
            <input
              ref={fileRef}
              id="document-upload-file"
              name="file"
              type="file"
              required
              disabled={pending}
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={onFileChange}
              className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sky-900 hover:file:bg-sky-200 disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="document-upload-title">Title</Label>
            <Input
              id="document-upload-title"
              name="title"
              autoComplete="off"
              placeholder="e.g. March payslip"
              maxLength={280}
              disabled={pending}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="document-upload-type">Category</Label>
            <Select
              id="document-upload-type"
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
            <Label htmlFor="document-upload-scope">Who can see this</Label>
            <Select
              id="document-upload-scope"
              name="scope"
              disabled={pending}
              value={scope}
              onChange={(e) => setScope(e.target.value as "PERSONAL" | "FOR_ALL")}
              required
            >
              <option value="PERSONAL">Personal — one member only</option>
              {canManageAllDocuments ? <option value="FOR_ALL">For all — everyone in the org</option> : null}
            </Select>
          </div>

          {showMemberPicker ? (
            <div className="space-y-1.5">
              <Label htmlFor="document-upload-member">Member</Label>
              <Select
                id="document-upload-member"
                name="targetUserId"
                disabled={pending || memberOptions.length === 0}
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                required
              >
                {memberOptions.map((member) => (
                  <option key={member.id} value={member.id}>
                    {displayName(member)}
                    {member.title ? ` · ${member.title}` : ""}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <input type="hidden" name="targetUserId" value={currentUserId} />
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" className="text-ink-600" disabled={pending} onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
