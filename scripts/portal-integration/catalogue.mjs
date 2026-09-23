import pg from 'pg';
const db = new pg.Client({ connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL?.toLowerCase() === 'false' ? false : { rejectUnauthorized: false } });
await db.connect();
const result = await db.query('SELECT id, name, slug, url, status, "visibleToAllStaff" FROM "Application" ORDER BY name');
console.log(JSON.stringify(result.rows, null, 2));
await db.end();
