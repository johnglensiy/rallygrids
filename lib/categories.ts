// Category definitions shared by the picker (client) and the SQL mapping in
// server/categories.ts, which keys off these ids.

export type NumberParam = {
  kind: "number";
  label: string;
  default: number;
  min: number;
  max: number;
};

export type ChoiceParam = {
  kind: "choice";
  label: string;
  default: string;
  // label is what goes into the category's text, e.g. "Won" for "W"
  options: readonly { value: string; label: string }[];
};

export type CategoryParam = NumberParam | ChoiceParam;

export type ParamValue = number | string;

export type Category = {
  id: string;
  // what the picker lists; defaults to label
  name?: string;
  // "{key}" marks where params[key] goes
  label: string;
  group: string;
  params?: Readonly<Record<string, CategoryParam>>;
};

export type CategorySelection = {
  // a plain string since selections come back from the client;
  // server/categories.ts checks it against CategoryId
  id: string;
  params?: Record<string, ParamValue>;
};

const TOURNAMENTS = [
  { value: "any", label: "a Grand Slam" },
  { value: "AO", label: "the Australian Open" },
  { value: "RG", label: "Roland Garros" },
  { value: "WIM", label: "Wimbledon" },
  { value: "USO", label: "the US Open" },
] as const;

// only the rounds the tournaments table tracks
const ROUNDS = [
  { value: "W", label: "Won" },
  { value: "F", label: "Reached the final of" },
  { value: "SF", label: "Reached the semis of" },
  { value: "QF", label: "Reached the quarters of" },
] as const;

const tournament = (fallback: string): ChoiceParam => ({
  kind: "choice",
  label: "Tournament",
  default: fallback,
  options: TOURNAMENTS,
});

const round: ChoiceParam = {
  kind: "choice",
  label: "Result",
  default: "W",
  options: ROUNDS,
};

const year: NumberParam = {
  kind: "number",
  label: "Year",
  default: 2026,
  min: 1968,
  max: 2026,
};

export const CATEGORIES = [
  { id: "atp", label: "ATP", group: "Tour" },
  { id: "wta", label: "WTA", group: "Tour" },
  { id: "atp-wta", label: "ATP/WTA", group: "Tour" },
  { id: "active-2026", label: "Active in 2026", group: "Career" },
  {
    id: "top-n",
    name: "Top N player",
    label: "Top {n} player",
    group: "Ranking",
    params: {
      n: { kind: "number", label: "N", default: 50, min: 1, max: 1000 },
    },
  },
  { id: "former-no1", label: "Former world #1", group: "Ranking" },
  { id: "gs-winner", label: "Grand Slam winner", group: "Results" },
  { id: "wimbledon-finalist", label: "Wimbledon finalist", group: "Results" },
  { id: "gs-qf-2026", label: "2026 Grand Slam QF", group: "Results" },
  {
    id: "tournament-result",
    name: "Result at a tournament",
    label: "{round} {tournament} in {year}",
    group: "Results",
    params: { round, tournament: tournament("WIM"), year },
  },
  {
    id: "tournament-tally",
    name: "Career results at a tournament",
    label: "{round} {tournament} {count}+ times",
    group: "Results",
    params: {
      round,
      tournament: tournament("RG"),
      count: { kind: "number", label: "At least", default: 5, min: 1, max: 30 },
    },
  },
  {
    id: "in-draw",
    name: "Played a tournament",
    label: "Played {tournament} in {year}",
    group: "Results",
    params: { tournament: tournament("WIM"), year },
  },
  { id: "olympic-medalist", label: "Olympic medalist", group: "Results" },
  {
    id: "match-stat",
    name: "Stat in a single match",
    label: "{count}+ {stat} in a match",
    group: "Match stats",
    params: {
      count: {
        kind: "number",
        label: "At least",
        default: 20,
        min: 1,
        max: 200,
      },
      stat: {
        kind: "choice",
        label: "Stat",
        default: "aces",
        options: [
          { value: "aces", label: "aces" },
          { value: "double_faults", label: "double faults" },
        ],
      },
    },
  },
  { id: "usa", label: "United States", group: "Country" },
  { id: "spain", label: "Born in Spain", group: "Country" },
  { id: "left-handed", label: "Left-handed", group: "Playing style" },
  {
    id: "backhand",
    name: "Backhand",
    label: "{backhand} backhand",
    group: "Playing style",
    params: {
      backhand: {
        kind: "choice",
        label: "Backhand",
        default: "one",
        options: [
          { value: "one", label: "One-handed" },
          { value: "two", label: "Two-handed" },
        ],
      },
    },
  },
] as const satisfies readonly Category[];

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export function getCategory(id: string): Category | undefined {
  return (CATEGORIES as readonly Category[]).find((c) => c.id === id);
}

