"use client";

import { useState } from "react";
import type { Player } from "./GameGrid";

// A correctly guessed cell: the player's headshot with their name along the bottom.
// The headshot is only requested once the cell is filled, i.e. after a correct guess,
// and animates in once it has loaded (see .animate-reveal-* in globals.css).
export default function PlayerCell({ player }: { player: Player }) {
  const [hasPhoto, setHasPhoto] = useState(true);
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="absolute inset-0 flex items-end justify-center">
      {hasPhoto && (
        // served from Postgres via the API route, so next/image adds nothing here
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/players/${player.id}/headshot`}
          alt={player.name}
          onLoad={() => setLoaded(true)}
          onError={() => setHasPhoto(false)}
          className={`absolute inset-0 h-full w-full object-cover ${
            loaded ? "animate-reveal-photo" : "opacity-0"
          }`}
        />
      )}
      <span
        className={`relative w-full px-1 text-center text-xs sm:text-sm font-semibold leading-tight ${
          hasPhoto
            ? `bg-linear-to-t from-black/80 via-black/50 to-transparent pt-4 pb-1 text-white ${
                loaded ? "animate-reveal-name" : "opacity-0"
              }`
            : "self-center text-neutral-900"
        }`}
      >
        {player.name}
      </span>
    </div>
  );
}
