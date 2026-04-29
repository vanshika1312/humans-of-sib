"use client";

import { useState, useTransition } from "react";

const COLORS = [
  { id: "green", label: "Green",  dot: "bg-green-500" },
  { id: "red",   label: "Red",    dot: "bg-red-500"   },
  { id: "amber", label: "Amber",  dot: "bg-amber-400" },
  { id: "blue",  label: "Blue",   dot: "bg-blue-500"  },
  { id: "gray",  label: "Gray",   dot: "bg-ink-400"   },
];

const BADGE: Record<string, string> = {
  green: "bg-green-50 text-green-700",
  red:   "bg-red-50 text-red-600",
  amber: "bg-amber-50 text-amber-700",
  blue:  "bg-blue-50 text-blue-700",
  gray:  "bg-ink-50 text-ink-500",
};

type Option = { id: string; label: string; color: string; order?: number };

export function EligibilityOptionManager({
  options,
  upsertAction,
  deleteAction,
}: {
  options: Option[];
  upsertAction: (fd: FormData) => Promise<void>;
  deleteAction: (fd: FormData) => Promise<void>;
}) {
  const [editing,  setEditing]  = useState<Option | null>(null);
  const [showAdd,  setShowAdd]  = useState(false);
  const [pending,  start]       = useTransition();

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      await upsertAction(fd);
      setEditing(null);
      setShowAdd(false);
    });
  }

  function del(id: string) {
    if (!confirm("Delete this option? It will be removed from all sheets.")) return;
    const fd = new FormData();
    fd.set("id", id);
    start(() => deleteAction(fd));
  }

  const isFormOpen = showAdd || !!editing;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink-700">Eligibility Options</h3>
          <p className="text-xs text-ink-400 mt-0.5">Define statuses the Sales Head can assign to each counsellor</p>
        </div>
        {!isFormOpen && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="h-7 px-3 rounded-md bg-ink-700 text-white text-xs font-medium hover:bg-ink-600 transition-colors"
          >
            + Add Option
          </button>
        )}
      </div>

      {/* Existing options */}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <div
            key={o.id}
            className={`flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-semibold ${BADGE[o.color] ?? BADGE.gray}`}
          >
            <span>{o.label}</span>
            <button
              type="button"
              title="Edit"
              onClick={() => { setEditing(o); setShowAdd(false); }}
              className="opacity-50 hover:opacity-100 transition-opacity px-1"
            >
              ✏
            </button>
            <button
              type="button"
              title="Delete"
              onClick={() => del(o.id)}
              className="opacity-50 hover:opacity-100 transition-opacity px-1"
            >
              ✕
            </button>
          </div>
        ))}
        {options.length === 0 && !isFormOpen && (
          <p className="text-xs text-ink-400 italic">No options yet — add your first one above.</p>
        )}
      </div>

      {/* Add / Edit form */}
      {isFormOpen && (
        <form onSubmit={save} className="flex items-end gap-3 flex-wrap p-4 bg-ink-50 border border-ink-100 rounded-xl">
          {editing && <input type="hidden" name="id" value={editing.id} />}

          <div>
            <label className="block text-[10px] text-ink-400 uppercase tracking-wide font-medium mb-1">Label</label>
            <input
              name="label"
              required
              defaultValue={editing?.label ?? ""}
              placeholder="e.g. Eligible"
              className="h-8 px-3 border border-ink-200 rounded-md text-sm bg-white focus:outline-none focus:border-orange-400 w-36"
            />
          </div>

          <div>
            <label className="block text-[10px] text-ink-400 uppercase tracking-wide font-medium mb-1">Color</label>
            <select
              name="color"
              defaultValue={editing?.color ?? "green"}
              className="h-8 px-2 border border-ink-200 rounded-md text-sm bg-white focus:outline-none cursor-pointer"
            >
              {COLORS.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-ink-400 uppercase tracking-wide font-medium mb-1">Order</label>
            <input
              name="order"
              type="number"
              defaultValue={editing?.order ?? options.length}
              className="h-8 px-3 border border-ink-200 rounded-md text-sm bg-white focus:outline-none w-16"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="h-8 px-4 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {editing ? "Update" : "Add"}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(null); setShowAdd(false); }}
            className="h-8 px-3 rounded-md border border-ink-200 text-sm text-ink-500 hover:bg-ink-100 transition-colors"
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
