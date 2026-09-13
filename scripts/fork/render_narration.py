"""Create timed synthetic narration and captions for the 118-second demo (macOS)."""
import json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];out=ROOT/'artifacts/fork/media';scratch=ROOT/'.fork-runs/media';scratch.mkdir(parents=True,exist_ok=True)
segments=[]
for line in (ROOT/'docs/fork/demo-script.md').read_text().splitlines():
 if line.startswith('| ') and '–' in line:
  parts=[p.strip() for p in line.split('|')[1:-1]]
  try:start,end=map(int,parts[0].split('–'))
  except ValueError:continue
  segments.append({'start':start,'end':end,'screen':parts[1],'text':parts[2]})
for i,s in enumerate(segments):
 text=scratch/f'voice-{i}.txt';text.write_text(s['text']);aiff=scratch/f'voice-{i}.aiff';wav=scratch/f'voice-{i}.wav'
 subprocess.run(['say','-v','Samantha','-r','160','-f',str(text),'-o',str(aiff)],check=True)
 duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(aiff)],text=True))
 target=s['end']-s['start'];tempo=max(.85,duration/(target-.4))
 subprocess.run(['ffmpeg','-y','-v','error','-i',str(aiff),'-af',f'atempo={tempo:.5f},apad,atrim=duration={target}', '-ar','48000','-ac','1',str(wav)],check=True)
concat=scratch/'voice-concat.txt';concat.write_text(''.join(f"file 'voice-{i}.wav'\n" for i in range(len(segments))))
subprocess.run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(concat),'-c:a','libmp3lame','-b:a','160k',str(out/'narration.mp3')],check=True)
def stamp(t):return f'{int(t)//3600:02}:{int(t)//60%60:02}:{int(t)%60:02},{int(t%1*1000):03}'
cues=[]
for s in segments:
 words=s['text'].split();chunks=[words[i:i+12] for i in range(0,len(words),12)];duration=(s['end']-s['start'])/len(chunks)
 for i,chunk in enumerate(chunks):cues.append(f'{len(cues)+1}\n{stamp(s["start"]+i*duration)} --> {stamp(s["start"]+(i+1)*duration)}\n'+ ' '.join(chunk)+'\n')
(out/'captions.srt').write_text('\n'.join(cues));(out/'demo-timeline.json').write_text(json.dumps(segments,indent=2));print('Created 118-second narration and',len(cues),'caption cues')
