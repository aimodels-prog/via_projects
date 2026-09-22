import "@tanstack/react-start/server-only";
import { Pool } from "pg";
let pool: Pool | undefined;
export function usesPostgres() {
  return Boolean(process.env["DATABASE_URL"]);
}
export function database() {
  if (!usesPostgres()) throw new Error("DATABASE_URL is required for PostgreSQL.");
  return (pool ??= new Pool({
    connectionString: process.env["DATABASE_URL"],
    max: 10,
    connectionTimeoutMillis: 5000,
  }));
}
