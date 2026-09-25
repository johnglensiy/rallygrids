// components/game-grid.tsx
"use client";
import { useState, useEffect, Fragment } from "react";

type GameGridProps = {
  rows: string[];
  cols: string[];
};

type Puzzle = { 
  id: number; 
  rows: string[];
  cols: string[] 
};

export default function GameGrid({ rows, cols }: GameGridProps) {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);

  useEffect(() => {
    const loadPuzzle = async () => {
      try {
        const res = await fetch("/api/puzzles");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setPuzzle(await res.json());
        console.log("this is the puzzle obj", puzzle);
      } catch (err) {
        console.error(err);
      }
    }
    loadPuzzle();
  }, []);

  if (!puzzle) return <p>Loading...</p>;
  return (
    <div className="grid grid-cols-4 gap-2 w-full max-w-md aspect-square">
      <div />
      {puzzle.cols.map((col) => (
        <div
          key={col}
          className="flex items-center justify-center text-center text-sm font-semibold p-2"
        >
          {col}
        </div>
      ))}
      {puzzle.rows.map((row) => (
        <Fragment key={row}>
          <div className="flex items-center justify-center text-center text-sm font-semibold p-2">
            {row}
          </div>
          {puzzle.cols.map((col) => (
            <div
              key={`${row}-${col}`}
              className="rounded-lg border-2 border-neutral-300 bg-white hover:bg-neutral-100 cursor-pointer aspect-square"
            />
          ))}
        </Fragment>
      ))}
    </div>
  );
}
