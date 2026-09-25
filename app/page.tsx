import Image from "next/image";
import GameGrid from "./GameGrid";
import { getAllPlayers } from "@/server/players";

export default async function Home() {
  const players = await getAllPlayers();
  return (
    <GameGrid
      rows={["Grand Slam winner", "Left-handed", "Born in Spain"]}
      cols={["Wimbledon finalist", "Former world #1", "Olympic medalist"]}
    />
  );
}
