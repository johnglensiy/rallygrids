import { Client } from "pg";

const schemaSQL = `
  DROP TABLE IF EXISTS puzzle_cells;
  DROP TABLE IF EXISTS puzzles;

  CREATE TABLE puzzles (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    row_1 TEXT NOT NULL DEFAULT '',
    row_2 TEXT NOT NULL DEFAULT '',
    row_3 TEXT NOT NULL DEFAULT '',
    col_1 TEXT NOT NULL DEFAULT '',
    col_2 TEXT NOT NULL DEFAULT '',
    col_3 TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE puzzle_cells (
    puzzle_id INT NOT NULL REFERENCES puzzles (id) ON DELETE CASCADE,
    row_pos SMALLINT NOT NULL,
    col_pos SMALLINT NOT NULL,
    answer_ids INT[] NOT NULL,
    answer_count INT GENERATED ALWAYS AS (cardinality(answer_ids)) STORED,
    PRIMARY KEY (puzzle_id, row_pos, col_pos),
    CONSTRAINT cell_min_answers CHECK (cardinality(answer_ids) >= 1)
  );
`;

const QF_2026 = `EXISTS (SELECT 1 FROM tournaments t
                 WHERE t.year = 2026 AND p.id = ANY (t.quarterfinalists))`;

// One raw INSERT per cell; $1 is the puzzle id
const cellSQL: string[] = [
  // Row 1: Active in 2026
  `SELECT $1::int, 1, 1, COALESCE(array_agg(p.id ORDER BY p.id), '{}')
   FROM players p WHERE p.active_2026 AND p.tour = 'ATP'`,
  `SELECT $1::int, 1, 2, COALESCE(array_agg(p.id ORDER BY p.id), '{}')
   FROM players p WHERE p.active_2026 AND p.country = 'USA'`,
  `SELECT $1::int, 1, 3, COALESCE(array_agg(p.id ORDER BY p.id), '{}')
   FROM players p WHERE p.active_2026 AND p.tour = 'WTA'`,
  // Row 2: Top 50
  `SELECT $1::int, 2, 1, COALESCE(array_agg(p.id ORDER BY p.id), '{}')
   FROM players p WHERE p.top50 AND p.tour = 'ATP'`,
  `SELECT $1::int, 2, 2, COALESCE(array_agg(p.id ORDER BY p.id), '{}')
   FROM players p WHERE p.top50 AND p.country = 'USA'`,
  `SELECT $1::int, 2, 3, COALESCE(array_agg(p.id ORDER BY p.id), '{}')
   FROM players p WHERE p.top50 AND p.tour = 'WTA'`,
  // Row 3: 2026 Grand Slam QF
  `SELECT $1::int, 3, 1, COALESCE(array_agg(p.id ORDER BY p.id), '{}')
   FROM players p WHERE p.tour = 'ATP' AND ${QF_2026}`,
  `SELECT $1::int, 3, 2, COALESCE(array_agg(p.id ORDER BY p.id), '{}')
   FROM players p WHERE p.country = 'USA' AND ${QF_2026}`,
  `SELECT $1::int, 3, 3, COALESCE(array_agg(p.id ORDER BY p.id), '{}')
   FROM players p WHERE p.tour = 'WTA' AND ${QF_2026}`,
];

async function genPuzzle() {
  console.log("seeding...");
  const connectionString = process.argv[2] ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Set DATABASE_URL in .env or pass a connection string");
  }
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(schemaSQL); // no params, so multi-statement is fine

    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO puzzles (row_1, row_2, row_3, col_1, col_2, col_3)
       VALUES ('Active in 2026', 'Top 50 player', '2026 Grand Slam QF',
               'ATP', 'United States', 'WTA')
       RETURNING id`
    );
    const puzzleId: number = rows[0].id;

    for (const select of cellSQL) {
      await client.query(
        `INSERT INTO puzzle_cells (puzzle_id, row_pos, col_pos, answer_ids) ${select}`,
        [puzzleId]
      );
    }
    await client.query("COMMIT");

    const { rows: counts } = await client.query(
      `SELECT row_pos, col_pos, answer_count FROM puzzle_cells
       WHERE puzzle_id = $1 ORDER BY 1, 2`,
      [puzzleId]
    );
    console.table(counts);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
  console.log("done");
}

genPuzzle().catch((err) => {
  console.error(err);
  process.exit(1);
});