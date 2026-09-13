"""Compile deployment models at build time to avoid runtime mesh compilation peaks."""
import sys
from pathlib import Path
import mujoco
sys.path.insert(0,str(Path(__file__).parent/'robot'))
from environment import ROOT,make_scene
from hazards import hazard_scene
from streetlife import streetlife_scene
from emergencies import emergency_scene
import re
folder=ROOT/'.fork-runs/compiled-scenes';folder.mkdir(parents=True,exist_ok=True)
for builder in (make_scene,hazard_scene,streetlife_scene,emergency_scene):
 source=builder();model=mujoco.MjModel.from_xml_path(str(source))
 target=folder/(re.sub(r'-[0-9]+$', '', source.stem)+'.mjb')
 mujoco.mj_saveModel(model,str(target));del model
 print('Compiled',target.name,flush=True)
