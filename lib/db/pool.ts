import "server-only";

import { Pool } from "pg";

// eventually this will be hosted
export const pool = new Pool({
  host: "localhost",
  user: "johnglen.siy",
  database: "rally_grids",
  port: 5432,
});
