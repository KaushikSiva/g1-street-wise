"""Precompress large web assets once during image build, not on each request."""
import gzip
from pathlib import Path

for path in Path('dist').rglob('*'):
    if path.is_file() and path.suffix.lower() in {'.stl', '.fbx', '.json', '.urdf', '.js', '.css', '.svg'}:
        source = path.read_bytes()
        compressed = gzip.compress(source, compresslevel=6, mtime=0)
        if len(compressed) < .9*len(source):
            Path(str(path)+'.gz').write_bytes(compressed)
