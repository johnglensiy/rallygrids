import "server-only";
import { pool } from "@/lib/db/pool";

export async function getAllUsernames() {
  const { rows } = await pool.query("SELECT * FROM usernames");
  return rows;
}

export async function insertUsername(username: string) {
  await pool.query("INSERT INTO usernames (username) VALUES ($1)", [username]);
}
