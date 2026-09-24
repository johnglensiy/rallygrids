import "server-only";

import { Client } from "pg";

const genPuzzleSQL = `
    DROP TABLE IF EXISTS puzzles;
    DROP TABLE IF EXISTS puzzle_cells;

    CREATE TABLE puzzles (
        puzzle_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    )

    CREATE TABLE puzzle_cells (
        puzzle_cell_id INT NOT NULL REFERENCES puzzles ( puzzle_id ) ON DELETE CASCADE,
        row_pos SMALLINT NOT NULL,
        col_pos SMALLINT NOT NULL,
        -- Frozen answer set
        answer_ids INT[] NOT NULL,
        -- answer_count INT GENERATED ALWAYS AS (cardinality(answer_ids)) STORED,
        PRIMARY KEY (puzzle_id, row_pos, col_pos)
    );
`;

async function genPuzzle() {
  console.log("seeding...");
  const client = new Client(
    process.argv[2]
      ? { connectionString: process.argv[2] }
      : {
          host: "localhost",
          user: "johnglen.siy",
          database: "rally_grids",
          port: 5432,
        },
  );
  await client.connect();
  try {
    await client.query(genPuzzleSQL);
  } finally {
    await client.end();
  }
  console.log("done");
}

genPuzzle();
