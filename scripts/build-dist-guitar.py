"""Builds the distorted-guitar sample sets in public/samples/ (same processing as build-samples.py).

Sources — the original WAVs from the two Freesound packs (log in, download each pack's zip, unzip into one folder
and pass it as $DIST_WAVS). Without $DIST_WAVS the script falls back to Freesound's public HQ previews (lossy),
cached in $DIST_CACHE or ./.dist-cache:
  • Ax_Grinder, "Electric Guitar Power Chords" (pack 14939), CC BY 3.0 — Jackson Warrior → Line6 POD XT Live
      dist-power     sustained power chords, root C2–F3 (file = root note; the sample plays the whole chord)
      dist-power-pm  the same chords palm-muted
  • SpeedY, "Distorted Guitar Single Notes" (pack 643), CC0
      dist-guitar    single notes: open strings + 12th fret (+ a high A5), E2–A5
      dist-guitar-pm palm-muted single notes, E2–E4

Usage: DIST_WAVS=path/to/unzipped/packs python3 scripts/build-dist-guitar.py report.json   (requires ffmpeg, numpy)
After rebuilding, keep the note lists in src/app/data/sample-manifests.ts in sync.
"""
import glob, json, os, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
for k in ('TJI_REPO', 'OLD_REPO', 'TONE_AUDIO'):
    os.environ.setdefault(k, '')
# Reuse decode / pitch check / process from the main build script without running its build
src = open(os.path.join(HERE, 'build-samples.py'), encoding='utf8').read()
src = src[:src.index('report = {}')]
lib = {'__file__': os.path.join(HERE, 'build-samples.py')}
exec(compile(src, 'build-samples.py', 'exec'), lib)
process, midi_of, note_of, OUT = lib['process'], lib['midi_of'], lib['note_of'], lib['OUT']

CACHE = os.environ.get('DIST_CACHE', os.path.join(HERE, '..', '.dist-cache'))
AX, SPEEDY = 4419064, 6479

WAVS = os.environ.get('DIST_WAVS')

def fetch(sound_id, user_id):
    if WAVS:  # original upload: Freesound names pack files "<id>__<user>__<name>.wav"
        found = glob.glob(os.path.join(WAVS, '**', f'{sound_id}__*'), recursive=True)
        if not found: raise FileNotFoundError(f'sound {sound_id} not in {WAVS}')
        return found[0]
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, f'{sound_id}.ogg')
    if not os.path.exists(path):
        url = f'https://cdn.freesound.org/previews/{sound_id // 1000}/{sound_id}_{user_id}-hq.ogg'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as r, open(path, 'wb') as f:
            f.write(r.read())
    return path

# Ax_Grinder sound IDs: root → (sustained, palm-muted)
POWER = {
    'C2': (242797, 242798), 'C#2': (242779, 242780), 'D2': (242803, 242804), 'D#2': (242801, 242802),
    'E2': (242788, 242787), 'F2': (242785, 242792), 'F#2': (242791, 242810), 'G2': (242809, 242807),
    'G#2': (242808, 242805), 'A2': (242775, 242776), 'A#2': (242777, 242778), 'B2': (242781, 242782),
    'C3': (242795, 242796), 'C#3': (242783, 242784), 'D3': (242790, 242789), 'D#3': (242799, 242800),
    'E3': (242794, 242793), 'F3': (242806, 242786),
}
# SpeedY sound IDs: open strings, 12th fret, and one high A5 on the 1st string
SINGLE = {'E2': 12032, 'A2': 12009, 'D3': 12020, 'E3': 12033, 'G3': 12038, 'A3': 12010, 'B3': 12015, 'D4': 12021,
          'E4': 12026, 'G4': 12039, 'B4': 12016, 'E5': 12027, 'A5': 12029}  # 12029 is labelled 15th fret but sounds A5
SINGLE_PM = {'E2': 12037, 'A2': 12014, 'D3': 12025, 'E3': 12035, 'G3': 12042, 'A3': 12012, 'B3': 12019, 'D4': 12023,
             'E4': 12031}

np = lib['np']
SR = lib['SR']

def hps_cents(path, midi):
    """Pitch error in cents via harmonic product spectrum. (YIN reads power chords an octave low: root + fifth
    repeat at half the root frequency, so the chords are measured here instead.)"""
    x = lib['decode'](path)[int(0.02 * SR):int(0.02 * SR) + 16384]
    if len(x) < 4096: x = np.pad(x, (0, 4096 - len(x)))
    n = 1 << 17
    X = np.log(np.abs(np.fft.rfft(x * np.hanning(len(x)), n)) + 1e-9)
    target = 440 * 2 ** ((midi - 69) / 12)
    cands = np.arange(target * 0.8, target * 1.25, 0.25)
    score = [sum(X[int(round(k * f0 * n / SR))] for k in range(1, 7)) for f0 in cands]
    return 1200 * np.log2(cands[int(np.argmax(score))] / target)

def retune(path, cents):
    """Shift the file's pitch by -cents (resample; the few-ms length change doesn't matter for one-shots)."""
    tmp = path + '.tmp.flac'
    rate = SR * 2 ** (-cents / 1200)
    lib['subprocess'].run(['ffmpeg', '-v', 'quiet', '-y', '-i', path, '-af', f'asetrate={rate:.3f},aresample={SR}',
                           '-compression_level', '8', tmp], check=True)
    os.replace(tmp, path)

report = {}
def add_set(key, items, user_id, max_len):
    rows = []
    for note, sid in items:
        dst = f"{OUT}/{key}/{note_of(midi_of(note)).replace('#', 's')}.flac"
        info = process(fetch(sid, user_id), dst, max_len)
        cents = round(hps_cents(dst, midi_of(note)))
        if abs(cents) > 12:  # the source guitars are a little out of tune here and there
            retune(dst, cents)
            info['retuned_cents'] = -cents
            cents = round(hps_cents(dst, midi_of(note)))
        rows.append({'note': note, 'freesound_id': sid, 'cents_off': cents, **info})
    report[key] = rows
    print(key, len(rows), file=sys.stderr)

add_set('dist-power', [(n, ids[0]) for n, ids in POWER.items()], AX, 3.0)
add_set('dist-power-pm', [(n, ids[1]) for n, ids in POWER.items()], AX, 1.0)
add_set('dist-guitar', SINGLE.items(), SPEEDY, 3.0)
add_set('dist-guitar-pm', SINGLE_PM.items(), SPEEDY, 1.0)
json.dump(report, open(sys.argv[1], 'w'), indent=1)