export const categoryName = (c: Category) => c.name ?? c.label;

export function defaultParams(c: Category): Record<string, ParamValue> {
  return Object.fromEntries(
    Object.entries(c.params ?? {}).map(([key, p]) => [key, p.default]),
  );
}

// Checks every param is present and allowed; missing ones are an error rather
// than defaulted, so a half-filled form can't slip through
export function validateParams(
  c: Category,
  values: Record<string, ParamValue> = {},
):
  | { ok: true; values: Record<string, ParamValue> }
  | { ok: false; error: string } {
  const out: Record<string, ParamValue> = {};
  for (const [key, p] of Object.entries(c.params ?? {})) {
    const v = values[key];
    if (p.kind === "number") {
      if (
        typeof v !== "number" ||
        !Number.isInteger(v) ||
        v < p.min ||
        v > p.max
      )
        return {
          ok: false,
          error: `${p.label}: enter a whole number from ${p.min} to ${p.max}`,
        };
    } else if (!p.options.some((o) => o.value === v)) {
      return { ok: false, error: `Pick a ${p.label.toLowerCase()}` };
    }
    out[key] = v;
  }
  return { ok: true, values: out };
}

function paramText(p: CategoryParam, v: ParamValue | undefined): string {
  const value = v ?? p.default;
  if (p.kind === "number") return String(value);
  return p.options.find((o) => o.value === value)?.label ?? "";
}

export function formatCategory({ id, params }: CategorySelection): string {
  const c = getCategory(id);
  if (!c) return "";
  const text = c.label.replace(/\{(\w+)\}/g, (_, key: string) =>
    c.params?.[key] ? paramText(c.params[key], params?.[key]) : "",
  );
  // labels can start with an option like "a Grand Slam"
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// inverse of formatCategory, so a label's text can preselect the picker
export function parseCategory(label: string): CategorySelection | null {
  for (const c of CATEGORIES as readonly Category[]) {
    if (!c.params) {
      if (c.label === label) return { id: c.id };
      continue;
    }
    const keys: string[] = [];
    const pattern = c.label
      .split(/(\{\w+\})/)
      .map((part) => {
        const key = part.match(/^\{(\w+)\}$/)?.[1];
        const p = key && c.params?.[key];
        if (!key || !p) return escapeRegExp(part);
        keys.push(key);
        return p.kind === "number"
          ? "(\\d+)"
          : `(${p.options.map((o) => escapeRegExp(o.label)).join("|")})`;
      })
      .join("");
    // case-insensitive since formatCategory capitalises the first letter
    const match = label.match(new RegExp(`^${pattern}$`, "i"));
    if (!match) continue;

    const params: Record<string, ParamValue> = {};
    keys.forEach((key, i) => {
      const p = c.params![key];
      const text = match[i + 1];
      params[key] =
        p.kind === "number"
          ? Number(text)
          : p.options.find((o) => o.label.toLowerCase() === text.toLowerCase())!
              .value;
    });
    return { id: c.id, params };
  }
  return null;
}
