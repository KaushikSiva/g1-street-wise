"""Verify publication boundaries without echoing secrets or private file contents."""
import json,re,subprocess,hashlib
from pathlib import Path
from dotenv import dotenv_values
ROOT=Path(__file__).resolve().parents[2]
PUBLICATION=ROOT.parent/'g1-street-wise'
secrets=[v.encode() for k,v in dotenv_values(ROOT/'.env').items() if v and ('KEY' in k or 'TOKEN' in k)]
pair=ROOT/'.fork-runs/pairing/token'
if pair.exists():secrets.append(pair.read_bytes().strip())
ignored={'.git','node_modules','dist','.venv-fork','vendor','.fork-runs','__pycache__'}
files=[p for p in PUBLICATION.rglob('*') if p.is_file() and not any(part in ignored for part in p.relative_to(PUBLICATION).parts) and p.name!='.env']
leaks=[];large=[];links=[]
for p in files:
 b=p.read_bytes()
 if any(s in b for s in secrets):leaks.append(str(p.relative_to(PUBLICATION)))
 if len(b)>95_000_000:large.append(str(p.relative_to(PUBLICATION)))
 if p.suffix=='.md':
  for target in re.findall(r'\]\(([^)]+)\)',b.decode(errors='replace')):
   target=target.split('#')[0]
   if not target or '://' in target or target.startswith(('mailto:','http')):continue
   if not (p.parent/target).exists():links.append({'file':str(p.relative_to(PUBLICATION)),'target':target})
assert not leaks, 'Credential content detected; filenames intentionally withheld.'
assert not large, f'Files exceed GitHub size budget: {large}'
assert not links, f'Broken Markdown links: {links}'
manifest={str(p.relative_to(PUBLICATION)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
(PRIVATE:=ROOT/'.fork-runs/publication-verification.json').write_text(json.dumps({'files':len(files),'credentialScan':'passed','largeFiles':large,'brokenLinks':links,'manifest':manifest},indent=2))
print(f'PASS: {len(files)} publication files; no credentials, oversized files or broken Markdown links.')
