// Run inside the staged portal container; synthetic staff only. Never prints credentials.
import pg from 'pg';
import { randomUUID, createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
const db = new pg.Client({ connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL?.toLowerCase() === 'false' ? false : { rejectUnauthorized: false } });
await db.connect();
const id = randomUUID();
const email = `sso-verification-${id}@via-int.com`;
const base = 'http://127.0.0.1:8080';
const app = (await db.query('SELECT id,"visibleToAllStaff" FROM "Application" WHERE slug=$1', ['via-projects'])).rows[0];
assert.ok(app, 'Projects tile exists');
const payload = Buffer.from(JSON.stringify({email, name:'SSO verification', exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
const cookie = `via_portal_session=${payload}.${createHmac('sha256',process.env.AUTH_SECRET).update(payload).digest('base64url')}`;
const state = 'c'.repeat(64);
async function launch() {
  const response = await fetch(`${base}/sso/projects?state=${state}`, {headers:{cookie},redirect:'manual'});
  assert.equal(response.status,302);
  return new URL(response.headers.get('location')).searchParams.get('code');
}
async function api(action, data, key=process.env.PROJECTS_SSO_KEY) {
  const response = await fetch(`${base}/sso/projects/${action}`, {method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify(data)});
  return {status:response.status, data:await response.json()};
}
try {
  await db.query(`INSERT INTO "StaffProfile" (id,email,name,"jobTitle",status,"allowedAppIds","accessConfigured","updatedAt") VALUES ($1,$2,'SSO verification','Staff','active',$3,true,now())`, [id,email,[app.id]]);
  const unsigned = await fetch(`${base}/sso/projects?state=${state}`,{redirect:'manual'});
  assert.equal(unsigned.status,302);
  assert.ok(unsigned.headers.get('location').startsWith('/auth/signin'));
  const code=await launch();
  assert.equal((await api('exchange',{code},'incorrect')).status,401);
  const grant=await api('exchange',{code});
  assert.equal(grant.data.authorized,true);
  assert.equal((await api('exchange',{code})).data.authorized,false);
  const access = (await api('access',{session:grant.data.session})).data;
  assert.equal(access.authorized,true);
  assert.equal(access.portalAdmin,false, 'Ordinary Projects staff must not receive Portal administrator access');
  const expiredCode=await launch();
  await db.query("UPDATE via_projects_sso SET code_expires_at=now()-interval '1 minute' WHERE email=$1 AND session_hash IS NULL",[email]);
  assert.equal((await api('exchange',{code:expiredCode})).data.authorized,false);
  await db.query('UPDATE "StaffProfile" SET "allowedAppIds"=ARRAY[]::text[] WHERE id=$1',[id]);
  if (app.visibleToAllStaff) {
    // Respect the live Portal setting: clearing assignments cannot revoke an all-staff app.
    assert.equal((await api('access',{session:grant.data.session})).data.authorized,true);
    await db.query('UPDATE "StaffProfile" SET status=$2 WHERE id=$1',[id,'inactive']);
    console.log('Projects is available to all active Portal staff; testing revocation by deactivating only the synthetic account.');
  }
  assert.equal((await api('access',{session:grant.data.session})).data.authorized,false);
  const denied=await fetch(`${base}/sso/projects?state=${state}`,{headers:{cookie},redirect:'manual'});
  assert.equal(denied.status,403);
  await db.query('UPDATE "StaffProfile" SET "allowedAppIds"=$2,status=$3 WHERE id=$1',[id,[app.id],'active']);
  assert.equal((await api('access',{session:grant.data.session})).data.authorized,false);
  const second=await api('exchange',{code:await launch()});
  assert.equal(second.data.authorized,true);
  await api('logout',{session:second.data.session});
  assert.equal((await api('access',{session:second.data.session})).data.authorized,false);
  const third=await api('exchange',{code:await launch()});
  assert.equal(third.data.authorized,true);
  const out=await fetch(`${base}/auth/signout`,{headers:{cookie},redirect:'manual'});
  assert.equal(out.status,302);
  assert.equal((await api('access',{session:third.data.session})).data.authorized,false);
  console.log('PASS: login, wrong service key, one-use codes, expired codes, access removal, reassignment, app logout and portal logout.');
} catch (error) {
  console.error('SSO smoke failed:', error.message);
  throw error;
} finally {
  await db.query('DELETE FROM via_projects_sso WHERE email=$1',[email]).catch((error) => { if (error.code !== '42P01') throw error; });
  await db.query('DELETE FROM "StaffProfile" WHERE id=$1 AND email=$2',[id,email]);
  await db.end();
  console.log('Synthetic test staff and grants removed; no real staff records changed.');
}
