import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Client } from "pg";
import { BUCKET, MANIFEST, storage, type Headshot, type Manifest } from "./manifest";

// Uploads the headshots picked in tools/photo-picker to the private Supabase
// Storage bucket and writes data/headshots.json, the list of them that's
// committed to git. tools/headshots/import.ts loads them into any database.
// Usage: bun tools/headshots/export.ts [connection-string] [--dry-run] [--force]
//   --dry-run  show what would be uploaded; upload and write nothing
//   --force    upload every image, even ones the last export already did
// Reads SUPABASE_URL and SUPABASE_SECRET_KEY (.env.local).
//
// Objects are named by player and content ("jannik-sinner-3f9a1c2b7d4e.jpg"),
// so they never change once uploaded: a re-crop is a new object, and any
// version of data/headshots.json points at images that still exist.

const PARALLEL_UPLOADS = 6;

const slug = (name: string) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function upload(object: string, image: Buffer, mimeType: string) {
  const res = await storage(`object/${BUCKET}/${object}`, {
    method: "POST",
    headers: { "Content-Type": mimeType, "x-upsert": "true" },
    body: new Uint8Array(image),
  });
  if (!res.ok) throw new Error(`upload ${object}: ${res.status} ${await res.text()}`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");
  const connectionString = args.find((a) => !a.startsWith("--")) ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Set DATABASE_URL in .env.local or pass a connection string");
  }

  const db = new Client({ connectionString });
  await db.connect();
  let rows, declined;
  try {
    ({ rows } = await db.query(
      `SELECT player_name, status, image, mime_type, file_title, crop, artist,
              license, description_url,
              -- full precision; a JS Date would drop the microseconds
              to_json(updated_at) #>> '{}' AS updated_at
       FROM player_headshots ORDER BY player_name`,
    ));
    // the table only exists once the picker has run its queue
    declined = (await db.query("SELECT to_regclass('declined_photos') IS NOT NULL AS ok")).rows[0].ok
      ? (await db.query("SELECT file, declined_at FROM declined_photos ORDER BY file")).rows
      : [];
  } finally {
    await db.end();
  }

  // objects the last export uploaded; unchanged images aren't sent again
  const previous: Manifest | null = await readFile(MANIFEST, "utf8").then(JSON.parse, () => null);
  const uploaded = new Set(previous?.bucket === BUCKET ? previous.headshots.map((h) => h.object) : []);

  const headshots: Headshot[] = [];
  const pending: { object: string; image: Buffer; mimeType: string }[] = [];
  for (const r of rows.filter((r) => r.status === "picked" && r.image)) {
    const sha256 = createHash("sha256").update(r.image).digest("hex");
    const object = `${slug(r.player_name)}-${sha256.slice(0, 12)}.jpg`;
    headshots.push({
      player: r.player_name, object, sha256, mimeType: r.mime_type,
      sourceFile: r.file_title, crop: r.crop, artist: r.artist, license: r.license,
      descriptionUrl: r.description_url, updatedAt: r.updated_at,
    });
    if (force || !uploaded.has(object)) pending.push({ object, image: r.image, mimeType: r.mime_type });
  }

  console.log(`${headshots.length} headshots; ${pending.length} to upload to "${BUCKET}"` +
    (dryRun ? " (dry run)" : ""));
  if (dryRun) {
    for (const p of pending.slice(0, 20)) console.log(`  ${p.object}`);
    if (pending.length > 20) console.log(`  … and ${pending.length - 20} more`);
    return;
  }

  let done = 0;
  for (let i = 0; i < pending.length; i += PARALLEL_UPLOADS) {
    await Promise.all(pending.slice(i, i + PARALLEL_UPLOADS).map((p) => upload(p.object, p.image, p.mimeType)));
    done += pending.slice(i, i + PARALLEL_UPLOADS).length;
    process.stdout.write(`\r  uploaded ${done}/${pending.length}`);
  }
  if (pending.length) process.stdout.write("\n");

  // written only after every upload succeeded, so it never lists a missing image
  const manifest: Manifest = {
    bucket: BUCKET,
    headshots,
    skipped: rows.filter((r) => r.status === "skipped").map((r) => r.player_name),
    declined: declined.map((d) => ({ file: d.file, declinedAt: d.declined_at.toISOString() })),
  };
  await mkdir(dirname(MANIFEST), { recursive: true });
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`wrote ${MANIFEST}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
