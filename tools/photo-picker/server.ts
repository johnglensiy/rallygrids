import { execFile } from "node:child_process";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, join } from "node:path";
import { promisify } from "node:util";
import { Client } from "pg";
import sharp from "sharp";
import { headshotsSchemaSQL } from "../headshots/schema";

// Local tool for hand-picking a headshot per player from photos you've
// downloaded.
// Usage: bun tools/photo-picker/server.ts [connection-string]
// then open http://localhost:4000
//
// The page lists the selected player's photos from DOWNLOADS_DIR, you click
// one, drag a square around the head, and the server crops it and stores it
// in player_headshots.

const PORT = 4000;
const HEADSHOT_SIZE = 400;
// Photos saved by hand, named after the player ("stefankoubek.webp",
// "Gabriela Sabatini 2.jpg", or just the surname: "sabatini.jpg").
const DOWNLOADS_DIR =
  process.env.PLAYER_PHOTOS_DIR ??
  join(homedir(), "Downloads", "player-photos");
const LOCAL_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

// Grand Slam singles titles per player ("AO 2024", ...), from Wikipedia's
// lists of men's and women's Grand Slam singles finals.
const SLAMS_FILE = join(import.meta.dirname, "slams.json");

type Photo = { file: string; url: string; width: number; height: number };

// Letters NFD doesn't split into base + accent ("Đoković" -> "djokovic").
const LETTERS: Record<string, string> = {
  đ: "dj",
  ł: "l",
  ø: "o",
  æ: "ae",
  ß: "ss",
  ı: "i",
};

// Letters only, so "stefankoubek", "Stefan_Koubek" and "Stefan Koubek 2"
// all compare equal to the player's name.
const letters = (s: string) =>
  s
    .toLowerCase()
    .replace(/[đłøæßı]/g, (c) => LETTERS[c])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");

const photoFiles = async () =>
  (await readdir(DOWNLOADS_DIR).catch(() => [] as string[]))
    .filter((file) => LOCAL_TYPES[extname(file).toLowerCase()])
    .sort();

const photoUrl = (file: string) =>
  `/api/photo?file=${encodeURIComponent(file)}`;

// Whether a file is named after a player: their full name (either order) or,
// when no other player shares it, their surname.
function fileMatcher(names: string[]) {
  const surname = (n: string) => letters(n.split(" ").slice(1).join(" "));
  const surnames = new Map<string, number>();
  for (const n of names)
    surnames.set(surname(n), (surnames.get(surname(n)) ?? 0) + 1);
  return (file: string, name: string) => {
    const stem = letters(basename(file, extname(file)));
    const first = letters(name.split(" ")[0]);
    const last = surname(name);
    return (
      stem === first + last ||
      stem === last + first ||
      (surnames.get(last) === 1 && stem === last)
    );
  };
}

const playerNames = async (db: Client) =>
  (await db.query("SELECT name FROM players")).rows.map(
    (r) => r.name as string,
  );

// The files in DOWNLOADS_DIR named after this player.
async function playerPhotos(db: Client, name: string): Promise<Photo[]> {
  const matches = fileMatcher(await playerNames(db));
  const files = (await photoFiles()).filter((file) => matches(file, name));
  return Promise.all(
    files.map(async (file) => {
      const { width = 0, height = 0 } = await sharp(
        join(DOWNLOADS_DIR, file),
      ).metadata();
      return { file, url: photoUrl(file), width, height };
    }),
  );
}

// Every file in DOWNLOADS_DIR, with the players it's named after, the
// players whose saved headshot was cropped from it, and whether it was
// declined in the approval queue.
async function library(db: Client) {
  const names = await playerNames(db);
  const matches = fileMatcher(names);
  const { rows } = await db.query(
    "SELECT player_name, file_title FROM player_headshots WHERE status = 'picked'",
  );
  const declined = new Set(
    (await db.query("SELECT file FROM declined_photos")).rows.map(
      (r) => r.file,
    ),
  );
  return (await photoFiles()).map((file) => ({
    file,
    url: photoUrl(file),
    players: names.filter((n) => matches(file, n)),
    assignedTo: rows
      .filter((r) => r.file_title === file)
      .map((r) => r.player_name),
    declined: declined.has(file),
  }));
}

