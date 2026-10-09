import { getPuzzle } from "@/server/puzzles";

export async function GET() {
  const p = await getPuzzle();
  if (!p) return Response.json({ error: "no puzzle" }, { status: 404 });
  return Response.json({
    id: p.id,
    rows: [p.row_1, p.row_2, p.row_3],
    cols: [p.col_1, p.col_2, p.col_3],
  });
}
