import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { headshotsSchemaSQL } from "./schema";
import { MANIFEST, storage, type Headshot, type Manifest } from "./manifest";

// Loads the headshots listed in data/headshots.json into a database, pulling
// the images from the private Supabase Storage bucket. Run it on the other
// dev machine after pulling, or against production to release them.
// Usage: bun tools/headshots/import.ts [connection-string] [--dry-run] [--overwrite]
//   --dry-run    show what would change; download and write nothing
//   --overwrite  replace headshots even where the database has a newer pick
// Reads SUPABASE_URL and SUPABASE_SECRET_KEY (.env.local).
//
// Only adds or updates, never deletes. Images the database already has (same
// SHA-256) aren't downloaded. A pick in the database that's newer than the
// list's and different is kept, since it's probably one made on this
// machine and not exported yet.

const PARALLEL_DOWNLOADS = 6;

async function download(h: Headshot, bucket: string): Promise<Buffer> {
  const res = await storage(`object/${bucket}/${h.object}`);
  if (!res.ok)
    throw new Error(`download ${h.object}: ${res.status} ${await res.text()}`);
  const image = Buffer.from(await res.arrayBuffer());
  const sha256 = createHash("sha256").update(image).digest("hex");
  if (sha256 !== h.sha256)
    throw new Error(
      `download ${h.object}: contents don't match data/headshots.json`,
    );
  return image;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const overwrite = args.includes("--overwrite");
  const connectionString =
    args.find((a) => !a.startsWith("--")) ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "Set DATABASE_URL in .env.local or pass a connection string",
    );
  }
  const manifest: Manifest = JSON.parse(await readFile(MANIFEST, "utf8"));

  const db = new Client({ connectionString });
  await db.connect();
  try {
    await db.query(headshotsSchemaSQL);
    const { rows } = await db.query(
      `SELECT player_name, status, encode(sha256(image), 'hex') AS sha256, updated_at
       FROM player_headshots`,
    );
    const existing = new Map(rows.map((r) => [r.player_name, r]));
    const players = new Set(
      (
        await db.query("SELECT name FROM players").catch(() => ({ rows: [] }))
      ).rows.map((r) => r.name),
    );

    const changed: Headshot[] = [];
    const kept: string[] = [];
    for (const h of manifest.headshots) {
      const row = existing.get(h.player);
      if (row?.sha256 === h.sha256) continue;
      if (row?.sha256 && row.updated_at > new Date(h.updatedAt) && !overwrite) {
        kept.push(h.player);
        continue;
      }
      changed.push(h);
    }
    const unknown = manifest.headshots
      .filter((h) => !players.has(h.player))
      .map((h) => h.player);

    console.log(
      `${manifest.headshots.length} headshots listed; ${changed.length} to download and save` +
        (dryRun ? " (dry run)" : ""),
    );
    if (kept.length) {
      console.log(
        `kept ${kept.length} newer pick(s) in the database (export them, or pass --overwrite): ` +
          kept.join(", "),
      );
    }
    if (unknown.length) {
      console.log(
        `${unknown.length} headshot(s) for players not in this database's players table ` +
          `(saved anyway; they show once the player is seeded): ${unknown.slice(0, 10).join(", ")}` +
          (unknown.length > 10 ? ", …" : ""),
      );
    }
    if (dryRun) {
      for (const h of changed.slice(0, 20)) console.log(`  ${h.player}`);
      if (changed.length > 20)
        console.log(`  … and ${changed.length - 20} more`);
      return;
    }

    // everything is downloaded and checked before the database is touched
    const images = new Map<string, Buffer>();
    for (let i = 0; i < changed.length; i += PARALLEL_DOWNLOADS) {
      const batch = changed.slice(i, i + PARALLEL_DOWNLOADS);
      const downloaded = await Promise.all(
        batch.map((h) => download(h, manifest.bucket)),
      );
      batch.forEach((h, j) => images.set(h.player, downloaded[j]));
      process.stdout.write(`\r  downloaded ${images.size}/${changed.length}`);
    }
    if (changed.length) process.stdout.write("\n");

    await db.query("BEGIN");
    for (const h of changed) {
      await db.query(
        `INSERT INTO player_headshots
           (player_name, status, image, mime_type, file_title, description_url, artist, license, crop, updated_at)
         VALUES ($1, 'picked', $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (player_name) DO UPDATE SET
           status = 'picked', image = EXCLUDED.image, mime_type = EXCLUDED.mime_type,
           file_title = EXCLUDED.file_title, description_url = EXCLUDED.description_url,
           artist = EXCLUDED.artist, license = EXCLUDED.license, crop = EXCLUDED.crop,
           updated_at = EXCLUDED.updated_at`,
        // the list's updated_at, so every database versions the image URL the same
        [
          h.player,
          images.get(h.player),
          h.mimeType,
          h.sourceFile,
          h.descriptionUrl,
          h.artist,
          h.license,
          JSON.stringify(h.crop),
          h.updatedAt,
        ],
      );
    }
    // a skip never replaces a pick
    const skipped = await db.query(
      `INSERT INTO player_headshots (player_name, status)
       SELECT unnest($1::text[]), 'skipped'
       ON CONFLICT (player_name) DO NOTHING`,
      [manifest.skipped],
    );
    const declined = await db.query(
      `INSERT INTO declined_photos (file, declined_at)
       SELECT * FROM unnest($1::text[], $2::timestamptz[])
       ON CONFLICT (file) DO NOTHING`,
      [
        manifest.declined.map((d) => d.file),
        manifest.declined.map((d) => d.declinedAt),
      ],
    );
    await db.query("COMMIT");
    console.log(
      `saved ${changed.length} headshot(s), ${skipped.rowCount} skip(s), ` +
        `${declined.rowCount} declined photo(s)`,
    );
  } catch (err) {
    await db.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