// A file directly inside DOWNLOADS_DIR; anything else (../, subfolders) is refused.
async function readPhoto(file: string) {
  if (basename(file) !== file || !LOCAL_TYPES[extname(file).toLowerCase()]) {
    throw new Error("not a downloaded photo");
  }
  return readFile(join(DOWNLOADS_DIR, file));
}

// ---- face detection (Apple Vision, macOS only) ----
// face-detect.swift is compiled on first use, and again whenever it's edited.
const FACE_SOURCE = join(import.meta.dirname, "face-detect.swift");
const FACE_BINARY = join(import.meta.dirname, ".build", "face-detect");
const run = promisify(execFile);

type Face = { x: number; y: number; w: number; h: number; confidence: number };

let compiling: Promise<void> | null = null;
function faceDetector() {
  compiling ??= (async () => {
    const [source, binary] = await Promise.all([
      stat(FACE_SOURCE),
      stat(FACE_BINARY).catch(() => null),
    ]);
    if (binary && binary.mtimeMs >= source.mtimeMs) return;
    await mkdir(dirname(FACE_BINARY), { recursive: true });
    await run("swiftc", ["-O", FACE_SOURCE, "-o", FACE_BINARY]);
  })().catch((err) => {
    compiling = null; // retry next time, e.g. after installing the Xcode tools
    throw err;
  });
  return compiling;
}

// Per file and modification time, so a replaced photo is looked at again.
const faceCache = new Map<string, Face | null>();

// The largest face in a downloaded photo, as fractions of its (EXIF-rotated)
// width/height, or null when Vision finds none.
async function largestFace(file: string): Promise<Face | null> {
  await readPhoto(file); // validates the name
  const path = join(DOWNLOADS_DIR, file);
  const key = `${file}:${(await stat(path)).mtimeMs}`;
  if (!faceCache.has(key)) {
    await faceDetector();
    const { stdout } = await run(FACE_BINARY, [path]);
    faceCache.set(key, (JSON.parse(stdout) as Face[])[0] ?? null);
  }
  return faceCache.get(key)!;
}

type Crop = { x: number; y: number; size: number }; // fractions of the image width/height

async function saveHeadshot(
  db: Client,
  name: string,
  file: string,
  crop: Crop,
) {
  // apply the EXIF orientation first: the crop was drawn on the photo as the
  // browser shows it, which is already rotated
  const source = await sharp(await readPhoto(file))
    .rotate()
    .toBuffer();
  const { width = 0, height = 0 } = await sharp(source).metadata();
  const left = Math.round(crop.x * width);
  const top = Math.round(crop.y * height);
  const side = Math.min(
    Math.round(crop.size * width),
    width - left,
    height - top,
  );
  if (side < 16) throw new Error("crop is too small");

  const image = await sharp(source)
    .extract({ left, top, width: side, height: side })
    .resize(HEADSHOT_SIZE, HEADSHOT_SIZE)
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();

  await db.query(
    `INSERT INTO player_headshots
       (player_name, status, image, mime_type, file_title, description_url, artist, license, crop)
     VALUES ($1, 'picked', $2, 'image/jpeg', $3, NULL, NULL, 'downloaded', $4)
     ON CONFLICT (player_name) DO UPDATE SET
       status = 'picked', image = EXCLUDED.image, mime_type = EXCLUDED.mime_type,
       file_title = EXCLUDED.file_title, description_url = EXCLUDED.description_url,
       artist = EXCLUDED.artist, license = EXCLUDED.license, crop = EXCLUDED.crop,
       updated_at = now()`,
    [name, image, file, JSON.stringify(crop)],
  );
  // a photo used after all is no longer declined
  await db.query("DELETE FROM declined_photos WHERE file = $1", [file]);
}

async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString() || "{}");
}

