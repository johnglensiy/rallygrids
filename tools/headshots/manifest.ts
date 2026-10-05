import { join } from "node:path";

// Shared by export.ts and import.ts: data/headshots.json, the committed list
// of exported headshots, and access to the private Storage bucket holding
// their images. Reads SUPABASE_URL and SUPABASE_SECRET_KEY (.env.local).

export const BUCKET = process.env.SUPABASE_HEADSHOTS_BUCKET ?? "headshots";
export const MANIFEST = join(import.meta.dirname, "..", "..", "data", "headshots.json");

export type Headshot = {
  player: string;
  object: string; // path in BUCKET
  sha256: string;
  mimeType: string;
  sourceFile: string | null; // the downloaded photo (or Commons file) it was cropped from
  crop: unknown;
  artist: string | null;
  license: string | null;
  descriptionUrl: string | null;
  updatedAt: string;
};

export type Manifest = {
  bucket: string;
  headshots: Headshot[];
  skipped: string[]; // players marked as having no usable photo
  declined: { file: string; declinedAt: string }[]; // photos turned down in the picker's queue
};

export function storage(path: string, init: RequestInit = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local");
  return fetch(`${url}/storage/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...init.headers },
  });
}
