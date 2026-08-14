"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent, type ReactNode } from "react";
import { Bold, List } from "lucide-react";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  name: string;
  defaultValue?: string;
  rows?: number;
  className?: string;
  placeholder?: string;
};

export function JobDescriptionEditor({
  id,
  name,
  defaultValue = "",
  rows = 12,
  className,
  placeholder = "Responsibilities, expectations, team context, benefits…",
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function notify() {
    ref.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function toggleBold() {
    const el = ref.current;
    if (!el) return;
    toggleWrap(el, "**");
    notify();
  }

  function toggleBullets() {
    const el = ref.current;
    if (!el) return;
    applyLinePrefix(el, "- ");
    notify();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      toggleBold();
    }
  }

  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const html = e.clipboardData.getData("text/html");
    if (!html || !clipboardHtmlHasFormatting(html)) return;
    const md = htmlToJobMarkdown(html);
    if (!md) return;
    e.preventDefault();
    const el = ref.current;
    if (!el) return;
    insertAtCursor(el, md);
    notify();
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-ink-200 bg-ink-50/80 px-1.5 py-1">
        <ToolbarButton onClick={toggleBold} label="Bold" shortcut="⌘B">
          <Bold className="size-3.5" />
          Bold
        </ToolbarButton>
        <ToolbarButton onClick={toggleBullets} label="Bullet list">
          <List className="size-3.5" />
          Bullets
        </ToolbarButton>
        <span className="text-[11px] text-ink-400 pl-1.5 hidden sm:inline">
          Select text, then Bold. Paste from Docs or Word keeps formatting.
        </span>
      </div>
      <Textarea
        ref={ref}
        id={id}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
      />
    </div>
  );
}

function ToolbarButton({
  onClick,
  label,
  shortcut,
  children,
}: {
  onClick: () => void;
  label: string;
  shortcut?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={shortcut ? `${label} (${shortcut})` : label}
      className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-ink-700 hover:bg-white hover:shadow-sm border border-transparent hover:border-ink-200"
    >
      {children}
    </button>
  );
}

function toggleWrap(el: HTMLTextAreaElement, marker: string) {
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const value = el.value;
  const selected = value.slice(start, end);
  const before = value.slice(Math.max(0, start - marker.length), start);
  const after = value.slice(end, end + marker.length);

  if (before === marker && after === marker) {
    el.value = value.slice(0, start - marker.length) + selected + value.slice(end + marker.length);
    el.focus();
    el.setSelectionRange(start - marker.length, end - marker.length);
    return;
  }
  if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length > marker.length * 2) {
    const inner = selected.slice(marker.length, selected.length - marker.length);
    el.value = value.slice(0, start) + inner + value.slice(end);
    el.focus();
    el.setSelectionRange(start, start + inner.length);
    return;
  }

  const inner = selected || "text";
  el.value = value.slice(0, start) + marker + inner + marker + value.slice(end);
  el.focus();
  const innerStart = start + marker.length;
  el.setSelectionRange(innerStart, innerStart + inner.length);
}

function applyLinePrefix(el: HTMLTextAreaElement, prefix: string) {
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const value = el.value;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEndIdx = value.indexOf("\n", end);
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
  const block = value.slice(lineStart, lineEnd);
  const lines = block.length === 0 ? [""] : block.split("\n");
  const bulletRe = /^\s*(?:[-*•]|–)\s+/;
  const allBulleted = lines.every((l) => !l.trim() || bulletRe.test(l));

  const nextLines = allBulleted
    ? lines.map((l) => l.replace(bulletRe, ""))
    : lines.map((l) => {
        if (!l.trim()) return l;
        if (bulletRe.test(l)) return l;
        return `${prefix}${l.replace(/^\s+/, "")}`;
      });

  const nextBlock = nextLines.join("\n");
  el.value = value.slice(0, lineStart) + nextBlock + value.slice(lineEnd);
  el.focus();
  el.setSelectionRange(lineStart, lineStart + nextBlock.length);
}

function insertAtCursor(el: HTMLTextAreaElement, insert: string) {
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const value = el.value;
  el.value = value.slice(0, start) + insert + value.slice(end);
  const pos = start + insert.length;
  el.focus();
  el.setSelectionRange(pos, pos);
}

function clipboardHtmlHasFormatting(html: string): boolean {
  return (
    /<(b|strong|i|em|ul|ol|li|h[1-6])\b/i.test(html) || /font-weight\s*:\s*(bold|[6-9]00)/i.test(html)
  );
}

function htmlToJobMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return walk(doc.body, { bold: false, italic: false })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type InlineStyle = { bold: boolean; italic: boolean };

function walk(node: Node, inherited: InlineStyle): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? "").replace(/\u00a0/g, " ");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === "style" || tag === "script" || tag === "meta" || tag === "link") return "";
  if (tag === "br") return "\n";

  const next: InlineStyle = {
    bold: inherited.bold || isBoldEl(el),
    italic: inherited.italic || isItalicEl(el),
  };
  const inner = Array.from(el.childNodes)
    .map((child) => walk(child, next))
    .join("");

  let wrapped = inner;
  if (!inherited.bold && next.bold) wrapped = wrapMarker(wrapped, "**");
  else if (!inherited.italic && next.italic) wrapped = wrapMarker(wrapped, "*");

  if (tag === "li") return `- ${wrapped.replace(/\n+/g, " ").trim()}\n`;
  if (tag === "ul" || tag === "ol") return `\n${wrapped}`;
  if (tag === "p" || tag === "div" || /^h[1-6]$/.test(tag) || tag === "tr") {
    return `${wrapped.replace(/\n+$/, "")}\n\n`;
  }
  return wrapped;
}

function wrapMarker(inner: string, marker: string): string {
  const leading = inner.match(/^\s*/)?.[0] ?? "";
  const trailing = inner.match(/\s*$/)?.[0] ?? "";
  const mid = inner.trim();
  if (!mid) return inner;
  return `${leading}${marker}${mid}${marker}${trailing}`;
}

function isBoldEl(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === "b" || tag === "strong") return true;
  const w = (el.style.fontWeight || "").trim().toLowerCase();
  if (w === "bold" || w === "bolder") return true;
  const n = Number.parseInt(w, 10);
  return !Number.isNaN(n) && n >= 600;
}

function isItalicEl(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === "i" || tag === "em") return true;
  const s = (el.style.fontStyle || "").trim().toLowerCase();
  return s === "italic" || s === "oblique";
}
