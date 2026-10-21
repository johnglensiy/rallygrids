"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  CATEGORIES,
  categoryName,
  defaultParams,
  formatCategory,
  validateParams,
  type Category,
  type CategorySelection,
  type ParamValue,
} from "@/lib/categories";
import { testCategory, type CategoryTestResult } from "./actions";

export { formatCategory, parseCategory } from "@/lib/categories";

type CategoryPickerProps = {
  categories?: readonly Category[];
  initialSelected?: CategorySelection | null;
  onSelect: (selection: CategorySelection) => void;
  onClose: () => void;
};

// the category being looked at; values are kept as typed so a number input
// can be empty mid-edit
type Draft = { id: string; values: Record<string, string> };

const fieldClass =
  "rounded-lg border border-neutral-300 px-3 py-1.5 outline-none focus:border-neutral-500";

export default function CategoryPicker({
  categories = CATEGORIES,
  initialSelected = null,
  onSelect,
  onClose,
}: CategoryPickerProps) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<Draft | null>(null);
  const [result, setResult] = useState<CategoryTestResult | null>(null);
  const [testing, startTest] = useTransition();
  // bumped whenever the selection changes, so a slow test can't show results
  // for an earlier one
  const testId = useRef(0);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function show(next: Draft | null) {
    testId.current++;
    setChosen(next);
    setResult(null);
  }

  function pick(c: Category) {
    // reopen with the label's current values when it's this category
    const values = {
      ...defaultParams(c),
      ...(initialSelected?.id === c.id ? initialSelected.params : {}),
    };
    show({
      id: c.id,
      values: Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, String(v)]),
      ),
    });
  }

  const category = chosen && categories.find((c) => c.id === chosen.id);

  if (chosen && category) {
    const params = Object.entries(category.params ?? {});
    const typed: Record<string, ParamValue> = Object.fromEntries(
      params.map(([key, p]) => {
        const raw = chosen.values[key] ?? "";
        return [
          key,
          p.kind === "number" ? (raw === "" ? NaN : Number(raw)) : raw,
        ];
      }),
    );
    const checked = validateParams(category, typed);
    const selection: CategorySelection = {
      id: category.id,
      ...(checked.ok && params.length > 0 && { params: checked.values }),
    };

    function runTest() {
      const id = ++testId.current;
      startTest(async () => {
        const res = await testCategory(selection);
        if (id === testId.current) setResult(res);
      });
    }

    return (
      <Overlay onClose={onClose}>
        <button
          type="button"
          onClick={() => show(null)}
          className="mb-3 text-sm font-medium text-neutral-500 hover:text-neutral-900"
        >
          ← All categories
        </button>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {category.group}
        </p>
        <h2 className="mb-4 text-lg font-semibold">
          {checked.ok ? formatCategory(selection) : categoryName(category)}
        </h2>

        {params.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-4">
            {params.map(([key, p], i) => (
              <label key={key} className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-500">
                  {p.label}
                  {p.kind === "number" && ` (${p.min}–${p.max})`}
                </span>
                {p.kind === "number" ? (
                  <input
                    autoFocus={i === 0}
                    type="number"
                    min={p.min}
                    max={p.max}
                    step={1}
                    value={chosen.values[key] ?? ""}
                    onChange={(e) =>
                      show({
                        id: category.id,
                        values: { ...chosen.values, [key]: e.target.value },
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && checked.ok) runTest();
                    }}
                    className={`w-28 ${fieldClass}`}
                  />
                ) : (
                  <select
                    autoFocus={i === 0}
                    value={chosen.values[key] ?? ""}
                    onChange={(e) =>
                      show({
                        id: category.id,
                        values: { ...chosen.values, [key]: e.target.value },
                      })
                    }
                    className={`bg-white ${fieldClass}`}
                  >
                    {p.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            ))}
          </div>
        )}
        {!checked.ok && (
          <p className="mb-4 text-sm text-red-700">{checked.error}</p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={runTest}
            disabled={!checked.ok || testing}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100 disabled:cursor-default disabled:text-neutral-300 disabled:hover:bg-transparent"
          >
            {testing ? "Testing…" : "Test"}
          </button>
          <button
            type="button"
            onClick={() => {
              onSelect(selection);
              onClose();
            }}
            disabled={!checked.ok}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:bg-neutral-300"
          >
            Use category
          </button>
        </div>

        {result && !result.ok && (
          <p className="mt-4 text-sm text-red-700">{result.error}</p>
        )}
        {result?.ok && (
          <div className="mt-4">
            <p className="mb-2 text-sm text-neutral-500">
              {result.players.length}{" "}
              {result.players.length === 1
                ? "player qualifies"
                : "players qualify"}
            </p>
            {result.players.length > 0 && (
              <ul className="max-h-72 overflow-y-auto rounded-lg border border-neutral-200 text-sm">
                {result.players.map((p) => (
                  <li
                    key={p.id}
                    className="flex justify-between gap-2 border-b border-neutral-100 px-3 py-1.5 last:border-b-0"
                  >
                    <span>{p.name}</span>
                    <span className="text-neutral-500">
                      {p.tour} · {p.country}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Overlay>
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
    <Overlay onClose={onClose}>
      <h2 className="mb-3 text-lg font-semibold">Choose a category</h2>

      <input
        autoFocus
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
                  const isSelected = initialSelected?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => pick(c)}
                      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                        isSelected
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : "border-neutral-300 hover:bg-neutral-100"
                      }`}
                    >
                      {categoryName(c)}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </Overlay>
  );
}

function Overlay({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm px-4 pt-24"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl bg-white p-4 text-neutral-900 shadow-xl"
        onClick={(e) => e.stopPropagation()} // clicks inside the panel don't close it
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
}
