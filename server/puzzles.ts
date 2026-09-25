import "server-only";
import { pool } from "@/lib/db/pool";

export async function getPuzzle() {
    const { rows } = await pool.query("SELECT * FROM puzzles ORDER BY id DESC LIMIT 1");
    return rows[0];
}   