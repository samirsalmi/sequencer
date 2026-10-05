"""Builds the folk / Celtic sample sets in public/samples/ (same processing as build-samples.py).

Sources (all downloaded and cached in $FOLK_CACHE or ./.folk-cache, except the bagpipe archive):
  • FreePats "Bagpipe" (freepats.zenvoid.org/Ethnic/bagpipe.html), CC0 — bagpipe in G by Rémy Dubois / Olle Geris.
    Download Bagpipe-SFZ+FLAC-*.7z, unpack it and pass the folder holding the .sfz as $BAGPIPE_DIR.
      bagpipe        chanter notes F4–G5
      bagpipe-drone  the two drones, G2 and G3
    The recordings sit 25–65 cents flat of A440 and were made to loop: each note's SFZ loop is unrolled to a
    long sustain (the app plays samples one-shot) and the note is retuned.
  • Freesound sounds 328235 + 329085 by sdeepspeeds, CC0 — a real hurdy-gurdy: one drone string (bordone, B2) and
    the melody string (chanterelle) open (B3) and stopped (B4). Only public HQ previews (lossy) are fetched.
      hurdy-gurdy    B2 (drone), B3, B4
  • VCSL — Versilian Community Sample Library (github.com/sgossner/VCSL), CC0
      recorder       Baroque soprano recorder, sustained, C5–C7 — a duct flute like the tin whistle (D whistle: D5–D7)
      strumstick     Strumstick, fingerpicked, loud layer, D3–A5 — a small fretted folk lute (mandola stand-in)
    VCSL names both at written pitch; the files sound an octave higher, so they're filed under the sounding note.

Usage: BAGPIPE_DIR=path/to/Bagpipe-SFZ+FLAC python3 scripts/build-folk.py report.json   (requires ffmpeg, numpy)
After rebuilding, keep the note lists in src/app/data/sample-manifests.ts in sync.
"""
import glob, json, os, re, subprocess, sys, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
for k in ('TJI_REPO', 'OLD_REPO', 'TONE_AUDIO'):
    os.environ.setdefault(k, '')
# Reuse decode / pitch check / process from the main build script without running its build
src = open(os.path.join(HERE, 'build-samples.py'), encoding='utf8').read()
src = src[:src.index('report = {}')]
lib = {'__file__': os.path.join(HERE, 'build-samples.py')}
exec(compile(src, 'build-samples.py', 'exec'), lib)
process, decode, yin, midi_of, note_of, OUT, np, SR = (lib[k] for k in
    ('process', 'decode', 'yin', 'midi_of', 'note_of', 'OUT', 'np', 'SR'))

CACHE = os.environ.get('FOLK_CACHE', os.path.join(HERE, '..', '.folk-cache'))
TMP = os.path.join(CACHE, 'tmp')
os.makedirs(TMP, exist_ok=True)

def download(url, name):
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as r, open(path, 'wb') as f:
            f.write(r.read())
    return path

def vcsl(rel):
    return download('https://raw.githubusercontent.com/sgossner/VCSL/master/' + urllib.parse.quote(rel),
                    'vcsl-' + os.path.basename(rel))

def freesound(sound_id, user_id):
    return download(f'https://cdn.freesound.org/previews/{sound_id // 1000}/{sound_id}_{user_id}-hq.mp3', f'{sound_id}.mp3')

def write_wav(x, name):
    path = os.path.join(TMP, name + '.wav')
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg', '-v', 'quiet', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', path],
                   input=pcm, check=True)
    return path

def unroll(x, loop_start, loop_end, seconds, xfade=0):
    """Play x up to loop_end, then repeat [loop_start, loop_end) until `seconds` long (crossfaded when xfade > 0)."""
    out = x[:loop_end].copy()
    body = x[loop_start:loop_end]
    while len(out) < SR * seconds:
        if xfade:
            ramp = np.linspace(0, 1, xfade)
            out[-xfade:] = out[-xfade:] * (1 - ramp) + body[:xfade] * ramp
            out = np.concatenate([out, body[xfade:]])
        else:
            out = np.concatenate([out, body])
    return out[:int(SR * seconds)]

def cents_off(path, midi, lo=27, hi=4200):
    """Median YIN pitch error over the sustain (more robust than one window for wobbly folk instruments)."""
    x = decode(path)
    reads = []
    for t in np.arange(0.15, len(x) / SR - 0.3, 0.25):
        f = yin(x[int(t * SR):], lo, hi)
        if f: reads.append(1200 * np.log2(f / 440) + 6900 - midi * 100)
    reads = [r for r in reads if abs(r) < 300]  # drop octave errors
    return float(np.median(reads)) if reads else None

