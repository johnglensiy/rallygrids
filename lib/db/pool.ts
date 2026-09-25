import "server-only";

import { Pool } from "pg";

// eventually this will be hosted
const connectionString = process.env.DATABASE_URL;
export const pool = new Pool({ connectionString });
