"""Edit the approved video locally: Chennai reference photo and plain-language narration."""
import concurrent.futures,hashlib,json,os,shutil,subprocess
from pathlib import Path
import requests
import wave
from dotenv import load_dotenv
ROOT=Path(__file__).resolve().parents[2]
MEDIA=ROOT/'artifacts/fork/media';WORK=ROOT/'.fork-runs/media/human-edit'
load_dotenv(ROOT/'.env')
SEGMENTS=[
 {'start':12,'end':16,'text':'We recreated a street in Chennai, India.'},
 {'start':16,'end':27,'text':'At first, the robot just keeps walking. A person steps out from behind the van, and the robot bumps into them.'},
 {'start':43,'end':58,'text':'These are the original training results from Weights and Biases. Across sixty-four pedestrian tests, successful crossings rose from forty-two to sixty-four. The robot also learned to give people more space.'},
]
CUES=[(12,16,'We recreated a street in Chennai, India.'),
      (16,19.,'At first, the robot just keeps walking.'),
      (19.,22.,'A person steps out from behind the van,'),
      (22.,27,'and the robot bumps into them.'),
      (43,47.5,'These are the original training results from Weights and Biases.'),
      (47.5,53.3,'Across sixty-four pedestrian tests, successful crossings rose from forty-two to sixty-four.'),
      (53.3,58,'The robot also learned to give people more space.')]

def run(args):return subprocess.run(args,check=True)
def speech(item):
 index,segment=item
 voice=os.getenv('FISH_AUDIO_REFERENCE_ID','324f49797a924f60a3004950b40d0f0e');model=os.getenv('FISH_AUDIO_MODEL','s2.1-pro-free')
 digest=hashlib.sha256((voice+model+segment['text']).encode()).hexdigest()[:16]
 source=WORK/f'{digest}.mp3';target=WORK/f'voice-{index}.wav'
 if not source.exists():
  response=requests.post('https://api.fish.audio/v1/tts',headers={'Authorization':'Bearer '+os.environ['FISH_AUDIO_API_KEY'],'model':model},json={'text':segment['text'],'reference_id':voice,'format':'mp3','mp3_bitrate':192,'temperature':.5,'prosody':{'speed':1,'normalize_loudness':True}},timeout=90)
  if not response.ok:raise RuntimeError(f'Fish Audio returned HTTP {response.status_code}')
  source.write_bytes(response.content)
 duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(source)]))
 length=segment['end']-segment['start'];tempo=max([.9,.78,.88][index],duration/(length-.2))
 pcm=subprocess.check_output(['ffmpeg','-v','error','-i',str(source),'-af',f'atempo={tempo}','-ar','48000','-ac','1','-f','s16le','-'])
 pcm=b'\0'*(4800*2)+pcm
 required=int(length*48000)*2
 pcm=(pcm+b'\0'*required)[:required]
 with wave.open(str(target),'wb') as audio:
  audio.setnchannels(1);audio.setsampwidth(2);audio.setframerate(48000);audio.writeframes(pcm)
 print(f'Updated narration {index+1}/3 ready',flush=True)
 return {**segment,'sourceDuration':duration,'tempo':tempo,'voiceId':voice,'model':model}

def caption_filters(start,end):
 filters=[]
 for i,(a,b,text) in enumerate(CUES):
  if a<start or b>end:continue
  path=WORK/f'caption-{i}.txt';path.write_text(text)
  filters.append(f"drawtext=fontfile='/System/Library/Fonts/Supplemental/Arial.ttf':textfile='{path}':fontsize=27:fontcolor=0xfff9ec:box=1:boxcolor=0x10271e:boxborderw=15:x=(w-tw)/2:y=1014:enable='gte(t,{a-start})*lt(t,{b-start})'")
 return ','.join(filters)

def stamp(t):
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'

