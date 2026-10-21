import "server-only";
import { pool } from "@/lib/db/pool";
import type { Player } from "@/server/players";
import {
  getCategory,
  validateParams,
  type CategoryId,
  type CategorySelection,
  type ParamValue,
} from "@/lib/categories";

// Builds a WHERE condition on `players p` from already-validated params.
// Values go through `param`, which adds them to the query's parameters and
// returns their placeholder ($1, ...).
type ConditionBuilder = (
  values: Record<string, ParamValue>,
  param: (value: unknown) => string,
) => string;

// tournaments stores each round's players, with later rounds included in
// earlier ones (the winner is also a finalist, semifinalist, ...)
const ROUND_CONDITION: Record<string, string> = {
  W: "t.winner = p.id",
  F: "p.id = ANY (t.finalists)",
  SF: "p.id = ANY (t.semifinalists)",
  QF: "p.id = ANY (t.quarterfinalists)",
};

function tournamentCondition(
  values: Record<string, ParamValue>,
  param: (value: unknown) => string,
) {
  const where = [ROUND_CONDITION[values.round]];
  if (values.tournament !== "any") {
    where.push(`t.short_name = ${param(values.tournament)}`);
  }
  return where.join(" AND ");
}

const slamReached = (round: string, where = "TRUE") =>
  `EXISTS (SELECT 1 FROM tournaments t
           WHERE ${where} AND p.id = ANY (t.${round}))`;

// null means the database has no data for it yet, so the category can't be
// checked
const CATEGORY_SQL: Record<CategoryId, ConditionBuilder | null> = {
  atp: () => `p.tour = 'ATP'`,
  wta: () => `p.tour = 'WTA'`,
  "atp-wta": () => `p.tour IN ('ATP', 'WTA')`,
  "active-2026": () => `p.active_2026`,
  "top-n": ({ n }, param) => `p.current_rank <= ${param(n)}`,
  "former-no1": null,
  // tournaments only holds 2026 so far, so this is "won a 2026 Slam"
  "gs-winner": () =>
    `EXISTS (SELECT 1 FROM tournaments t WHERE t.winner = p.id)`,
  "wimbledon-finalist": () => slamReached("finalists", `t.short_name = 'WIM'`),
  "gs-qf-2026": () => slamReached("quarterfinalists", `t.year = 2026`),
  "tournament-result": (values, param) =>
    `EXISTS (SELECT 1 FROM tournaments t
             WHERE ${tournamentCondition(values, param)}
               AND t.year = ${param(values.year)})`,
  // tournaments only holds 2026 so far, so counts above 1 match nobody yet
  "tournament-tally": (values, param) =>
    `(SELECT count(*) FROM tournaments t
      WHERE ${tournamentCondition(values, param)}) >= ${param(values.count)}`,
  // tournaments only stores the quarterfinals onwards, not the whole draw
  "in-draw": null,
  "olympic-medalist": null,
  // no per-match stats are stored
  "match-stat": null,
  usa: () => `p.country = 'USA'`,
  // players.country is who they represent, not where they were born
  spain: () => `p.country = 'ESP'`,
  "left-handed": null,
  backhand: null,
};

export function isCategorySupported(id: string): boolean {
  return Boolean(CATEGORY_SQL[id as CategoryId]);
}

// Turns picker selections into one WHERE clause (ANDed) plus its parameters
export function categoriesToSQL(selections: CategorySelection[]): {
  where: string;
  params: unknown[];
} {
  const params: unknown[] = [];
  const param = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  const conditions = selections.map(({ id, params: values }) => {
    const category = getCategory(id);
    const build = CATEGORY_SQL[id as CategoryId];
    if (!category || !build) throw new Error(`Unsupported category: ${id}`);

    const checked = validateParams(category, values);
    if (!checked.ok) throw new Error(checked.error);
    return `(${build(checked.values, param)})`;
  });

  return { where: conditions.join(" AND ") || "TRUE", params };
}

// Every player matching all the given categories, e.g. a grid cell's row and
// column
export async function getMatchingPlayers(
  selections: CategorySelection[],
): Promise<Player[]> {
  const { where, params } = categoriesToSQL(selections);
  const { rows } = await pool.query<Player>(
    `SELECT p.id, p.name, p.tour, p.country FROM players p
        WHERE ${where} ORDER BY p.name`,
    params,
  );
  return rows;
}

export async function getMatchingPlayerIds(
  selections: CategorySelection[],
): Promise<number[]> {
  return (await getMatchingPlayers(selections)).map((p) => p.id);
}
