import GameGrid from "./GameGrid";
import { getAllPlayers } from "@/server/players";

export default async function Home() {
  const players = await getAllPlayers();
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <GameGrid
        rows={["Grand Slam winner", "Left-handed", "Born in Spain"]}
        cols={["Wimbledon finalist", "Former world #1", "Olympic medalist"]}
        allPlayers={players}
      />
    </main>
  );
}
