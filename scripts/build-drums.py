"""Builds public/samples/drums-rusty/ from Karoryfer "Big Rusty Drums" (CC0).

Download: https://github.com/sfzinstruments/karoryfer.big-rusty-drums/releases/download/v1.100/Big_Rusty_Drums_1100.zip
Usage:    BRD_ZIP=path/to/Big_Rusty_Drums_1100.zip python3 scripts/build-drums.py report.json   (requires ffmpeg, numpy)

For each drum: 4 velocity layers (soft → hard) x 2 round robins, close + overhead mics mixed to mono.
Unlike the melodic sets, a drum is normalized as a whole (one gain for all its layers), so soft layers stay soft.
Output: drums-rusty/<drum>/v<1-4>_rr<1-2>.flac — keep DRUM_KIT in src/app/data/sample-manifests.ts in sync.
"""
import json, os, subprocess, sys, tempfile, zipfile
import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'samples', 'drums-rusty')

# drum → (sample folder, file prefix, number of layers in the library, {mic folder: gain}, max length s)
KIT = {
    'kick':      ('kick_24/kick',    'k',         14, {'kick': 1.0, 'oh': 0.5},             1.2),
    'snare':     ('snare_14/center', 'sn_center', 10, {'top': 1.0, 'btm': 0.35, 'oh': 0.6}, 1.5),
    'tom-high':  ('tom_14/center',   't14',        6, {'cl': 1.0, 'oh': 0.55},              1.8),
    'tom-mid':   ('tom_15/center',   't15',        7, {'cl': 1.0, 'oh': 0.55},              1.8),
    'tom-low':   ('tom_18/center',   't18',        8, {'cl': 1.0, 'oh': 0.55},              2.2),
    'hat-closed':('hihat_14/cl',     'ht_cl',      6, {'cl': 1.0, 'oh': 0.6},               0.6),
    'hat-open':  ('hihat_14/open',   'ht_open',    6, {'cl': 1.0, 'oh': 0.6},               2.0),
    'crash':     ('crash_17/cr',     'cr',         5, {'cl': 0.8, 'oh': 1.0},               3.5),
    'ride':      ('ride_22/rd',      'rd',        10, {'cl': 1.0, 'oh': 0.7},               3.0),
}
LAYERS, RRS = 4, 2

def pick_layers(n):
    """4 layers spread over the top 60% of the library (the softest ones are barely audible taps)."""
    return sorted({max(1, round(n * f)) for f in (0.45, 0.65, 0.85, 1.0)})

def decode(data):
    with tempfile.NamedTemporaryFile(suffix='.flac', delete=False) as f:
        f.write(data); path = f.name
    try:
        raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                             capture_output=True, check=True).stdout
    finally:
        os.remove(path)
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)

def find(z, folder, mic, prefix, vl, rr):
    name = f'Samples/{folder}/{mic}/{prefix}_vl{vl}_rr{rr}.flac'
    if name in z.NameToInfo: return name
    raise FileNotFoundError(name)

def encode(y, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    pcm = (np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg', '-v', 'quiet', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    '-compression_level', '8', dst], input=pcm, check=True)

z = zipfile.ZipFile(os.environ['BRD_ZIP'])
report = {}
for drum, (folder, prefix, n_layers, mics, max_len) in KIT.items():
    layers = pick_layers(n_layers)
    clips = {}
    for li, vl in enumerate(layers, 1):
        for rr in range(1, RRS + 1):
            parts = [decode(z.read(find(z, folder, mic, prefix, vl, rr))) * g for mic, g in mics.items()]
            n = max(len(p) for p in parts)
            mix = sum(np.pad(p, (0, n - len(p))) for p in parts)
            peak = np.max(np.abs(mix)) or 1.0
            onset = int(np.argmax(np.abs(mix) > peak * 0.02))
            y = mix[max(0, onset - int(SR * 0.001)):][:int(SR * max_len)]
            fade = min(len(y), int(SR * 0.15))
            y[-fade:] *= np.linspace(1, 0, fade)
            clips[(li, rr)] = (vl, y)
    gain = 0.891 / max(np.max(np.abs(y)) for _, y in clips.values())  # -1 dBFS on the loudest hit of this drum
    rows = []
    for (li, rr), (vl, y) in sorted(clips.items()):
        encode(y * gain, f'{OUT}/{drum}/v{li}_rr{rr}.flac')
        rows.append({'layer': li, 'rr': rr, 'source_vl': vl, 'peak_db': round(20 * np.log10(np.max(np.abs(y * gain))), 1),
                     'len_s': round(len(y) / SR, 2)})
    report[drum] = rows
    print(drum, 'layers', layers, file=sys.stderr)
json.dump(report, open(sys.argv[1], 'w'), indent=1)
