"""Generate local timed narration with Fish Audio; credentials stay in private .env.

API: https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech
"""
import concurrent.futures,hashlib,json,os,subprocess,time
from pathlib import Path
import requests
from dotenv import load_dotenv
ROOT=Path(__file__).resolve().parents[2];load_dotenv(ROOT/'.env')
out=ROOT/'artifacts/fork/media';scratch=ROOT/'.fork-runs/media/fish';scratch.mkdir(parents=True,exist_ok=True)
voice=os.getenv('FISH_AUDIO_REFERENCE_ID','324f49797a924f60a3004950b40d0f0e')
model=os.getenv('FISH_AUDIO_MODEL','s2.1-pro-free')
segments=[]
for line in (ROOT/'docs/fork/demo-script.md').read_text().splitlines():
 if not line.startswith('| ') or '–' not in line:continue
 parts=[p.strip() for p in line.split('|')[1:-1]]
 try:start,end=map(int,parts[0].split('–'))
 except ValueError:continue
 segments.append({'start':start,'end':end,'screen':parts[1],'text':parts[2]})
def generate(pair):
 i,s=pair;digest=hashlib.sha256((voice+model+s['text']).encode()).hexdigest()[:16]
 source=scratch/f'{digest}.mp3';target=scratch/f'part-{i}.wav'
 if not source.exists():
  for attempt in range(3):
   response=requests.post('https://api.fish.audio/v1/tts',headers={'Authorization':'Bearer '+os.environ['FISH_AUDIO_API_KEY'],'model':model},json={'text':s['text'],'reference_id':voice,'format':'mp3','mp3_bitrate':192,'temperature':.5,'prosody':{'speed':1,'normalize_loudness':True}},timeout=90)
   if response.ok:source.write_bytes(response.content);break
   if response.status_code not in (429,503):raise RuntimeError(f'Fish Audio HTTP {response.status_code}: {response.text[:180]}')
   time.sleep(3*(attempt+1))
  else:raise RuntimeError('Fish Audio remained unavailable after retries.')
 duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(source)]))
 length=s['end']-s['start'];tempo=max(1.0,duration/(length-.35))
 subprocess.run(['ffmpeg','-y','-v','error','-i',str(source),'-af',f'atempo={tempo:.6f},apad,atrim=duration={length}','-ar','48000','-ac','1',str(target)],check=True)
 print(f'Fish narration segment {i+1}/{len(segments)} ready',flush=True)
 return {'segment':i,'sourceDuration':duration,'tempo':tempo,'textSha256':hashlib.sha256(s['text'].encode()).hexdigest()}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:evidence=list(pool.map(generate,enumerate(segments)))
concat=scratch/'concat.txt';concat.write_text(''.join(f"file 'part-{i}.wav'\n" for i in range(len(segments))))
subprocess.run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(concat),'-c:a','libmp3lame','-b:a','192k',str(out/'narration.mp3')],check=True)
def stamp(t):return f'{int(t)//3600:02}:{int(t)//60%60:02}:{int(t)%60:02},{int(t%1*1000):03}'
cues=[]
for s in segments:
 words=s['text'].split();chunks=[words[i:i+12] for i in range(0,len(words),12)];duration=(s['end']-s['start'])/len(chunks)
 for i,chunk in enumerate(chunks):cues.append(f'{len(cues)+1}\n{stamp(s["start"]+i*duration)} --> {stamp(s["start"]+(i+1)*duration)}\n'+ ' '.join(chunk)+'\n')
(out/'captions.srt').write_text('\n'.join(cues));(out/'demo-timeline.json').write_text(json.dumps(segments,indent=2))
(out/'narration-provenance.json').write_text(json.dumps({'provider':'Fish Audio','model':model,'voiceId':voice,'voiceTitle':'South Indian Male','catalogDescription':'Male, middle-aged, calm, clear, professional narration.','synthetic':True,'segments':evidence},indent=2))
print('Created 118-second Fish Audio narration and captions.')
