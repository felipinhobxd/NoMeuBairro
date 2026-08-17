from pathlib import Path

workflow = Path('.github/workflows/build-check.yml')
text = workflow.read_text()
old = 'run: npm install --no-audit --no-fund --package-lock=false'
new = 'run: npm ci --no-audit --no-fund'
if old not in text:
    raise SystemExit('build-check install command not found')
workflow.write_text(text.replace(old, new, 1))

Path('.github/workflows/regenerate-lockfile.yml').unlink(missing_ok=True)
Path('.github/regenerate_lockfile.py').unlink(missing_ok=True)
