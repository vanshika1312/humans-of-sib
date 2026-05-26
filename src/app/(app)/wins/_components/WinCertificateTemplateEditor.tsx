"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import {
  WIN_CERT_FONT_FAMILIES,
  WIN_CERT_FONT_LABELS,
  WIN_CERT_STYLE_LABELS,
  WIN_CERT_STYLE_PRESETS,
  type WinCertFontFamily,
  type WinCertStylePreset,
} from "@/lib/win-certificate-template";
import { saveWinCertificateTemplate, type WinCertTemplateSaveResult } from "../actions";
import { WinCertificateDisplay } from "./WinCertificateDisplay";
import type { WinCertificateTemplateView } from "@/lib/win-certificate-template";

const INIT: WinCertTemplateSaveResult = { ok: true };

type Props = {
  initial: WinCertificateTemplateView;
  previewRecipient: string;
  previewAchievement: string;
  previewIssuedLabel: string;
  defaultOpen?: boolean;
};

function ColorField({
  id,
  label,
  name,
  value,
  onChange,
}: {
  id: string;
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-ink-200 bg-white p-1"
          aria-label={`${label} colour picker`}
        />
        <Input
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          pattern="^#[0-9A-Fa-f]{6}$"
          maxLength={7}
          className="font-mono text-xs"
          required
        />
      </div>
    </div>
  );
}

