"use client";
import { useState } from "react";

export type Category = {
  id: string;
  label: string;
  group: string;
};

// placeholder until valid categories come from server logic
const SAMPLE_CATEGORIES: Category[] = [
  { id: "atp", label: "ATP", group: "Tour" },
  { id: "wta", label: "WTA", group: "Tour" },
  { id: "active-2026", label: "Active in 2026", group: "Career" },
  { id: "top-50", label: "Top 50 player", group: "Ranking" },
  { id: "former-no1", label: "Former world #1", group: "Ranking" },
  { id: "gs-winner", label: "Grand Slam winner", group: "Results" },
  { id: "wimbledon-finalist", label: "Wimbledon finalist", group: "Results" },
  { id: "gs-qf-2026", label: "2026 Grand Slam QF", group: "Results" },
  { id: "olympic-medalist", label: "Olympic medalist", group: "Results" },
  { id: "usa", label: "United States", group: "Country" },
  { id: "spain", label: "Born in Spain", group: "Country" },
  { id: "left-handed", label: "Left-handed", group: "Playing style" },
];

type CategoryPickerProps = {
  categories?: Category[];
  onChange?: (selectedIds: string[]) => void;
};

export default function CategoryPicker({
  categories = SAMPLE_CATEGORIES,
  onChange,
}: CategoryPickerProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  function update(next: string[]) {
    setSelected(next);
    onChange?.(next);
  }

  function toggle(id: string) {
    update(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id],
    );
  }

  const q = query.trim().toLowerCase();
  const visible = q
    ? categories.filter(
        (c) =>
          c.label.toLowerCase().includes(q) ||
          c.group.toLowerCase().includes(q),
      )
    : categories;

  // groups keep the order they first appear in
  const groups = new Map<string, Category[]>();
  for (const c of visible) {
    groups.set(c.group, [...(groups.get(c.group) ?? []), c]);
  }

  return (
    <div className="w-full max-w-2xl rounded-xl bg-white p-4 text-neutral-900 shadow-xl">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Categories</h2>
        <div className="flex items-baseline gap-3 text-sm text-neutral-500">
          <span>
            {selected.length} of {categories.length} selected
          </span>
          <button
            type="button"
            onClick={() => update([])}
            disabled={selected.length === 0}
            className="font-medium text-neutral-700 hover:text-neutral-900 disabled:cursor-default disabled:text-neutral-300"
          >
            Clear
          </button>
        </div>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter categories…"
        className="mb-4 w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
      />

      {groups.size === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-500">
          No categories match “{query.trim()}”
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {[...groups].map(([group, items]) => (
            <section key={group}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {group}
              </h3>
              <div className="flex flex-wrap gap-2">
                {items.map((c) => {
                  const isSelected = selected.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggle(c.id)}
                      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                        isSelected
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : "border-neutral-300 hover:bg-neutral-100"
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
