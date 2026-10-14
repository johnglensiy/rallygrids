// Dev-only route: only a page when SANDBOX=1 (see pageExtensions in next.config.ts),
// so production builds never bundle it.
import Sandbox from "./Sandbox";
import CategoryPicker from "./CategoryPicker";
import { getAllPlayers } from "@/server/players";

export default async function SandboxPage() {
  const players = await getAllPlayers();
  return (
    <main className="flex flex-1 flex-col items-center justify-center-safe gap-6 p-4">
      <Sandbox
        rows={["Grand Slam winner", "Left-handed", "Born in Spain"]}
        cols={["Wimbledon finalist", "Former world #1", "Olympic medalist"]}
        allPlayers={players}
      />
      <CategoryPicker />
    </main>
  );
}
