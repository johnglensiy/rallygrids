"use client";
import { useState, Fragment } from "react";
import GuessModal from "../GuessModal";
import PlayerCell from "../PlayerCell";
import type { Player, GuessResult } from "../GameGrid";

type SandboxProps = {
  rows: string[];
  cols: string[];
  allPlayers: Player[];
};

const labelClass =
  "flex items-center justify-center text-center text-sm sm:text-base font-semibold p-2 rounded-lg outline-none hover:bg-neutral-100 focus:bg-neutral-100 cursor-text";

export default function Sandbox({ rows, cols, allPlayers }: SandboxProps) {
  const [puzzle, setPuzzle] = useState<{ rows: string[]; cols: string[] }>({
    rows,
    cols,
  });
  const [cellSelected, setCellSelected] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [gridValues, setGridValues] = useState<Array<Player | null>>(
    Array(9).fill(null),
  );

  // labels are contentEditable and only committed on blur, so React doesn't
  // re-render mid-typing and jump the caret
  function setLabel(axis: "rows" | "cols", index: number, value: string) {
    setPuzzle((prev) => ({
      ...prev,
      [axis]: prev[axis].map((v, i) => (i === index ? value : v)),
    }));
  }

  async function handleGuess(playerId: number): Promise<GuessResult> {
    const thisPlayer = allPlayers.find((p) => p.id === playerId);
    if (!thisPlayer || !cellSelected) return "error";

    // no server check: the labels are made up, so every guess fills the cell
    const thisIndex = cellSelected.row * 3 + cellSelected.col;
    setGridValues((prev) =>
      prev.map((v, i) => (i === thisIndex ? thisPlayer : v)),
    );
    return "correct";
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-2 sm:gap-3 aspect-square w-[min(100%,42rem,calc(100dvh-2rem))]">
        <div />
        {/* index keys: label text changes on edit, which would remount the cells */}
        {puzzle.cols.map((col, j) => (
          <div
            key={j}
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) =>
              setLabel("cols", j, e.currentTarget.textContent ?? "")
            }
            className={labelClass}
          >
            {col}
          </div>
        ))}
        {puzzle.rows.map((row, i) => (
          <Fragment key={i}>
            <div
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) =>
                setLabel("rows", i, e.currentTarget.textContent ?? "")
              }
              className={labelClass}
            >
              {row}
            </div>
            {puzzle.cols.map((col, j) => (
              <div
                key={j}
                className="relative overflow-hidden rounded-lg border-2 border-neutral-300 bg-white hover:bg-neutral-100 cursor-pointer aspect-square"
                onClick={() => setCellSelected({ row: i, col: j })}
              >
                {gridValues[i * 3 + j] && (
                  <PlayerCell player={gridValues[i * 3 + j]!} />
                )}
              </div>
            ))}
          </Fragment>
        ))}
      </div>
      {cellSelected && (
        <GuessModal
          allPlayers={allPlayers}
          rowLabel={puzzle.rows[cellSelected.row]}
          colLabel={puzzle.cols[cellSelected.col]}
          onClose={() => setCellSelected(null)}
          onSelectPlayer={handleGuess}
        />
      )}
    </>
  );
}