def retune(path, cents):
    """Shift the file's pitch by -cents (resample; the small length change doesn't matter here)."""
    tmp = path + '.tmp.flac'
    rate = SR * 2 ** (-cents / 1200)
    subprocess.run(['ffmpeg', '-v', 'quiet', '-y', '-i', path, '-af', f'asetrate={rate:.3f},aresample={SR}',
                    '-compression_level', '8', tmp], check=True)
    os.replace(tmp, path)

report = {}
def add_set(key, items, max_len, attack_db=None, tolerance=12, transpose=0):
    """items: list of (src_path, note_name, extra_info); transpose: semitones from the file's name to what sounds"""
    rows = []
    for path, note, extra in items:
        midi = midi_of(note) + transpose
        dst = f"{OUT}/{key}/{note_of(midi).replace('#', 's')}.flac"
        info = process(path, dst, max_len, attack_db=attack_db)
        cents = cents_off(dst, midi)
        if cents is not None and abs(cents) > tolerance:
            retune(dst, cents)
            info['retuned_cents'] = round(-cents)
            cents = cents_off(dst, midi)
        rows.append({'note': note_of(midi), 'cents_off': None if cents is None else round(cents), **extra, **info})
    report[key] = rows
    print(key, len(rows), file=sys.stderr)

# ── Bagpipe (FreePats) ────────────────────────────────────────────────────────
BAG = os.environ['BAGPIPE_DIR']
sfz = open(glob.glob(os.path.join(BAG, '*.sfz'))[0], encoding='utf8').read()
loops = {m.group(3): (int(m.group(1)), int(m.group(2)))
         for m in re.finditer(r'loop_start=(\d+) loop_end=(\d+)\s+sample=samples/(\S+)', sfz)}

def bag_item(file, note, seconds):
    ls, le = loops[file]
    x = decode(os.path.join(BAG, 'samples', file))  # sources are 44.1 kHz, so the SFZ loop points still apply
    return write_wav(unroll(x, ls, le, seconds), 'bag-' + note), note, {'source': file}

chanter = sorted({re.match(r'(.+)_3\d\.flac', f).group(1) for f in loops if not f.startswith('drone')}, key=midi_of)
add_set('bagpipe', [bag_item(f'{n}_31.flac', n, 8.0) for n in chanter], 8.0, attack_db=-6)
add_set('bagpipe-drone', [bag_item('drone_G2_1.flac', 'G2', 12.0), bag_item('drone_G3_3.flac', 'G3', 12.0)], 12.0,
        attack_db=-6)

# ── Hurdy-gurdy (Freesound, sdeepspeeds) ─────────────────────────────────────
HG_USER = 5674809
bordone = decode(freesound(328235, HG_USER))
chanter = decode(freesound(329085, HG_USER))
def seg(x, a, b): return x[int(a * SR):int(b * SR)]
XF = int(SR * 0.08)
add_set('hurdy-gurdy', [
    (write_wav(seg(bordone, 0.8, 11.0), 'hg-B2'), 'B2', {'source': 'freesound 328235, 0.8–11 s'}),
    (write_wav(seg(chanter, 0.5, 4.4), 'hg-B3'), 'B3', {'source': 'freesound 329085, 0.5–4.4 s'}),
    # The stopped B4 lasts only ~1 s: loop its steady middle (crossfaded) to give it a usable sustain
    (write_wav(unroll(seg(chanter, 7.9, 9.15), int(SR * 0.25), int(SR * 1.05), 4.0, XF), 'hg-B4'), 'B4',
     {'source': 'freesound 329085, 7.9–9.15 s, looped'}),
], 6.0, attack_db=-6)

# ── VCSL ──────────────────────────────────────────────────────────────────────
REC = 'Aerophones/Edge-blown Aerophones/Baroque Soprano Recorder/Sustain/SopRecorder_Sus_{}_rr1_Main.wav'
add_set('recorder', [(vcsl(REC.format(n)), n, {}) for n in
                     ['C4', 'D4', 'E4', 'F#4', 'G#4', 'A#4', 'C5', 'D5', 'E5', 'F#5', 'G5', 'A#5', 'C6']],
        5.0, attack_db=-6, transpose=12)  # VCSL names recorder notes at written pitch, an octave below sounding

STRUM = 'Chordophones/Composite Chordophones/Strumstick/Finger/Strumstick_Finger_Str{}_Main_{}_vl3_rr{}.wav'
STRUM_NOTES = {1: ['D2', 'E2', 'F#2', 'G2'], 2: ['A2', 'B2', 'C#3', 'D3'],
               3: ['E3', 'F#3', 'G3', 'A3', 'B3', 'C#4', 'D4', 'E4', 'F#4', 'G4', 'A4']}
add_set('strumstick', [(vcsl(STRUM.format(s, n, 2 if n == 'F#2' else 1)), n, {})  # F#2 only has a 2nd take
                       for s, ns in STRUM_NOTES.items() for n in ns], 3.5, transpose=12)  # also named an octave low

json.dump(report, open(sys.argv[1], 'w'), indent=1)
