"""Run on Contabo with this directory as argv[1]. Back up before patching portal."""
from pathlib import Path
import datetime, shutil, sys, secrets, os

source = Path(sys.argv[1]).resolve()
portal = Path('/opt/via/apps/portal/current').resolve()
assert str(portal).startswith('/opt/via/apps/portal/releases/')
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup = Path('/opt/via/backups/portal-projects-sso-' + stamp)
backup.mkdir(mode=0o700)
for name in ['src/server.ts', 'src/lib/google-auth.ts', '.env']:
    target = portal / name
    dest = backup / name
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(target, dest)

server = portal / 'src/server.ts'
text = server.read_text()
if 'handleProjectsSso' not in text:
    text = 'import { handleProjectsSso } from "./lib/projects-sso";\n' + text
    anchor = '      if (isAuthRoute(url.pathname)) {'
    assert text.count(anchor) == 1
    text = text.replace(anchor, '      if (url.pathname === "/sso/projects" || url.pathname.startsWith("/sso/projects/")) {\n        return await handleProjectsSso(request);\n      }\n\n' + anchor)
    server.write_text(text)
auth = portal / 'src/lib/google-auth.ts'
text = auth.read_text()
if 'revokeProjectsSessions' not in text:
    anchor = '  if (url.pathname === "/auth/signout") {'
    assert text.count(anchor) == 1
    text = text.replace(anchor, anchor + '\n    const { revokeProjectsSessions } = await import("./projects-sso");\n    await revokeProjectsSessions(request);')
    auth.write_text(text)
shutil.copy2(source / 'projects-sso.ts', portal / 'src/lib/projects-sso.ts')

def set_env(path, key, value):
    content = path.read_text()
    lines = [line for line in content.splitlines() if not line.startswith(key + '=')]
    path.write_text('\n'.join(lines) + '\n' + key + '=' + value + '\n')
    os.chmod(path, 0o600)

portal_env = portal / '.env'
existing = [line.split('=', 1)[1] for line in portal_env.read_text().splitlines() if line.startswith('PROJECTS_SSO_KEY=')]
key = existing[0] if existing else secrets.token_hex(32)
set_env(portal_env, 'PROJECTS_SSO_KEY', key)
projects_env = Path('/opt/via/apps/via-projects/.env')
shutil.copy2(projects_env, backup / 'projects.env')
set_env(projects_env, 'PROJECTS_SSO_KEY', key)
# Enable separately, after the portal endpoint and catalogue have been verified.
set_env(projects_env, 'PROJECTS_PORTAL_INTERNAL_URL', 'http://via-portal:8080')
print('Portal source staged. Backup:', backup)
