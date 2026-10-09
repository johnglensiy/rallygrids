"use client";

import { useState } from "react";
import { GuessResult, Player } from "./GameGrid";

type GuessModalProps = {
  allPlayers: Player[];
  rowLabel: string;
  colLabel: string;
  onClose: () => void;
  onSelectPlayer: (playerId: number) => Promise<GuessResult>;
};

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export default function GuessModal({
  allPlayers,
  rowLabel,
  colLabel,
  onClose,
  onSelectPlayer,
}: GuessModalProps) {
  const [playerGuess, setPlayerGuess] = useState("");
  const [highlightIdx, setHighlightIdx] = useState<number>(-1);
  const [shakeIdx, setShakeIdx] = useState<number | null>(null);

  const pInput = normalize(playerGuess.trim());
  const matches = pInput
    ? allPlayers.filter((p) => normalize(p.name).includes(pInput))
    : [];

  function handleArrowKeys(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key == "ArrowDown") {
      // set indices to either next index or keep at end of list if already there
      setHighlightIdx((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key == "ArrowUp") {
      setHighlightIdx((i) => Math.max(i - 1, 0));
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm pt-24"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()} // clicks inside the panel don't close it
        role="dialog"
        aria-modal="true"
      >
        <p>
          {rowLabel} and {colLabel}
        </p>
        <input
          autoFocus
          value={playerGuess}
          onChange={(e) => {
            setPlayerGuess(e.target.value);
            setHighlightIdx(0);
          }}
          onKeyDown={handleArrowKeys}
          placeholder="Type a player's name…"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
        />

        <ul>
          {matches.slice(0, 8).map((p: Player, i) => (
            <p
              key={p.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={async () => {
                setHighlightIdx(i);
                const result = await onSelectPlayer(p.id);
                if (result == "correct") {
                  onClose();
                } else if (result == "incorrect") {
                  // don't close and jiggle player li
                  setShakeIdx(i);
                }
              }}
              onAnimationEnd={() => setShakeIdx(null)}
              className={`w-full rounded-md px-3 py-2 text-left ${
                shakeIdx === i
                  ? "animate-shake bg-red-50 text-red-700"
                  : i === highlightIdx
                    ? "bg-neutral-100"
                    : ""
              }`}
            >
              {p.name}
            </p>
          ))}
          {matches.length > 8 ? <p>{matches.length} more...</p> : <></>}
        </ul>
      </div>
    </div>
  );
}
