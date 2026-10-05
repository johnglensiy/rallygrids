// The tables the photo picker fills, shared with the headshot import so a
// fresh database (e.g. production) gets the same ones.
// Keyed by name rather than players.id so re-running populatedb (which
// regenerates ids and drops players) doesn't lose or break picks.
export const headshotsSchemaSQL = `
  CREATE TABLE IF NOT EXISTS player_headshots (
    player_name VARCHAR ( 255 ) PRIMARY KEY,
    status VARCHAR ( 10 ) NOT NULL CHECK (status IN ('picked', 'skipped')),
    image BYTEA,
    mime_type VARCHAR ( 50 ),
    file_title TEXT,
    description_url TEXT,
    artist TEXT,
    license TEXT,
    crop JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  -- downloaded photos turned down in the approval queue, so they stay out of it
  CREATE TABLE IF NOT EXISTS declined_photos (
    file TEXT PRIMARY KEY,
    declined_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;
