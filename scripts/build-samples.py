"""Builds public/samples/ for Loomin.

Every file: leading silence trimmed (so notes start exactly on the beat), length capped with a fade,
peak-normalized to -1 dBFS, mono 16-bit FLAC (no MP3 encoder delay), and pitch-checked against its note name.

Sources (clone them first; see public/samples/CREDITS.md for licenses):
  git clone --depth 1 https://github.com/nbrosowsky/tonejs-instruments   $TJI_REPO
  git clone --depth 1 https://github.com/samirsalmi/samples              $OLD_REPO   (piano, upright, Emily, BJAM, drums)
  git clone --depth 1 https://github.com/Tonejs/audio                    $TONE_AUDIO (berklee/Clap2.mp3)

Usage: TJI_REPO=... OLD_REPO=... TONE_AUDIO=... python3 scripts/build-samples.py report.json
Requires ffmpeg and numpy. After rebuilding, regenerate the note lists in src/app/data/sample-manifests.ts.
Known fixes applied: piano wrong-pitch copies skipped, french-horn A3 (really A4) skipped,
nylon-guitar "D5" is really D#5 (renamed after the build).
"""
import os, re, subprocess, json, sys, glob
import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'samples')
TJI = os.path.join(os.environ['TJI_REPO'], 'samples')
OLD = os.environ['OLD_REPO']
NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

def midi_of(note):
    m = re.match(r'^([A-G])(s|#)?(-?\d+)$', note)
    return (int(m.group(3)) + 1) * 12 + NAMES.index(m.group(1) + ('#' if m.group(2) else ''))

def note_of(midi): return f"{NAMES[midi % 12]}{midi // 12 - 1}"

def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()

def yin(x, lo=27, hi=4200):
    W = 4096; maxlag = int(SR / lo); minlag = int(SR / hi)
    if len(x) < W + maxlag + 2: return None
    seg = x[:W + maxlag + 2].astype(np.float64)
    d = np.array([np.sum((seg[:W] - seg[t:t + W]) ** 2) for t in range(maxlag + 2)])
    cm = np.ones_like(d); cm[1:] = d[1:] * np.arange(1, len(d)) / np.maximum(np.cumsum(d[1:]), 1e-12)
    t = None
    for k in range(minlag, maxlag):
        if cm[k] < 0.15:
            while k + 1 < maxlag and cm[k + 1] < cm[k]: k += 1
            t = k; break
    if t is None: t = minlag + int(np.argmin(cm[minlag:maxlag]))
    a, b, c = cm[t - 1], cm[t], cm[t + 1]; den = a - 2 * b + c
    tt = t + (0.5 * (a - c) / den if den else 0)
    return SR / tt

def process(src, dst, max_len, check_pitch_midi=None, fade=0.08):
    x = decode(src)
    peak = float(np.max(np.abs(x))) or 1.0
    onset = int(np.argmax(np.abs(x) > peak * 0.02))
    start = max(0, onset - int(SR * 0.001))
    y = x[start:start + int(SR * max_len)]
    n_f = min(len(y), int(SR * fade))
    y[-n_f:] *= np.linspace(1, 0, n_f)
    y = y / peak * 0.891  # -1 dBFS
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    pcm = (np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg', '-v', 'quiet', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    '-compression_level', '8', dst], input=pcm, check=True)
    info = {'file': os.path.relpath(dst, OUT), 'trimmed_ms': round(start / SR * 1000, 1), 'len_s': round(len(y) / SR, 2)}
    if check_pitch_midi is not None:
        body = y[int(SR * 0.12):]
        f = yin(body) if len(body) > 10000 else yin(y)
        if f:
            got = 69 + 12 * np.log2(f / 440)
            info['cents_off'] = round((got - check_pitch_midi) * 100)
    return info

report = {}
def add_set(key, files, max_len, pitched=True):
    """files: list of (src_path, note_name)"""
    rows = []
    for src, note in files:
        midi = midi_of(note)
        dst = f"{OUT}/{key}/{note_of(midi).replace('#', 's')}.flac"
        rows.append({'note': note_of(midi), **process(src, dst, max_len, midi if pitched else None)})
    report[key] = rows
    print(key, len(rows), file=sys.stderr)

def tji(folder, exclude=()):
    out = []
    for p in sorted(glob.glob(f'{TJI}/{folder}/*.wav')):
        name = os.path.basename(p)[:-4]
        if ' ' in name or name in exclude: continue
        out.append((p, name))
    return out

PIANO_WRONG = {21, 22, 24, 25, 26, 28, 30, 32, 34, 36, 39, 42, 44, 46, 49, 51, 54, 61, 63, 66, 68, 70, 73, 75, 78, 84}
piano = []
for p in sorted(glob.glob(f'{OLD}/piano/*.flac')):
    m = int(os.path.basename(p)[:3])
    if m not in PIANO_WRONG: piano.append((p, note_of(m)))
add_set('acoustic-piano', piano, 4.5)
add_set('upright-piano', [(p, os.path.basename(p)[:-7]) for p in sorted(glob.glob(f'{OLD}/vsco-upright/*vH.flac'))], 3.5)
add_set('acoustic-guitar', tji('guitar-acoustic'), 3.5)
add_set('nylon-guitar', tji('guitar-nylon'), 3.5)
add_set('electric-guitar', tji('guitar-electric'), 3.5)
add_set('electric-bass', tji('bass-electric'), 3.0)
add_set('emily-guitar', [(p, os.path.basename(p)[6:-5]) for p in sorted(glob.glob(f'{OLD}/karoryfer-guitar/Emily_*.flac'))], 3.5)
add_set('bjam-guitar', [(f'{OLD}/bjam-guitar/BJAM_{n}.flac', n) for n in ['E2', 'A2', 'D3', 'G3', 'B3', 'E4']], 3.5)
add_set('violin', tji('violin'), 5.0)
add_set('cello', tji('cello'), 5.0)
add_set('flute', tji('flute'), 5.0)
add_set('trumpet', tji('trumpet'), 5.0)
add_set('french-horn', tji('french-horn', exclude=('A3',)), 5.0)

drums = []
for name, f in [('kick', 'kick'), ('snare', 'snare'), ('hat-closed', 'hat-closed'), ('hat-open', 'hat-open'),
                ('tom-low', 'tom-low'), ('tom-mid', 'tom-mid'), ('tom-high', 'tom-high'), ('ride', 'ride'), ('crash', 'crash')]:
    drums.append(process(f'{OLD}/drums/{f}.mp3', f'{OUT}/drums/{name}.flac', 2.5, fade=0.15))
drums.append(process(os.path.join(os.environ['TONE_AUDIO'], 'berklee', 'Clap2.mp3'), f'{OUT}/drums/clap.flac', 0.6, fade=0.1))
report['drums'] = drums
nylon_d5 = f'{OUT}/nylon-guitar/D5.flac'
if os.path.exists(nylon_d5): os.replace(nylon_d5, f'{OUT}/nylon-guitar/Ds5.flac')
json.dump(report, open(sys.argv[1], 'w'), indent=1)