def main():
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:voices=list(pool.map(speech,enumerate(SEGMENTS)))
 source=WORK/'STREETWISE-demo.mp4';target=WORK/'STREETWISE-demo-human.mp4'
 filters=[
  '[0:v]split=5[s0][s1][s2][s3][s4]',
  '[s0]trim=start=0:end=12,setpts=PTS-STARTPTS,setsar=1[v0]',
  '[1:v]trim=duration=4,setpts=PTS-STARTPTS,setsar=1,'+caption_filters(12,16)+'[v1]',
  '[s1]trim=start=12:end=23,setpts=PTS-STARTPTS,drawbox=x=0:y=966:w=iw:h=114:color=0xf1f0e7:t=fill,'
   "drawbox=x=1350:y=908:w=515:h=45:color=0x173528:t=fill:enable='gte(t,4)',"
   "drawtext=fontfile='/System/Library/Fonts/Supplemental/Arial.ttf':text='Bumped into a person':fontsize=26:fontcolor=0xffd28b:x=1500:y=918:enable='gte(t,4)',"+caption_filters(16,27)+'[v2]',
  '[s2]trim=start=27:end=43,setpts=PTS-STARTPTS[v3]',
  '[s3]trim=start=43:end=58,setpts=PTS-STARTPTS,drawbox=x=0:y=966:w=iw:h=114:color=0xf1f0e7:t=fill,'+caption_filters(43,58)+'[v4]',
  '[s4]trim=start=58:end=120,setpts=PTS-STARTPTS[v5]',
  '[v0][v1][v2][v3][v4][v5]concat=n=6:v=1:a=0[v]',
  '[0:a]asplit=3[b0][b1][b2]',
  '[b0]atrim=start=0:end=12,asetpts=PTS-STARTPTS[a0]',
  '[b1]atrim=start=27:end=43,asetpts=PTS-STARTPTS[a1]',
  '[b2]atrim=start=58:end=120,asetpts=PTS-STARTPTS[a2]',
  '[a0][2:a][3:a][a1][4:a][a2]concat=n=6:v=0:a=1[a]'
 ]
 graph=WORK/'filters.txt';graph.write_text(';\n'.join(filters))
 command=['ffmpeg','-y','-v','error','-i',str(source),'-loop','1','-framerate','25','-i',str(MEDIA/'chennai-reference-card.png')]
 for i in range(3):command+=['-i',str(WORK/f'voice-{i}.wav')]
 command+=['-filter_complex_script',str(graph),'-map','[v]','-map','[a]','-t','120','-r','25','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',str(target)]
 run(command)
 run(['ffmpeg','-v','error','-i',str(target),'-f','null','-'])
 shutil.copy2(target,MEDIA/'STREETWISE-demo.mp4')
 run(['ffmpeg','-y','-v','error','-i',str(target),'-vn','-c:a','libmp3lame','-b:a','192k',str(MEDIA/'narration.mp3')])
 # Retain every untouched caption cue verbatim; replace only the edited intervals.
 rows=[]
 for block in (WORK/'captions.srt').read_text().strip().split('\n\n'):
  lines=block.splitlines();a,b=lines[1].split(' --> ')
  def seconds(x):
   h,m,s=x.replace(',','.').split(':');return int(h)*3600+int(m)*60+float(s)
  start,end=seconds(a),seconds(b)
  if (start>=12 and end<=27) or (start>=43 and end<=58):continue
  rows.append((start,end,'\n'.join(lines[2:])))
 rows.extend(CUES);rows.sort()
 (MEDIA/'captions.srt').write_text('\n\n'.join(f'{i+1}\n{stamp(a)} --> {stamp(b)}\n{text}' for i,(a,b,text) in enumerate(rows))+'\n')
 timeline=json.loads((WORK/'demo-timeline.json').read_text());timeline[1:2]=[{**s,'screen':'User-supplied Chennai Street View reference' if s['start']==12 else 'Recorded robot bumps into a person'} for s in SEGMENTS[:2]]
 for row in timeline:
  if row['start']==43:row['text']=SEGMENTS[2]['text']
 (MEDIA/'demo-timeline.json').write_text(json.dumps(timeline,indent=2))
 report={'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'duration':120,'changedIntervals':[[12,27],[43,58]],'streetPhotoInterval':[12,16],'reference':'chennai-street-reference.png','voices':voices,'unchangedContentIntervals':[[0,12],[27,43],[58,120]],'thankYou':[110,112],'qr':[112,120],'decode':'passed','note':'The plotted aggregate metrics remain the original center-clearance benchmark, as stated in the updated narration.'}
 (MEDIA/'human-edit-verification.json').write_text(json.dumps(report,indent=2))
 print(json.dumps(report,indent=2))
if __name__=='__main__':main()
