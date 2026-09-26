// components/game-grid.tsx
"use client";
import { useState, useEffect, Fragment } from "react";
import GuessModal from "./GuessModal";

type Puzzle = { 
  id: number; 
  rows: string[];
  cols: string[] 
};

export type Player = {
    id: number;
    name: string;
    tour: string;
    country: string;
}

type GameGridProps = {
  rows: string[];
  cols: string[];
  allPlayers: Player[];
};

export default function GameGrid({ rows, cols, allPlayers }: GameGridProps) {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [cellSelected, setCellSelected] = useState<{ row: number; col: number} | null>(null);
  const [gridValues, setGridValues] = useState<Array<string>>(['', '', '', '', '', '', '', '', '']);

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

  function handleGuess(playerId: number) {
    // set gridValues[cellSelected] to the player's name
    const thisPlayer = allPlayers.find((p) => p.id === playerId) // set a guard
    if (!thisPlayer) return;
    console.log(thisPlayer.name);

    if (!cellSelected) return;
    const thisIndex = cellSelected.row * 3 + cellSelected.col;
    setGridValues((prev) => prev.map((v, i) => (i === thisIndex ? thisPlayer.name : v)))
  }

  if (!puzzle) return <p>Loading...</p>;
  return (
    <>
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
        {puzzle.rows.map((row, i) => (
          <Fragment key={row}>
            <div className="flex items-center justify-center text-center text-sm font-semibold p-2">
              {row}
            </div>
            {puzzle.cols.map((col, j) => (
              <div
                key={`${row}-${col}`}
                className="rounded-lg border-2 border-neutral-300 bg-white hover:bg-neutral-100 cursor-pointer aspect-square"
                onClick={() => {
                  setCellSelected({ row: i, col: j})
                  console.log("selected row is", rows[i])
                  console.log("selected col is", cols[j])
                }}    
              >
                {gridValues[i*3+j]}
              </div>
            ))}
          </Fragment>
        ))}
      </div>
      { cellSelected && 
        <GuessModal 
          allPlayers={allPlayers}
          rowLabel={rows[cellSelected.row]}
          colLabel={cols[cellSelected.col]}
          onClose={() => setCellSelected(null)}
          onSelectPlayer={handleGuess}
        /> 
      }
    </>
  );
}
