"""Strict data boundary between generated code and the trusted simulator."""
import json
import math

MAX_BYTES = 65_536
MAX_SCENARIOS = 8
FIELDS = {'seed', 'car_speed', 'car_start_y', 'crossing_x'}
BOUNDS = {'car_speed': (1.0, 3.5), 'car_start_y': (-14.0, -7.0), 'crossing_x': (0.4, 1.2)}


def decode(raw):
    if len(raw.encode('utf-8')) > MAX_BYTES:
        raise ValueError('JSON exceeds 64 KiB')
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError('Duplicate JSON key')
            result[key] = value
        return result
    def invalid_constant(value):
        raise ValueError('Non-finite JSON number')
    return json.loads(raw, object_pairs_hook=pairs, parse_constant=invalid_constant)


def validate_batch(value, *, count=None):
    if not isinstance(value, dict) or set(value) != {'version', 'scenarios'}:
        raise ValueError('Expected only version and scenarios')
    if type(value['version']) is not int or value['version'] != 1:
        raise ValueError('Unsupported scenario version')
    rows = value['scenarios']
    if not isinstance(rows, list) or not 1 <= len(rows) <= MAX_SCENARIOS:
        raise ValueError('Expected 1–8 scenarios')
    if count is not None and len(rows) != count:
        raise ValueError('Generator returned the wrong scenario count')
    seeds = set()
    for row in rows:
        if not isinstance(row, dict) or set(row) != FIELDS:
            raise ValueError('Unexpected scenario fields')
        seed = row['seed']
        if type(seed) is not int or not 1 <= seed <= 8999 or seed in seeds:
            raise ValueError('Seeds must be unique training seeds from 1 to 8999')
        seeds.add(seed)
        for key, (low, high) in BOUNDS.items():
            v = row[key]
            if type(v) not in (int, float) or not math.isfinite(v) or not low <= v <= high:
                raise ValueError(f'{key} must be finite and between {low} and {high}')
    return value