function send(
  res: ServerResponse,
  status: number,
  body: unknown,
  type = "application/json",
) {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(
    type === "application/json" ? JSON.stringify(body) : (body as Buffer),
  );
}

async function main() {
  const connectionString = process.argv[2] ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Set DATABASE_URL in .env or pass a connection string");
  }
  const db = new Client({ connectionString });
  await db.connect();
  await db.query(headshotsSchemaSQL);

  createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const name = url.searchParams.get("name") ?? "";
    try {
      if (req.method === "GET" && url.pathname === "/") {
        // read per request so page edits show up without a restart
        const html = await readFile(join(import.meta.dirname, "index.html"));
        return send(res, 200, html, "text/html; charset=utf-8");
      }
      if (req.method === "GET" && url.pathname === "/api/players") {
        const { rows } = await db.query(
          `SELECT p.name, p.tour, p.current_rank AS rank, h.status,
             -- versions the headshot URL, so a re-pick isn't shown from cache
             extract(epoch FROM h.updated_at)::bigint AS version,
             -- picks made before the picker switched to downloaded photos
             -- were cropped from Wikimedia Commons files ("File:...")
             CASE WHEN h.status = 'picked'
               THEN CASE WHEN h.file_title LIKE 'File:%' THEN 'commons' ELSE 'downloads' END
             END AS source
           FROM players p LEFT JOIN player_headshots h ON h.player_name = p.name
           ORDER BY p.tour, p.current_rank NULLS LAST, p.name`,
        );
        const slams: Record<string, string[]> = JSON.parse(
          await readFile(SLAMS_FILE, "utf8"),
        );
        return send(
          res,
          200,
          rows.map((r) => ({ ...r, slams: slams[r.name] ?? [] })),
        );
      }
      if (req.method === "GET" && url.pathname === "/api/photos") {
        return send(res, 200, await playerPhotos(db, name));
      }
      if (req.method === "GET" && url.pathname === "/api/library") {
        return send(res, 200, await library(db));
      }
      if (req.method === "GET" && url.pathname === "/api/face") {
        return send(res, 200, {
          face: await largestFace(url.searchParams.get("file") ?? ""),
        });
      }
      if (req.method === "GET" && url.pathname === "/api/photo") {
        const file = url.searchParams.get("file") ?? "";
        return send(
          res,
          200,
          await readPhoto(file),
          LOCAL_TYPES[extname(file).toLowerCase()],
        );
      }
      if (req.method === "GET" && url.pathname === "/api/headshot") {
        const { rows } = await db.query(
          "SELECT image, mime_type FROM player_headshots WHERE player_name = $1 AND status = 'picked'",
          [name],
        );
        return rows[0]
          ? send(res, 200, rows[0].image, rows[0].mime_type)
          : send(res, 404, {});
      }
      if (req.method === "POST" && url.pathname === "/api/save") {
        const body = await readJson(req);
        await saveHeadshot(db, body.name, body.file, body.crop);
        return send(res, 200, { ok: true });
      }
      if (req.method === "POST" && url.pathname === "/api/decline") {
        const { file } = await readJson(req);
        await readPhoto(file); // validates the name
        await db.query(
          "INSERT INTO declined_photos (file) VALUES ($1) ON CONFLICT DO NOTHING",
          [file],
        );
        return send(res, 200, { ok: true });
      }
      if (req.method === "POST" && url.pathname === "/api/skip") {
        const body = await readJson(req);
        await db.query(
          `INSERT INTO player_headshots (player_name, status) VALUES ($1, 'skipped')
           ON CONFLICT (player_name) DO UPDATE SET
             status = 'skipped', image = NULL, mime_type = NULL, file_title = NULL,
             description_url = NULL, artist = NULL, license = NULL, crop = NULL,
             updated_at = now()`,
          [body.name],
        );
        return send(res, 200, { ok: true });
      }
      send(res, 404, { error: "not found" });
    } catch (err) {
      console.error(err);
      send(res, 500, { error: (err as Error).message });
    }
  }).listen(PORT, () =>
    console.log(`photo picker on http://localhost:${PORT}`),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
