// components/game-grid.tsx
import { Fragment } from "react";

type GameGridProps = {
  rows: string[];
  cols: string[];
};

export default function GameGrid({ rows, cols }: GameGridProps) {
  return (
    <div className="grid grid-cols-4 gap-2 w-full max-w-md aspect-square">
      <div />
      {cols.map((col) => (
        <div
          key={col}
          className="flex items-center justify-center text-center text-sm font-semibold p-2"
        >
          {col}
        </div>
      ))}
      {rows.map((row) => (
        <Fragment key={row}>
          <div className="flex items-center justify-center text-center text-sm font-semibold p-2">
            {row}
          </div>
          {cols.map((col) => (
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
