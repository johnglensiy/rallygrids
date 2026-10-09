import "server-only";
import { pool } from "@/lib/db/pool";

export async function checkAnswer(
  puzzleId: number,
  row: number,
  col: number,
  playerId: number,
) {
  // would it be prudent to not directly input ID
  console.log({ puzzleId, row, col, playerId });
  const { rows } = await pool.query(
    `SELECT answer_ids 
        FROM puzzle_cells 
        WHERE puzzle_id = $1 AND row_pos = $2 AND col_pos = $3`,
    [puzzleId, row + 1, col + 1],
  );

  console.log(rows);
  const guessIsCorrect: boolean =
    rows[0]?.answer_ids.includes(playerId) ?? false;
  return guessIsCorrect;
}
