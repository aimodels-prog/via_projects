// Run once inside the portal container. Never grants Projects to all staff.
import pg from 'pg';
import { randomUUID } from 'node:crypto';
const db = new pg.Client({ connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL?.toLowerCase() === 'false' ? false : { rejectUnauthorized: false } });
await db.connect();
await db.query('BEGIN');
try {
  let result = await db.query('SELECT id FROM "Application" WHERE url LIKE $1', ['https://projects.via-int.com%']);
  if (!result.rows.length) {
    result = await db.query(`INSERT INTO "Application" (id,name,slug,url,description,status,icon,accent,"visibleToAllStaff","visibleToEmails","updatedAt")
      VALUES ($1,'VIA Projects','via-projects','https://projects.via-int.com/auth/portal/start','Project reports and client dashboards','active','app','blue',false,ARRAY[]::text[],now()) RETURNING id`, [randomUUID()]);
  }
  const id = result.rows[0].id;
  const admins = (process.env.ADMIN_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);
  const updated = await db.query(`UPDATE "StaffProfile" SET "allowedAppIds" = array_append("allowedAppIds", $1), "updatedAt"=now()
    WHERE lower(email)=ANY($2::text[]) AND status='active' AND NOT ($1=ANY("allowedAppIds"))`, [id, admins]);
  await db.query('COMMIT');
  console.log(JSON.stringify({ projectsAppId: id, existingAdministratorsGranted: updated.rowCount }));
} catch (error) { await db.query('ROLLBACK'); throw error; }
finally { await db.end(); }
