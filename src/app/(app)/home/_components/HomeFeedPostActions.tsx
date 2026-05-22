"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Props = {
  postId: string;
  initialBody: string | null;
  initialPostKind?: "TEXT" | "PHOTO" | "VIDEO";
  initialMedia?: { url: string; mimeType?: string; fileName?: string } | null;
  initialPhotoTags?: Array<{ userId: string; name: string; x: number; y: number }>;
  className?: string;
};

type UserSuggestion = { id: string; name: string; image: string | null };
type PhotoTag = { userId: string; name: string; x: number; y: number };

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function getMentionQuery(text: string, caret: number) {
  const upto = text.slice(0, caret);
  const at = upto.lastIndexOf("@");
  if (at < 0) return null;
  if (upto[at + 1] === "[") return null; // already a mention token
  if (at > 0 && !/\s/.test(upto[at - 1])) return null;
  const q = upto.slice(at + 1);
  if (!q.length || /\s/.test(q)) return null;
  return { atIndex: at, caret, q };
}

export function HomeFeedPostActions({
  postId,
  initialBody,
  initialPostKind,
  initialMedia,
  initialPhotoTags,
  className,
}: Props) {
  const router = useRouter();
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(initialBody ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mention, setMention] = useState<{ atIndex: number; caret: number; q: string } | null>(null);
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [highlightIx, setHighlightIx] = useState(0);

  const [taggingEnabled, setTaggingEnabled] = useState(false);
  const [photoTags, setPhotoTags] = useState<PhotoTag[]>([]);
  const [tagDraft, setTagDraft] = useState<{ x: number; y: number; q: string } | null>(null);
  const [tagSuggestOpen, setTagSuggestOpen] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState<UserSuggestion[]>([]);
  const [tagHighlightIx, setTagHighlightIx] = useState(0);
  const tagInputRef = useRef<HTMLInputElement | null>(null);

  const busy = saving || deleting;
  const canSave = !busy;

  const showBodyHint = useMemo(() => editing && (initialBody ?? "").trim() !== body.trim(), [editing, initialBody, body]);

  const isPhoto = initialPostKind === "PHOTO" && !!initialMedia?.url;
  const mediaUrl: string | null = initialMedia?.url ?? null;

  useEffect(() => {
    if (!mention) return;

    const ac = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(mention.q)}`, {
          signal: ac.signal,
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed");
        const data = (await res.json()) as { users?: UserSuggestion[] };
        const users = Array.isArray(data.users) ? data.users : [];
        setSuggestions(users);
        setSuggestOpen(users.length > 0);
        setHighlightIx(0);
      } catch {
        // Ignore.
      }
    }, 120);

    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [mention]);

  useEffect(() => {
    if (!tagDraft || !tagSuggestOpen) return;
    const q = tagDraft.q.trim();
    if (!q.length) return;

    const ac = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, {
          signal: ac.signal,
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed");
        const data = (await res.json()) as { users?: UserSuggestion[] };
        const users = Array.isArray(data.users) ? data.users : [];
        setTagSuggestions(users);
        setTagHighlightIx(0);
      } catch {
        // Ignore.
      }
    }, 140);

    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [tagDraft?.q, tagSuggestOpen]);

  const pickMention = (u: UserSuggestion) => {
    if (!mention) return;
    const token = `@[${u.name}](${u.id})`;
    const before = body.slice(0, mention.atIndex);
    const after = body.slice(mention.caret);
    const next = `${before}${token} ${after}`;
    setBody(next);
    setSuggestOpen(false);
    setMention(null);
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      const pos = (before + token + " ").length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const pickPhotoTagUser = (u: UserSuggestion) => {
    if (!tagDraft) return;
    setPhotoTags((prev) => {
      if (prev.some((t) => t.userId === u.id)) return prev;
      const next: PhotoTag = {
        userId: u.id,
        name: u.name,
        x: clamp01(tagDraft.x),
        y: clamp01(tagDraft.y),
      };
      return [...prev, next].slice(0, 25);
    });
    setTagDraft(null);
    setTagSuggestOpen(false);
    setTagSuggestions([]);
  };

  const onSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const payload: { body: string; photoTags?: PhotoTag[] } = { body };
      if (isPhoto) payload.photoTags = photoTags;
      const res = await fetch(`/api/home-feed/post/${encodeURIComponent(postId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to update post");
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update post");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!confirm("Delete this post for everyone? This cannot be undone.")) return;
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/home-feed/post/${encodeURIComponent(postId)}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to delete post");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete post");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {!editing ? (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-ink-500 hover:text-ink-700"
            onClick={() => {
              setBody(initialBody ?? "");
              setMention(null);
              setSuggestions([]);
              setSuggestOpen(false);
              setHighlightIx(0);
              setTaggingEnabled(false);
              setPhotoTags(initialPhotoTags ?? []);
              setTagDraft(null);
              setTagSuggestOpen(false);
              setTagSuggestions([]);
              setTagHighlightIx(0);
              setEditing(true);
              setError(null);
            }}
            aria-label="Edit post"
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-red-600 hover:bg-red-50"
            onClick={onDelete}
            disabled={busy}
            aria-label="Delete post"
          >
            {deleting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
          </Button>
        </div>
      ) : (
        <div className="w-full">
          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setBody(initialBody ?? "");
                setMention(null);
                setSuggestions([]);
                setSuggestOpen(false);
                setTaggingEnabled(false);
                setPhotoTags(initialPhotoTags ?? []);
                setTagDraft(null);
                setTagSuggestOpen(false);
                setTagSuggestions([]);
                setError(null);
              }}
            >
              <X className="size-4" aria-hidden />
              Cancel
            </Button>
            <Button variant="primary" size="sm" className="h-8 px-3" disabled={!canSave} onClick={onSave}>
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
              Save
            </Button>
          </div>

          <div className="relative mt-2">
            <textarea
              ref={taRef}
              value={body}
              rows={3}
              onChange={(e) => {
                const next = e.target.value;
                setBody(next);
                const caret = e.target.selectionStart ?? next.length;
                const q = getMentionQuery(next, caret);
                if (!q) {
                  setMention(null);
                  setSuggestions([]);
                  setSuggestOpen(false);
                } else {
                  setMention(q);
                  setSuggestions([]);
                  setSuggestOpen(false);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSuggestOpen(false);
                  setMention(null);
                  return;
                }

                if (suggestOpen && suggestions.length > 0) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlightIx((x) => Math.min(x + 1, suggestions.length - 1));
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlightIx((x) => Math.max(x - 1, 0));
                    return;
                  }
                  if (e.key === "Enter") {
                    const u = suggestions[highlightIx];
                    if (u) {
                      e.preventDefault();
                      pickMention(u);
                    }
                  }
                }
              }}
              className={cn(
                "w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800",
                "placeholder:text-ink-400 outline-none transition-[box-shadow,border-color]",
                "focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-500/25",
              )}
              placeholder="Update your post… (tag people with @)"
            />

            {suggestOpen && suggestions.length > 0 && (
              <div className="absolute left-0 top-full z-30 mt-1 w-full rounded-lg border border-ink-100 bg-white shadow-lg shadow-ink-900/10 overflow-hidden">
                {suggestions.map((u, idx) => (
                  <button
                    key={u.id}
                    type="button"
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-ink-700 hover:bg-sky-50",
                      idx === highlightIx && "bg-sky-50",
                    )}
                    onMouseEnter={() => setHighlightIx(idx)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickMention(u)}
                  >
                    <Avatar src={u.image} name={u.name} size="xs" />
                    <span className="truncate">@{u.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {isPhoto && mediaUrl ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={!mediaUrl}
                  onClick={() => {
                    setTaggingEnabled((v) => !v);
                    setTagDraft(null);
                    setTagSuggestOpen(false);
                    setTagSuggestions([]);
                  }}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-colors",
                    taggingEnabled ? "border-sky-200 bg-sky-50 text-sky-700" : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50",
                  )}
                >
                  Tag people
                  {photoTags.length > 0 ? <span className="text-[11px] text-ink-400">({photoTags.length})</span> : null}
                </button>
                {photoTags.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoTags([]);
                      setTagDraft(null);
                      setTagSuggestOpen(false);
                      setTagSuggestions([]);
                    }}
                    className="inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-medium border border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
                  >
                    Clear tags
                  </button>
                ) : null}
                {taggingEnabled ? <span className="text-[11px] text-ink-400">Click on the photo to place a tag.</span> : null}
              </div>

              <div
                className={cn("relative rounded-xl border border-ink-100 overflow-hidden", taggingEnabled && "ring-2 ring-sky-500/15")}
                onClick={(e) => {
                  if (!taggingEnabled) return;
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const x = clamp01((e.clientX - rect.left) / rect.width);
                  const y = clamp01((e.clientY - rect.top) / rect.height);
                  setTagDraft({ x, y, q: "" });
                  setTagSuggestOpen(true);
                  setTagSuggestions([]);
                  setTagHighlightIx(0);
                  requestAnimationFrame(() => tagInputRef.current?.focus());
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl} alt="Post photo" className="max-h-64 w-full object-cover" />

                {photoTags.map((t) => (
                  <div
                    key={`${t.userId}-${t.x}-${t.y}`}
                    className="absolute pointer-events-none"
                    style={{
                      left: `${t.x * 100}%`,
                      top: `${t.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <div className="size-2.5 rounded-full bg-white ring-2 ring-sky-600 shadow-sm" />
                  </div>
                ))}

                {tagDraft && tagSuggestOpen ? (
                  <div
                    className="absolute z-30"
                    style={{
                      left: `${tagDraft.x * 100}%`,
                      top: `${tagDraft.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-64 rounded-lg border border-ink-100 bg-white shadow-lg shadow-ink-900/10 overflow-hidden">
                      <div className="p-2 border-b border-ink-100">
                        <input
                          ref={tagInputRef}
                          value={tagDraft.q}
                          onChange={(e) => {
                            const v = e.target.value;
                            setTagDraft((d) => (d ? { ...d, q: v } : d));
                            if (v.trim().length === 0) setTagSuggestions([]);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              setTagDraft(null);
                              setTagSuggestOpen(false);
                              setTagSuggestions([]);
                              return;
                            }
                            if (e.key === "Enter" && tagSuggestions.length > 0) {
                              const u = tagSuggestions[tagHighlightIx];
                              if (u) {
                                e.preventDefault();
                                pickPhotoTagUser(u);
                              }
                            }
                            if (e.key === "ArrowDown") {
                              e.preventDefault();
                              setTagHighlightIx((x) => Math.min(x + 1, Math.max(0, tagSuggestions.length - 1)));
                            }
                            if (e.key === "ArrowUp") {
                              e.preventDefault();
                              setTagHighlightIx((x) => Math.max(x - 1, 0));
                            }
                          }}
                          placeholder="Search people…"
                          className={cn(
                            "w-full rounded-md border border-ink-200 bg-white px-2.5 py-2 text-xs text-ink-800",
                            "placeholder:text-ink-400 outline-none transition-[box-shadow,border-color]",
                            "focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-500/25",
                          )}
                        />
                      </div>
                      {tagDraft.q.trim().length === 0 ? (
                        <div className="px-3 py-2 text-[11px] text-ink-500">Type to search, then press Enter.</div>
                      ) : tagSuggestions.length === 0 ? (
                        <div className="px-3 py-2 text-[11px] text-ink-500">No matches.</div>
                      ) : (
                        <div className="max-h-56 overflow-auto">
                          {tagSuggestions.map((u, idx) => (
                            <button
                              key={u.id}
                              type="button"
                              className={cn(
                                "w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-ink-700 hover:bg-sky-50",
                                idx === tagHighlightIx && "bg-sky-50",
                              )}
                              onMouseEnter={() => setTagHighlightIx(idx)}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => pickPhotoTagUser(u)}
                            >
                              <Avatar src={u.image} name={u.name} size="xs" />
                              <span className="truncate">{u.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              {photoTags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {photoTags.map((t) => (
                    <span
                      key={`chip-${t.userId}`}
                      className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[11px] text-ink-700"
                    >
                      <span className="truncate max-w-[12rem]">{t.name}</span>
                      <button
                        type="button"
                        className="text-ink-400 hover:text-ink-700"
                        onClick={() => setPhotoTags((prev) => prev.filter((x) => x.userId !== t.userId))}
                        aria-label={`Remove ${t.name}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {showBodyHint ? <div className="mt-1 text-[11px] text-ink-400">Edits will update the post for everyone.</div> : null}
          {error ? <div className="mt-2 text-xs text-red-600">{error}</div> : null}
        </div>
      )}
    </div>
  );
}

