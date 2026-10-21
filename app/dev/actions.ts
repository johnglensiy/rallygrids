"use server";
// Only imported by the sandbox, so it isn't bundled outside SANDBOX=1. Server
// functions are reachable by direct POST though, so check the flag anyway.
import type { CategorySelection } from "@/lib/categories";
import { getMatchingPlayers } from "@/server/categories";
import type { Player } from "@/server/players";

export type CategoryTestResult =
  { ok: true; players: Player[] } | { ok: false; error: string };

export async function testCategory(
  selection: CategorySelection,
): Promise<CategoryTestResult> {
  if (process.env.SANDBOX !== "1") return { ok: false, error: "Not found" };
  try {
    return { ok: true, players: await getMatchingPlayers([selection]) };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
