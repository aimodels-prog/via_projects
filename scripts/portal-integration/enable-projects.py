"""Enable only after the live portal SSO smoke test has passed."""
from pathlib import Path
import os

path = Path('/opt/via/apps/via-projects/.env')
lines = path.read_text().splitlines()
assert any(line.startswith('PROJECTS_SSO_KEY=') and len(line.split('=', 1)[1]) >= 32 for line in lines)
lines = [line for line in lines if not line.startswith('PROJECT_AUTH_MODE=')]
path.write_text('\n'.join(lines) + '\nPROJECT_AUTH_MODE=portal\n')
os.chmod(path, 0o600)
print('Projects configured for portal authentication; existing app passwords are disabled in this mode.')
