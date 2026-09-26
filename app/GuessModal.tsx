"use client";

import { useState } from "react";
import { Player } from "./GameGrid"

type GuessModalProps = {
    allPlayers: Player[];  
    rowLabel: string;
    colLabel: string;
    onClose: () => void;
    onSelectPlayer: (playerId: number) => void; 
}
const normalize = (s: string) =>
    s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()

export default function GuessModal({ allPlayers, rowLabel, colLabel, onClose, onSelectPlayer }: GuessModalProps) {
    const [playerGuess, setPlayerGuess] = useState("");

    const pInput = normalize(playerGuess.trim());   
    const matches = pInput
        ? allPlayers.filter((p) => normalize(p.name).includes(pInput))
        : [];
    
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
                <p>{rowLabel} and {colLabel}</p>
                <input
                    autoFocus
                    value={ playerGuess }
                    onChange={(e) => setPlayerGuess(e.target.value)}
                    placeholder="Type a player's name…"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
                />
                <ul>
                    {matches.slice(0, 8).map((p: Player) => 
                        <p key={p.id} onClick={() => onSelectPlayer(p.id)}>{p.name}</p> 
                    )}
                    {matches.length > 8 ? <p>{matches.length} more...</p> : <></>}
                </ul>
            </div>
        </div>
    )
};