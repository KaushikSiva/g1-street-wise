"""Append a 20-second Wasmer chapter before the approved thank-you/QR ending."""
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import wave

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / '.fork-runs/media/wasmer-edit'
MEDIA = ROOT / 'artifacts/fork/media'
SEGMENTS = [
    {'start': 110, 'end': 116, 'text': 'We also added Wasmer. Our AI writes new car crossing tests.'},
    {'start': 116, 'end': 123, 'text': 'Wasmer runs that code in a sandbox. We check the scenarios it produces.'},
    {'start': 123, 'end': 130, 'text': 'Then MuJoCo tests both robot policies. Here, the trained robot passed all three new scenarios.'},
]


def run(args):
    subprocess.run(args, check=True)


def voice(item):
    i, segment = item
    voice_id = os.getenv('FISH_AUDIO_REFERENCE_ID', '324f49797a924f60a3004950b40d0f0e')
    model = os.getenv('FISH_AUDIO_MODEL', 's2.1-pro-free')
    digest = hashlib.sha256((voice_id + model + segment['text']).encode()).hexdigest()[:16]
    source = WORK / f'{digest}.mp3'
    if not source.exists():
        response = requests.post('https://api.fish.audio/v1/tts',
            headers={'Authorization': 'Bearer ' + os.environ['FISH_AUDIO_API_KEY'], 'model': model},
            json={'text': segment['text'], 'reference_id': voice_id, 'format': 'mp3',
                  'mp3_bitrate': 192, 'temperature': .5, 'prosody': {'speed': 1, 'normalize_loudness': True}},
            timeout=90)
        if not response.ok:
            raise RuntimeError(f'Fish Audio returned HTTP {response.status_code}')
        source.write_bytes(response.content)
    duration = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(source)]))
    length = segment['end'] - segment['start']
    tempo = max(.85, duration / (length - .3))
    pcm = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(source), '-af', f'atempo={tempo}', '-ar', '48000', '-ac', '1', '-f', 's16le', '-'])
    pcm = b'\0' * 9600 + pcm
    required = length * 48000 * 2
    pcm = (pcm + b'\0' * required)[:required]
    with wave.open(str(WORK / f'voice-{i}.wav'), 'wb') as output:
        output.setnchannels(1); output.setsampwidth(2); output.setframerate(48000); output.writeframes(pcm)
    print(f'Wasmer narration {i+1}/3 ready', flush=True)
    return {**segment, 'voice_id': voice_id, 'model': model, 'source_duration': duration, 'tempo': tempo}


def stamp(t):
    ms = round(t * 1000)
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'


def main():
    load_dotenv(ROOT / '.env')
    WORK.mkdir(parents=True, exist_ok=True)
    for name in ['STREETWISE-demo.mp4', 'captions.srt', 'demo-timeline.json', 'narration.mp3']:
        if not (WORK / name).exists():
            shutil.copy2(MEDIA / name, WORK / name)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        voices = list(pool.map(voice, enumerate(SEGMENTS)))
    source = WORK / 'STREETWISE-demo.mp4'
    target = MEDIA / 'STREETWISE-demo-wasmer.mp4'
    command = ['ffmpeg', '-y', '-v', 'error', '-i', str(source)]
    for i in range(3):
        command += ['-loop', '1', '-framerate', '25', '-i', str(WORK / f'card-{i}.png')]
    for i in range(3):
        command += ['-i', str(WORK / f'voice-{i}.wav')]
    filters = [
        '[0:v]split=2[old0][old1]',
        '[old0]trim=start=0:end=110,setpts=PTS-STARTPTS,setsar=1[v0]',
        '[old1]trim=start=110:end=120,setpts=PTS-STARTPTS,setsar=1[v4]',
        '[0:a]asplit=2[oa0][oa1]',
        '[oa0]atrim=start=0:end=110,asetpts=PTS-STARTPTS[a0]',
        '[oa1]atrim=start=110:end=120,asetpts=PTS-STARTPTS[a4]',
    ]
    for i, segment in enumerate(SEGMENTS):
        filters.append(f'[{i+1}:v]trim=duration={segment["end"]-segment["start"]},setpts=PTS-STARTPTS,setsar=1[v{i+1}]')
    filters += ['[v0][v1][v2][v3][v4]concat=n=5:v=1:a=0[v]',
                '[a0][4:a][5:a][6:a][a4]concat=n=5:v=0:a=1[a]']
    graph = WORK / 'filters.txt'; graph.write_text(';\n'.join(filters))
    command += ['-filter_complex_script', str(graph), '-map', '[v]', '-map', '[a]', '-t', '140', '-r', '25',
                '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p',
                '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', str(target)]
    run(command)
    # Sidecars for the extended cut; originals remain backed up in WORK.
    cues = []
    def seconds(value):
        h, m, s = value.replace(',', '.').split(':')
        return int(h)*3600 + int(m)*60 + float(s)
    for block in (WORK / 'captions.srt').read_text().strip().split('\n\n'):
        lines = block.splitlines()
        start, end = map(seconds, lines[1].split(' --> '))
        if start >= 110:
            start += 20; end += 20
        cues.append((start, end, '\n'.join(lines[2:])))
    cues.extend((s['start'], s['end'], s['text']) for s in SEGMENTS)
    cues.sort()
    (MEDIA / 'captions-wasmer.srt').write_text('\n\n'.join(f'{i+1}\n{stamp(a)} --> {stamp(b)}\n{text}' for i, (a,b,text) in enumerate(cues)) + '\n')
    timeline = json.loads((WORK / 'demo-timeline.json').read_text())
    for entry in timeline:
        if entry['start'] >= 110:
            entry['start'] += 20; entry['end'] += 20
    timeline.extend({**s, 'screen': label} for s,label in zip(SEGMENTS, ['Actual AI-generated Python', 'Wasmer sandbox and validated scenario output', 'Actual MuJoCo comparison results']))
    timeline.sort(key=lambda x:x['start'])
    (MEDIA / 'demo-timeline-wasmer.json').write_text(json.dumps(timeline, indent=2))
    evidence = json.loads((WORK / 'evidence.json').read_text())
    (MEDIA / 'wasmer-video-verification.json').write_text(json.dumps({
        'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'wasmer_interval': [110,130], 'thank_you': [130,132], 'qr': [132,140],
        'duration': 140, 'voices': voices, 'experiment': evidence, 'verification': 'pending'
    }, indent=2))
    print(f'Rendered {target}', flush=True)


if __name__ == '__main__':
    main()
