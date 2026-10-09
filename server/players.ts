import "server-only";
import { pool } from "@/lib/db/pool";

export type Player = {
  id: number;
  name: string;
  tour: string;
  country: string;
};

export async function getAllPlayers(): Promise<Player[]> {
  const { rows } = await pool.query<Player>(
    "SELECT id, name, tour, country FROM players",
  );
  return rows;
}
export type PlayerHeadshot = {
  image: Buffer;
  mimeType: string;
  updatedAt: Date;
};

// Headshots come from tools/photo-picker and are keyed by player name
export async function getPlayerHeadshot(
  playerId: number,
): Promise<PlayerHeadshot | null> {
  const { rows } = await pool.query(
    `SELECT h.image, h.mime_type, h.updated_at
        FROM player_headshots h
        JOIN players p ON p.name = h.player_name
        WHERE p.id = $1 AND h.status = 'picked'`,
    [playerId],
  );
  if (!rows[0]) return null;
  return {
    image: rows[0].image,
    mimeType: rows[0].mime_type,
    updatedAt: rows[0].updated_at,
  };
}
