"""Verify the new chapter, preserved original content, audio and QR."""
import json
from pathlib import Path
import re
import shutil
import subprocess

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
MEDIA = ROOT / 'artifacts/fork/media'
WORK = ROOT / '.fork-runs/media/wasmer-edit'
source = WORK / 'STREETWISE-demo.mp4'
target = MEDIA / 'STREETWISE-demo-wasmer.mp4'
probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(target)]))
assert abs(float(probe['format']['duration']) - 140) < .05
video = next(s for s in probe['streams'] if s['codec_type'] == 'video')
assert (video['width'], video['height'], video['r_frame_rate']) == (1920,1080,'25/1')
subprocess.run(['ffmpeg', '-v', 'error', '-i', str(target), '-f', 'null', '-'], check=True)
ssim = {}
for old, new in [(5,5),(24,24),(65,65),(105,105),(111,131),(116,136)]:
    result = subprocess.run(['ffmpeg', '-v', 'info', '-ss', str(old), '-i', str(source), '-ss', str(new), '-i', str(target), '-filter_complex', '[0:v][1:v]ssim', '-t', '0.4', '-an', '-f', 'null', '-'], capture_output=True, text=True, check=True)
    score = float(re.findall(r'All:([0-9.]+)', result.stderr)[-1])
    assert score > .985, (old,new,score)
    ssim[f'{old}->{new}'] = score
for t in [113,119,126,131,136]:
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', str(t), '-i', str(target), '-frames:v', '1', str(WORK / f'final-{t}.png')], check=True)
qr,_,_ = cv2.QRCodeDetector().detectAndDecode(cv2.imread(str(WORK / 'final-136.png')))
assert qr == 'https://streetwise-cppv.onrender.com/?robot=1&live=1'
def pcm(path):
    return np.frombuffer(subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path), '-vn', '-ac', '1', '-ar', '48000', '-f', 'f32le', '-']), dtype=np.float32)
x, y = pcm(source), pcm(target)
correlations = {}
for old,new,length in [(0,0,110),(110,130,10)]:
    a=x[int((old+.15)*48000):int((old+length-.15)*48000)]
    b=y[int((new+.15)*48000):int((new+length-.15)*48000)]
    score=float(np.corrcoef(a,b)[0,1]); assert score>.99,score
    correlations[f'{old}->{new}']=score
report_path=MEDIA/'wasmer-video-verification.json'
report=json.loads(report_path.read_text())
report.update(verification='passed',decode='passed',preserved_scene_ssim=ssim,
              preserved_audio_correlation=correlations,qr_decoded=qr,dimensions=[1920,1080])
report_path.write_text(json.dumps(report,indent=2))
desktop=Path.home() / 'Desktop' / 'STREETWISE Demo'
desktop.mkdir(parents=True,exist_ok=True)
for name in ['STREETWISE-demo-wasmer.mp4','captions-wasmer.srt','demo-timeline-wasmer.json','wasmer-video-verification.json']:
    shutil.copy2(MEDIA/name,desktop/name)
print(json.dumps({'verification':'passed','duration':140,'qr':qr,'preserved_audio':correlations,'desktop':str(desktop/'STREETWISE-demo-wasmer.mp4')},indent=2))