export function WinCertificateTemplateEditor({
  initial,
  previewRecipient,
  previewAchievement,
  previewIssuedLabel,
  defaultOpen = false,
}: Props) {
  const [result, dispatch, isPending] = useActionState(saveWinCertificateTemplate, INIT);
  const [draft, setDraft] = useState(initial);

  const previewTemplate = useMemo(() => draft, [draft]);

  return (
    <details
      className="rounded-xl border border-violet-200 bg-violet-50/30 overflow-hidden group"
      open={defaultOpen}
    >
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink-700 hover:bg-violet-50/50 select-none list-none flex items-center justify-between gap-2">
        <span>Customize certificate template</span>
        <span className="text-xs font-normal text-ink-500 group-open:hidden">
          Colours · font · style · background
        </span>
      </summary>

      <div className="px-4 pb-4 space-y-4 border-t border-violet-100">
        <p className="text-xs text-ink-500 pt-3">
          Upload a background image, pick colours and fonts, and choose a layout style. Changes apply
          to all newly issued certificates.
        </p>

        <form action={dispatch} className="space-y-4">
          <fieldset className="space-y-3 rounded-lg border border-violet-100 bg-white/50 p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-widest text-ink-500">
              Appearance
            </legend>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="tpl-style">Layout style</Label>
                <Select
                  id="tpl-style"
                  name="stylePreset"
                  value={draft.stylePreset}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      stylePreset: e.target.value as WinCertStylePreset,
                    }))
                  }
                >
                  {WIN_CERT_STYLE_PRESETS.map((preset) => (
                    <option key={preset} value={preset}>
                      {WIN_CERT_STYLE_LABELS[preset]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="tpl-font">Font</Label>
                <Select
                  id="tpl-font"
                  name="fontFamily"
                  value={draft.fontFamily}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      fontFamily: e.target.value as WinCertFontFamily,
                    }))
                  }
                >
                  {WIN_CERT_FONT_FAMILIES.map((font) => (
                    <option key={font} value={font}>
                      {WIN_CERT_FONT_LABELS[font]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <ColorField
                id="tpl-primary"
                label="Accent colour"
                name="primaryColor"
                value={draft.primaryColor}
                onChange={(primaryColor) => setDraft((d) => ({ ...d, primaryColor }))}
              />
              <ColorField
                id="tpl-secondary"
                label="Heading colour"
                name="secondaryColor"
                value={draft.secondaryColor}
                onChange={(secondaryColor) => setDraft((d) => ({ ...d, secondaryColor }))}
              />
              <ColorField
                id="tpl-text"
                label="Body text colour"
                name="textColor"
                value={draft.textColor}
                onChange={(textColor) => setDraft((d) => ({ ...d, textColor }))}
              />
              <ColorField
                id="tpl-bg-from"
                label="Background (top)"
                name="backgroundFrom"
                value={draft.backgroundFrom}
                onChange={(backgroundFrom) => setDraft((d) => ({ ...d, backgroundFrom }))}
              />
              <ColorField
                id="tpl-bg-to"
                label="Background (bottom)"
                name="backgroundTo"
                value={draft.backgroundTo}
                onChange={(backgroundTo) => setDraft((d) => ({ ...d, backgroundTo }))}
              />
              <ColorField
                id="tpl-border"
                label="Border colour"
                name="borderColor"
                value={draft.borderColor}
                onChange={(borderColor) => setDraft((d) => ({ ...d, borderColor }))}
              />
            </div>
          </fieldset>

          <fieldset className="space-y-3 rounded-lg border border-violet-100 bg-white/50 p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-widest text-ink-500">
              Wording
            </legend>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="tpl-title">Title</Label>
                <Input
                  id="tpl-title"
                  name="title"
                  required
                  maxLength={120}
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="tpl-subtitle">Subtitle / org line</Label>
                <Input
                  id="tpl-subtitle"
                  name="subtitle"
                  required
                  maxLength={160}
                  value={draft.subtitle}
                  onChange={(e) => setDraft((d) => ({ ...d, subtitle: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="tpl-intro">Intro text (before recipient name)</Label>
              <Textarea
                id="tpl-intro"
                name="introText"
                required
                rows={2}
                maxLength={300}
                value={draft.introText}
                onChange={(e) => setDraft((d) => ({ ...d, introText: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="tpl-recognition">Recognition line (before achievement)</Label>
              <Input
                id="tpl-recognition"
                name="recognitionPrefix"
                required
                maxLength={120}
                value={draft.recognitionPrefix}
                onChange={(e) => setDraft((d) => ({ ...d, recognitionPrefix: e.target.value }))}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="tpl-signatory">Signatory name</Label>
                <Input
                  id="tpl-signatory"
                  name="signatoryName"
                  required
                  maxLength={120}
                  value={draft.signatoryName}
                  onChange={(e) => setDraft((d) => ({ ...d, signatoryName: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="tpl-signatory-title">Signatory title</Label>
                <Input
                  id="tpl-signatory-title"
                  name="signatoryTitle"
                  required
                  maxLength={120}
                  value={draft.signatoryTitle}
                  onChange={(e) => setDraft((d) => ({ ...d, signatoryTitle: e.target.value }))}
                />
              </div>
            </div>
          </fieldset>

          <div className="rounded-lg border border-dashed border-violet-200 bg-white/60 p-3 space-y-2">
            <Label htmlFor="tpl-background">Background image (optional)</Label>
            <input
              id="tpl-background"
              name="background"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="block w-full text-sm text-ink-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-ink-200 file:text-xs file:font-medium file:bg-white file:text-ink-600 hover:file:bg-ink-50 cursor-pointer"
            />
            <p className="text-[11px] text-ink-400">
              Upload a PNG or JPG template from your laptop. Recommended: landscape, at least 1200×800
              px. Max 5 MB.
            </p>
            {draft.backgroundImageUrl ? (
              <label className="flex items-center gap-2 text-xs text-ink-600">
                <input type="checkbox" name="removeBackground" value="on" className="rounded border-ink-300" />
                Remove current background image
              </label>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="accent" size="sm" disabled={isPending}>
              {isPending ? "Saving…" : "Save template"}
            </Button>
          </div>
        </form>

        {!result.ok && <p className="text-sm text-red-600">{result.error}</p>}
        {result.ok && result.saved && (
          <p className="text-sm text-emerald-700">Template saved. Preview below reflects your changes.</p>
        )}

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500 mb-2">
            Live preview
          </p>
          <WinCertificateDisplay
            template={previewTemplate}
            recipientName={previewRecipient}
            achievement={previewAchievement}
            issuedLabel={previewIssuedLabel}
          />
        </div>
      </div>
    </details>
  );
}
