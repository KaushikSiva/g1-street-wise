"""Check edited video, preserved scenes/audio, and QR readability."""
import json,re,subprocess
from pathlib import Path
import cv2,numpy as np
ROOT=Path(__file__).resolve().parents[2];media=ROOT/'artifacts/fork/media';work=ROOT/'.fork-runs/media/human-edit'
a=work/'STREETWISE-demo.mp4';b=media/'STREETWISE-demo.mp4'
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(b)]))
assert abs(float(probe['format']['duration'])-120)<.1
scores={}
for t in [5,32,65,105,111,116]:
 r=subprocess.run(['ffmpeg','-v','info','-ss',str(t),'-i',str(a),'-ss',str(t),'-i',str(b),'-filter_complex','[0:v][1:v]ssim','-t','0.4','-an','-f','null','-'],capture_output=True,text=True,check=True)
 score=float(re.findall(r'All:([0-9.]+)',r.stderr)[-1]);scores[t]=score
 assert score>.985,(t,score)
for t in [14,24,49,116]:
 subprocess.run(['ffmpeg','-y','-v','error','-ss',str(t),'-i',str(b),'-frames:v','1',str(work/f'final-{t}.png')],check=True)
qr,_,_=cv2.QRCodeDetector().detectAndDecode(cv2.imread(str(work/'final-116.png')))
assert qr=='https://streetwise-cppv.onrender.com/?robot=1&live=1'
def pcm(path):return np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-vn','-ac','1','-ar','48000','-f','f32le','-']),dtype=np.float32)
x,y=pcm(a),pcm(b);audio={}
for start,end in [(0,12),(27,43),(58,120)]:
 lo,hi=int((start+.15)*48000),int((end-.15)*48000)
 correlation=float(np.corrcoef(x[lo:hi],y[lo:hi])[0,1]);audio[f'{start}-{end}']=correlation
 assert correlation>.99,(start,end,correlation)
p=media/'human-edit-verification.json';report=json.loads(p.read_text());report.update(preservedSceneSSIM=scores,preservedAudioCorrelation=audio,qrDecodedFromEncodedVideo=qr,dimensions=[probe['streams'][0]['width'],probe['streams'][0]['height']]);p.write_text(json.dumps(report,indent=2));print(json.dumps({'duration':probe['format']['duration'],'sceneSSIM':scores,'audioCorrelation':audio,'qr':qr},indent=2))
