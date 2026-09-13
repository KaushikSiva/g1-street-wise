"""Copy only reviewable project files into the user's separate Git checkout."""
import argparse,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser();parser.add_argument('destination');args=parser.parse_args()
dest=Path(args.destination).resolve()
assert dest!=ROOT and (dest/'.git').is_dir(), 'Use a separate existing Git checkout.'
def copy(name):
 source=ROOT/name;target=dest/name
 if not source.exists():return
 target.parent.mkdir(parents=True,exist_ok=True)
 if source.is_dir():shutil.copytree(source,target,dirs_exist_ok=True,ignore=shutil.ignore_patterns('__pycache__','.DS_Store'))
 else:shutil.copy2(source,target)
for name in ['src','public','package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html','.env.example','scripts/fork','notebooks/streetwise_lab.py','notebooks/streetwise_cloud.py','docs/fork']:
 copy(name)
for name in ['rl-corridor-v2','rl-hazards-v2','rl-weather','curriculum','media','lab-data.json','experiment-lab.html','browser-verification.json','fresh-install-verification.json','unitree-sdk-verification.json','g1-policy-smoke.json','checkpoint-reproduction.json']:
 copy('artifacts/fork/'+name)
for folder in sorted((ROOT/'artifacts/fork').glob('rl-weather-level-*')):
 copy(str(folder.relative_to(ROOT)))
copy('artifacts/central-avenue/streetwise-finish')
copy('artifacts/web-city-realism')
copy('docs/districts/central-avenue-neighbors.md')
copy('docs/districts/central-avenue-neighbors-revision-4.md')
for name in ['streetlife', 'streetlife-multiple-shelters', 'emergencies-v1']:
 copy('artifacts/fork/'+name)
# These directories are generated assets: remove only files absent from the source
# so superseded mesh formats do not linger in the publication checkout.
for name in ['public/assets/fork/native-chennai', 'public/assets/fork/native-human']:
 for target in (dest/name).rglob('*'):
  if target.is_file() and not (ROOT/name/target.relative_to(dest/name)).exists():target.unlink()
# Remove the superseded exploratory hazard artifacts from the generated package.
if (dest/'artifacts/fork/rl-hazards').exists():shutil.rmtree(dest/'artifacts/fork/rl-hazards')
# Remove only non-deliverable files from this generated publication copy.
for name in ['docs/fork/participant-handbook.txt','public/assets/fork/unitree-g1.glb','public/assets/fork/human-source.fbx','public/assets/fork/walking-human.fbx','public/assets/fork/casual-walking.fbx','public/assets/fork/file2.png','public/assets/fork/vanguard_vanguard_diffuse_tga.png','public/assets/fork/Ch03_1001_Diffuse.png','public/assets/fork/Ch03_1001_Glossiness.png','public/assets/fork/Ch03_1001_Normal.png','public/assets/fork/Image.png','scripts/fork/robot/prepare_human.py']:
 (dest/name).unlink(missing_ok=True)
main=dest/'src/main.ts'
main.write_text("if (!location.search) history.replaceState(null, '', '?robot=1');\n"+main.read_text())
(dest/'.gitignore').write_text('node_modules/\ndist/\n.env\n.env.*\n!.env.example\n.fork-runs/\n.venv-fork/\nvendor/\n__pycache__/\n.DS_Store\n')
readme=(ROOT/'docs/fork/README.md').read_text().replace('(asset-provenance.md)','(docs/fork/asset-provenance.md)').replace('(submission-checklist.md)','(docs/fork/submission-checklist.md)').replace('(demo-script.md)','(docs/fork/demo-script.md)').replace('(submission.md)','(docs/fork/submission.md)').replace('(emergencies.md)','(docs/fork/emergencies.md)').replace('(../../artifacts/','(artifacts/')
(dest/'README.md').write_text('![STREETWISE beside Kanakadhara](artifacts/fork/media/human-kanakadhara.png)\n\n'+readme)
if not (dest/'artifacts/fork/media/STREETWISE-demo.mp4').exists():
 import re
 for p in [dest/'README.md',dest/'docs/fork/README.md']:
  p.write_text(re.sub(r'\[118-second demo\]\([^)]*\)', '118-second demo: rendering',p.read_text()))
print('Publication files copied into',dest)
