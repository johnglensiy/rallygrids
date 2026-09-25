import "server-only";
import { pool } from "@/lib/db/pool";

export type Player = {
    id: number;
    name: string;
    tour: string;
    country: string;
}

function dataToPlayers(rows: any): Player[] {
    const allPlayers = rows.map((row: any) => {
            return {
                id: row.id,
                name: row.name,
                tour: row.tour,
                country: row.country,
            } as Player
        });
    return allPlayers;
}

export async function getAllPlayers() {
    const { rows } = await pool.query("SELECT * FROM players");
    return dataToPlayers(rows);
}