import Image from "next/image";
import GameGrid from "./GameGrid";

export default function Home() {
  return (
    <GameGrid
      rows={["Grand Slam winner", "Left-handed", "Born in Spain"]}
      cols={["Wimbledon finalist", "Former world #1", "Olympic medalist"]}
    />
  );
}
