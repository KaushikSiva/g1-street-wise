"""Export frozen gait and check recurrent inference against official TorchScript."""
import sys,json,hashlib
from pathlib import Path
import numpy as np
import torch
sys.path.insert(0,str(Path(__file__).parent/'robot'))
from numpy_gait import NumpyGait
root=Path(__file__).resolve().parents[2]
source=root/'vendor/unitree_rl_gym/deploy/pre_train/g1/motion.pt'
p=torch.jit.load(str(source)).eval();target=root/'artifacts/fork/live-demo/gait.npz'
np.savez(target,**{k:v.numpy() for k,v in p.state_dict().items() if k not in ('hidden_state','cell_state')},source_sha256=hashlib.sha256(source.read_bytes()).hexdigest())
n=NumpyGait(target);rng=np.random.default_rng(91);maximum=0.
for episode in range(8):
 p.reset_memory();n.reset_memory()
 for _ in range(500):
  x=rng.normal(0,.5,47).astype(np.float32)
  with torch.inference_mode():a=p(torch.from_numpy(x)[None]).numpy()[0]
  b=n(x);maximum=max(maximum,float(np.max(np.abs(a-b))))
assert maximum<1e-4,maximum
(target.parent/'gait-parity.json').write_text(json.dumps({'steps':4000,'max_absolute_action_error':maximum,'weights':'unchanged official Unitree LSTM','scope':'Numerical inference parity; floating point differences can affect long physics trajectories.'},indent=2))
print('gait parity',maximum)
