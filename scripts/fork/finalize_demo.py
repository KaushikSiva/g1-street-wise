"""Keep the approved first 110 seconds, then thank-you (2s) and live QR (8s)."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import urllib.request
from urllib.parse import urlparse

import cv2

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', required=True)
    parser.add_argument('--source', default='.fork-runs/media/thank-you/approved-through-110.mp4')
    parser.add_argument('--thanks', default='.fork-runs/media/thank-you/thank-you.mp3')
    args = parser.parse_args()
    parsed = urlparse(args.url)
    if parsed.scheme != 'https' or not parsed.hostname.endswith('.onrender.com'):
        raise SystemExit('Use the verified public Render HTTPS URL.')
    with urllib.request.urlopen(f'{parsed.scheme}://{parsed.netloc}/live-api/health', timeout=90) as response:
        health = json.load(response)
    assert health.get('ready') and health.get('physics') == 'MuJoCo', 'Deploy and verify Render before encoding its QR.'
    media = ROOT/'artifacts/fork/media'
    matrix = cv2.QRCodeEncoder_create().encode(args.url)
    border = 4
    size = matrix.shape[0]+2*border
    cells = ''.join(f'M{x+border} {y+border}h1v1h-1z' for y in range(matrix.shape[0]) for x in range(matrix.shape[1]) if matrix[y, x] == 0)
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" shape-rendering="crispEdges"><rect width="{size}" height="{size}" fill="white"/><path d="{cells}" fill="#102c1e"/></svg>'
    (media/'STREETWISE-QR.svg').write_text(svg)
    subprocess.run(['node', 'scripts/fork/finalize-demo.mjs', args.url], cwd=ROOT, check=True)
    decoded, _, _ = cv2.QRCodeDetector().detectAndDecode(cv2.imread(str(media/'STREETWISE-QR.png')))
    assert decoded == args.url, f'End-card QR failed decoding: {decoded!r}'
    target = ROOT/'.fork-runs/media/thank-you/finished-demo.mp4'
    filters = ('[0:v]trim=duration=110,setpts=PTS-STARTPTS,fps=25,setsar=1[v0];'
               '[1:v]trim=duration=2,setpts=PTS-STARTPTS,fps=25,setsar=1[v1];'
               '[2:v]trim=duration=8,setpts=PTS-STARTPTS,fps=25,setsar=1[v2];'
               '[v0][v1][v2]concat=n=3:v=1:a=0[v];'
               '[0:a]atrim=duration=110,asetpts=PTS-STARTPTS,aresample=48000[a0];'
               '[3:a]adelay=250:all=1,apad,atrim=duration=10,asetpts=PTS-STARTPTS,aresample=48000[a1];'
               '[a0][a1]concat=n=2:v=0:a=1[a]')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(ROOT/args.source),
                    '-loop', '1', '-framerate', '25', '-i', str(media/'thank-you.png'),
                    '-loop', '1', '-framerate', '25', '-i', str(media/'STREETWISE-QR.png'),
                    '-i', str(ROOT/args.thanks), '-filter_complex', filters,
                    '-map', '[v]', '-map', '[a]', '-t', '120', '-c:v', 'libx264', '-preset', 'fast',
                    '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
                    '-movflags', '+faststart', str(target)], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(target), '-f', 'null', '-'], check=True)
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(target)]))
    assert abs(float(probe['format']['duration'])-120) < .1
    frame = target.with_suffix('.qr.png')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', '116', '-i', str(target), '-frames:v', '1', str(frame)], check=True)
    decoded, _, _ = cv2.QRCodeDetector().detectAndDecode(cv2.imread(str(frame)))
    assert decoded == args.url, 'QR did not survive video encoding.'
    shutil.copy2(target, media/'STREETWISE-demo.mp4')
    shutil.copy2(ROOT/args.thanks, media/'thank-you.mp3')
    report = {'duration': 120, 'decode': 'passed', 'first110Seconds': 'Approved video content retained',
              'sourceSha256': hashlib.sha256((ROOT/args.source).read_bytes()).hexdigest(),
              'thankYou': [110, 112], 'qrCard': [112, 120], 'url': args.url,
              'qrDecodedFromPNG': True, 'qrDecodedFromEncodedVideo': True,
              'streams': [{k: s[k] for k in ('codec_name', 'width', 'height') if k in s} for s in probe['streams']]}
    (media/'video-verification.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
