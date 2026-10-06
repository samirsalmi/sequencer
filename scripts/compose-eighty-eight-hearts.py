"""Eighty-Eight Hearts — an original piano piece for Loomin, written to be impossible for human hands.

The story, told by a heartbeat (A minor → A major, 126 bpm, 4/4):
  I.   Pulse (bars 1–4)            A heartbeat on the lowest A, alone in the dark: lub-dub every half bar, 63 beats a
                                    minute, a resting heart. High above, the theme's first two notes flicker like a
                                    far-off light and come closer.
  II.  First Light (5–12)          The theme is born. Its rhythm, a short note then a long one, is the heartbeat's
                                    lub-dub; the heart becomes the bass line.
  III. The Climb (13–20)           The theme in octaves, a counter-melody in a third hand, a 3+3+2 groove, and the
                                    heart beating twice as fast. Gusts of 32nd-note runs.
  IV.  The Storm (21–28)           Cascades fall from the top of the keyboard while others climb from the bottom,
                                    14-note thunder chords, the theme's motif shouted in triple octaves, the heart
                                    racing in 16ths. It ends with a diminished chord crashing down seven octaves.
  V.   Eye of the Storm (29–32)    Silence but for the heartbeat: it survived. The theme returns far away and soft,
                                    then a rising A major arpeggio, the piece's first C sharp, turns the key.
  VI.  Eighty-Eight Hearts (33–40) The theme in A major: triple octaves, sweeps across seven octaves, thunder chords,
                                    five layers at once.
  Coda (41–43)                     One run over all 88 keys, a 22-note A major chord from the lowest A to the highest,
                                    and the last heartbeat, now on the highest A.

Impossible for two hands: up to five independent layers at once, chords of up to 22 notes spanning seven octaves,
32nd-note cascades from both ends of the keyboard at the same time, and a chromatic run over all 88 keys in under a
second.

Usage: python3 scripts/compose-eighty-eight-hearts.py   (writes src/app/data/songs/eighty-eight-hearts.ts)
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'app', 'data', 'songs', 'eighty-eight-hearts.ts')

BPM, SPB = 126, 8            # 32nd-note steps
BAR = 4 * SPB                # 32 steps per 4/4 bar
BARS = 43
END = BARS * BAR
NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
A0, C8 = 21, 108             # the 88 keys


def m(name):
    """'A4' → 69"""
    mt = re.fullmatch(r'([A-G]#?)(-?\d)', name)
    return NAMES.index(mt.group(1)) + 12 * (int(mt.group(2)) + 1)


def note_name(midi):
    return f"{NAMES[midi % 12]}{midi // 12 - 1}"


def step(bar, beat):
    """bar is 1-based, beat in quarter notes from the start of the bar"""
    return (bar - 1) * BAR + round(beat * SPB)


LAYERS = {k: [] for k in ('heart', 'theme', 'pulse', 'counter', 'storm', 'thunder')}


def add(layer, bar, beat, pitches, beats, vel, at_step=None):
    s = step(bar, beat) if at_step is None else at_step
    length = max(1, round(beats * SPB))
    for p in pitches if isinstance(pitches, (list, tuple)) else [pitches]:
        p = m(p) if isinstance(p, str) else p
        if A0 <= p <= C8:
            LAYERS[layer].append((s, p, length, round(max(0.05, min(1.0, vel)), 2)))


# ── Harmony ──────────────────────────────────────────────────────────────────
CHORDS = {  # name: (bass note, chord tones)
    'Am': ('A', 'A C E'), 'Am/G': ('G', 'A C E'), 'F': ('F', 'F A C'), 'G': ('G', 'G B D'), 'C': ('C', 'C E G'),
    'G/B': ('B', 'G B D'), 'Em': ('E', 'E G B'), 'Dm': ('D', 'D F A'), 'Dm/C': ('C', 'D F A'), 'E': ('E', 'E G# B'),
    'E7': ('E', 'E G# B D'), 'C/G': ('G', 'C E G'), 'Bb': ('A#', 'A# D F'), 'G#dim7': ('G#', 'G# B D F'),
    'A': ('A', 'A C# E'), 'E/G#': ('G#', 'E G# B'), 'D': ('D', 'D F# A'), 'F#m': ('F#', 'F# A C#'),
    'C#m': ('C#', 'C# E G#'), 'Bm': ('B', 'B D F#'), 'A/C#': ('C#', 'A C# E'),
}


def pcs(chord):
    return {NAMES.index(n) for n in CHORDS[chord][1].split()}


def bass_pc(chord):
    return NAMES.index(CHORDS[chord][0])


def tones(chord, lo, hi):
    """every chord tone from lo to hi (MIDI), ascending"""
    return [p for p in range(lo, hi + 1) if p % 12 in pcs(chord)]


def low(pc, lo):
    """the lowest note of pitch class pc at or above lo"""
    return lo + (pc - lo) % 12


# ── The theme: its rhythm, a short note then a long one, is the heartbeat's lub-dub ──
THEME = [  # (bar offset, beat, note, beats) in A minor
    (0, 0, 'E5', .5), (0, .5, 'A5', 1.5), (0, 2, 'G5', .5), (0, 2.5, 'E5', 1.5),
    (1, 0, 'D5', .5), (1, .5, 'E5', .5), (1, 1, 'C5', 1), (1, 2, 'B4', .5), (1, 2.5, 'A4', .5), (1, 3, 'B4', 1),
    (2, 0, 'C5', .5), (2, .5, 'E5', 1.5), (2, 2, 'D5', .5), (2, 2.5, 'B4', 1.5),
    (3, 0, 'A4', 3),
    (4, 0, 'E5', .5), (4, .5, 'A5', 1.5), (4, 2, 'B5', .5), (4, 2.5, 'C6', 1.5),
    (5, 0, 'B5', .5), (5, .5, 'A5', .5), (5, 1, 'G5', 1), (5, 2, 'E5', .5), (5, 2.5, 'D5', .5), (5, 3, 'E5', 1),
    (6, 0, 'F5', .5), (6, .5, 'E5', .5), (6, 1, 'D5', 1), (6, 2, 'C5', .5), (6, 2.5, 'B4', .5), (6, 3, 'C5', 1),
    (7, 0, 'B4', 1), (7, 1, 'G#4', 1), (7, 2, 'A4', 2),
]
COUNTER = [  # the third hand (A minor)
    (0, 0, 'C5', 1.5), (0, 1.5, 'B4', .5), (0, 2, 'C5', 2),
    (1, 0, 'A4', 2), (1, 2, 'B4', 1), (1, 3, 'D5', 1),
    (2, 0, 'E5', 2), (2, 2, 'D5', 2),
    (3, 0, 'C5', 1), (3, 1, 'E5', 1), (3, 2, 'A5', 1), (3, 3, 'B4', 1),
    (4, 0, 'C5', 2), (4, 2, 'A4', 2),
    (5, 0, 'D5', 2), (5, 2, 'B4', 1), (5, 3, 'G4', 1),
    (6, 0, 'A4', 1.5), (6, 1.5, 'D5', .5), (6, 2, 'C5', 2),
    (7, 0, 'G#4', 2), (7, 2, 'E4', 2),
]
HARMONY_MINOR = [('Am', 'Am'), ('F', 'G'), ('C', 'G/B'), ('Am', 'Am'), ('Am', 'F'), ('G', 'Em'), ('Dm', 'Am'), ('E', 'Am')]
HARMONY_MAJOR = [('A', 'E/G#'), ('D', 'E'), ('F#m', 'E/G#'), ('A', 'A'), ('A', 'F#m'), ('E', 'C#m'), ('Bm', 'A/C#'), ('E', 'A')]
STORM = [('Am', 'Am/G'), ('F', 'F'), ('Dm', 'Dm/C'), ('E7', 'E7'), ('Am', 'C/G'), ('F', 'Bb'), ('E7', 'E7'), ('G#dim7', 'G#dim7')]
TO_MAJOR = {'G': 'G#', 'C': 'C#', 'F': 'F#'}


def major(note):
    """A minor → A major"""
    mt = re.fullmatch(r'([A-G]#?)(-?\d)', note)
    return TO_MAJOR.get(mt.group(1), mt.group(1)) + mt.group(2)


def melody(layer, start_bar, notes, octaves, vel, to_major=False, shift=0):
    for bo, beat, n, beats in notes:
        p = m(major(n) if to_major else n) + shift
        add(layer, start_bar + bo, beat, [p + 12 * o for o in octaves], beats, vel * (1.0 if beats >= 1 else 0.85))


# ── Building blocks ──────────────────────────────────────────────────────────
def heartbeat(bar, beat, chord_or_pitches, vel):
    """lub-dub: a soft beat, then a stronger one an 8th later"""
    pitches = chord_or_pitches if isinstance(chord_or_pitches, list) else \
        [low(bass_pc(chord_or_pitches), A0), low(bass_pc(chord_or_pitches), A0) + 12]
    add('heart', bar, beat, pitches, .25, vel * 0.7)
    add('heart', bar, beat + .5, pitches, .5, vel)


def racing_heart(bar, beat, chord, vel):
    """the heart racing: lub-dub in 16ths for half a bar"""
    root = low(bass_pc(chord), A0)
    for k in range(8):
        add('heart', bar, beat + k * .25, [root, root + 12], .25, vel * (0.65 if k % 2 == 0 else 1.0))


def broken_chord(bar, beat, chord, vel):
    """left hand in 8ths: the bass, then three chord tones rising (held like a pedal until the half bar ends)"""
    bass = low(bass_pc(chord), m('E2'))
    up = tones(chord, bass + 5, bass + 24)[:3]
    for k, p in enumerate([bass] + up):
        add('pulse', bar, beat + k * .5, p, 2 - k * .5, vel * (1.0 if k == 0 else 0.8))


def tresillo(bar, beat, chord, vel, octaves=1):
    """3+3+2: chords on the 1st, 4th and 7th 16th of a half bar"""
    voicing = tones(chord, m('C3'), m('C3') + 12 * octaves - 1)
    for k, scale in ((0, 1.0), (3, .75), (6, .85)):
        add('pulse', bar, beat + k * .25, voicing, .5, vel * scale)


def motor(bar, beat, chord, vel):
    """the storm's left hand: dyads in 16ths, accents on the 3+3+2"""
    dyad = tones(chord, m('C3'), m('B3'))[-2:]
    for k in range(8):
        add('pulse', bar, beat + k * .25, dyad, .125, vel * (1.0 if k in (0, 3, 6) else 0.55))


def thunder(bar, beat, chord, vel, size=14, beats=1):
    """a chord no hand can span: the bass in the lowest octave, then every chord tone upwards"""
    bass = low(bass_pc(chord), A0)
    add('thunder', bar, beat, [bass] + tones(chord, bass + 1, m('A6'))[:size - 1], beats, vel)


def cascades(bar, beat, chord, vel):
    """16 chord tones in 32nds falling from the top of the keyboard while 16 climb from the bottom"""
    everything = tones(chord, A0, C8)
    down, up = everything[::-1][:16], everything[:16]
    for k in range(16):
        s = step(bar, beat) + k
        add('storm', 0, 0, down[k], 2 / SPB, vel * (1.0 - 0.3 * k / 15), at_step=s)
        add('storm', 0, 0, up[k], 2 / SPB, vel * (0.7 + 0.3 * k / 15), at_step=s)


def sweep(bar, beat, notes, steps, v0, v1, ring=3):
    """any number of notes spread evenly over `steps` 32nds (several per step when it's faster than 32nds)"""
    for k, p in enumerate(notes):
        add('storm', 0, 0, p, ring / SPB, v0 + (v1 - v0) * k / max(1, len(notes) - 1),
            at_step=step(bar, beat) + k * steps // len(notes))


def harmonic_minor(lo, hi):
    return [p for p in range(lo, hi + 1) if p % 12 in {9, 11, 0, 2, 4, 5, 8}]


# ── I. Pulse (bars 1–4) ──────────────────────────────────────────────────────
for bar in range(1, 5):
    for half in (0, 2):
        heartbeat(bar, half, [m('A0'), m('A1')], 0.45 + 0.1 * (bar - 1))
# A far-off light: the theme's first two notes, coming closer
add('counter', 2, 3, 'E7', .5, .3)
add('counter', 3, .5, 'A7', 1.5, .35)
add('counter', 4, 2, 'E6', .5, .4)
add('counter', 4, 2.5, 'A6', 1.5, .45)

# ── II. First Light (bars 5–12) ──────────────────────────────────────────────
melody('theme', 5, THEME, [0], 0.7)
for i, (c1, c2) in enumerate(HARMONY_MINOR):
    for half, chord in ((0, c1), (2, c2)):
        broken_chord(5 + i, half, chord, 0.5)
        heartbeat(5 + i, half, chord, 0.55)

# ── III. The Climb (bars 13–20) ──────────────────────────────────────────────
melody('theme', 13, THEME, [0, -1], 0.8)
melody('counter', 13, COUNTER, [0], 0.55)
for i, (c1, c2) in enumerate(HARMONY_MINOR):
    for half, chord in ((0, c1), (2, c2)):
        tresillo(13 + i, half, chord, 0.6)
        heartbeat(13 + i, half, chord, 0.65)
        heartbeat(13 + i, half + 1, chord, 0.65)
# Gusts: a run in the theme's pause, then one that rushes into the storm
sweep(16, 2, harmonic_minor(m('A3'), m('B5')), 16, 0.4, 0.8)
sweep(20, 2, harmonic_minor(m('A2'), m('E6')), 16, 0.45, 0.95)

# ── IV. The Storm (bars 21–28) ───────────────────────────────────────────────
MOTIF = {'Am': ('E5', 'A5'), 'Am/G': ('E5', 'A5'), 'F': ('C5', 'F5'), 'Dm': ('A4', 'D5'), 'Dm/C': ('A4', 'D5'),
         'E7': ('B4', 'E5'), 'C/G': ('G4', 'C5'), 'Bb': ('F5', 'A#5'), 'G#dim7': ('D5', 'G#5')}
for i, (c1, c2) in enumerate(STORM):
    bar = 21 + i
    for half, chord in ((0, c1), (2, c2)):
        collapse = bar == 28 and half == 2
        if collapse:
            # The storm breaks: a diminished chord crashing down seven octaves
            thunder(bar, half, chord, 1.0, size=16, beats=2)
            sweep(bar, half, tones(chord, A0, C8)[::-1], 16, 0.95, 0.6, ring=4)
            continue
        pickup, target = MOTIF[chord]
        if half == 2 and c1 == c2:  # same chord twice: the motif climbs instead of repeating
            higher = [p for p in tones(chord, m(target) + 1, m(target) + 12)]
            pickup, target = target, note_name(higher[0])
        add('theme', bar, half, [m(pickup) - 12, m(pickup), m(pickup) + 12], .5, 0.9)
        add('theme', bar, half + .5, [m(target) - 12, m(target), m(target) + 12], 1.5, 1.0)
        cascades(bar, half, chord, 0.75)
        motor(bar, half, chord, 0.75)
        racing_heart(bar, half, chord, 0.65)
        if half == 0 or c1 != c2:
            thunder(bar, half, chord, 0.9 if half == 0 else 0.75, size=14 if half == 0 else 9)

# ── V. Eye of the Storm (bars 29–32) ─────────────────────────────────────────
for bar, vel in ((29, .55), (30, .5), (31, .45), (32, .5)):
    for half in (0, 2):
        heartbeat(bar, half, [m('A0'), m('A1')], vel)
melody('counter', 29, THEME[:14], [0], 0.45, shift=12)  # the theme, far away: bars 1–4 of it, an octave up
for i, (c1, c2) in enumerate(HARMONY_MINOR[:4]):
    for half, chord in ((0, c1), (2, c2)):
        if 29 + i == 32 and half == 2:
            continue
        add('pulse', 29 + i, half, tones(chord, m('A3'), m('G#4')), 2, 0.3)
# The turn: a rising A major arpeggio, the first C sharp of the piece
sweep(32, 2, tones('A', m('A1'), m('A6')), 16, 0.35, 0.9)

# ── VI. Eighty-Eight Hearts (bars 33–40) ─────────────────────────────────────
melody('theme', 33, THEME, [-1, 0, 1], 0.95, to_major=True)
melody('counter', 33, COUNTER, [-1], 0.6, to_major=True)
for i, (c1, c2) in enumerate(HARMONY_MAJOR):
    bar = 33 + i
    thunder(bar, 0, c1, 0.9, size=15)
    for half, chord in ((0, c1), (2, c2)):
        if bar == 40 and half == 2:
            continue  # the coda's run takes over
        tresillo(bar, half, chord, 0.6, octaves=2)
        heartbeat(bar, half, chord, 0.75)
        heartbeat(bar, half + 1, chord, 0.75)
        bass = low(bass_pc(chord), m('A1'))
        sweep(bar, half, tones(chord, bass, C8)[:16], 16, 0.4, 0.7)

# ── Coda (bars 40–43) ────────────────────────────────────────────────────────
sweep(40, 2, list(range(A0, C8 + 1)), 16, 0.45, 0.95)          # all 88 keys in two beats
add('thunder', 41, 0, tones('A', A0, m('A7')), 8, 1.0)         # A major from the lowest A to the highest: 22 notes
heartbeat(41, 0, [m('A0'), m('A1')], 0.9)
heartbeat(42, 0, [m('A0'), m('A1')], 0.4)                      # fading
heartbeat(43, 0, [m('A6'), m('A7')], 0.55)                     # the last heartbeat, on the highest A


# ── Write the song ───────────────────────────────────────────────────────────
PIANO = dict(synthType='triangle', instrumentPreset='piano', playbackMode='sample', sampleSet='acoustic-piano')
TRACKS = [  # (layer, name, mix)
    ('heart', '🫀 Heartbeat', dict(volume=0.36, pan=0, reverbSend=0.15)),
    ('theme', '🖐️ Hand 1 — Theme', dict(volume=0.5, pan=0.05, reverbSend=0.25)),
    ('pulse', '🖐️ Hand 2 — Pulse', dict(volume=0.25, pan=-0.15, reverbSend=0.2)),
    ('counter', '🖐️ Hand 3 — Counter-melody', dict(volume=0.55, pan=0.2, reverbSend=0.35)),
    ('storm', '🖐️ Hand 4 — Storm', dict(volume=0.2, pan=0, reverbSend=0.25)),
    ('thunder', '🖐️ Hand 5 — Thunder', dict(volume=0.2, pan=0, reverbSend=0.2)),
]
SOURCE = ('Original composition for Loomin, impossible for two hands. A heartbeat on the lowest A finds a melody, '
          'survives a storm that sweeps the whole keyboard, and rises to the highest A. Score: '
          'scripts/compose-eighty-eight-hearts.py')


def to_notes(events):
    """→ (rowNotes, [step,row,len,vel]): one note per key per step (the louder wins), no overlaps on a key"""
    cells = {}
    for s, p, length, vel in events:
        if s < END and ((p, s) not in cells or vel > cells[(p, s)][1]):
            cells[(p, s)] = (length, vel)
    rows = sorted({p for p, _ in cells}, reverse=True)
    index = {p: i for i, p in enumerate(rows)}
    notes = sorted([s, index[p], length, vel] for (p, s), (length, vel) in cells.items())
    last = {}
    for n in sorted(notes, key=lambda n: (n[1], n[0])):
        prev = last.get(n[1])
        if prev is not None and prev[0] + prev[2] > n[0]:
            prev[2] = n[0] - prev[0]
        last[n[1]] = n
    for n in notes:
        n[2] = max(1, min(n[2], END - n[0]))
    return [note_name(p) for p in rows], notes


def fmt(v):
    return f"{v:.2f}".rstrip('0').rstrip('.') if isinstance(v, float) else str(v)


lines = [
    "// Original composition: generated by scripts/compose-eighty-eight-hearts.py (edit the score there and re-run it).",
    "import type { SongDef } from './song-format';",
    "",
    "export const EIGHTY_EIGHT_HEARTS: SongDef = {",
]
song = dict(name='Eighty-Eight Hearts', artist='Loomin Original', source=SOURCE, bpm=BPM, stepsPerBeat=SPB,
            stepResolution='32nd', timeSignature='4/4', stepCount=END, scale='harmonicMinor', rootNote='A',
            swingPercentage=0, humanize=0)
lines += [f"  {k}: {json.dumps(v, ensure_ascii=False)}," for k, v in song.items()]
lines.append("  tracks: [")
total = 0
for layer, name, mix in TRACKS:
    rows, notes = to_notes(LAYERS[layer])
    total += len(notes)
    lines.append("    {")
    lines += [f"      {k}: {json.dumps(v, ensure_ascii=False)}," for k, v in {'trackName': name, **PIANO, **mix}.items()]
    lines.append(f"      rowNotes: {json.dumps(rows)},")
    lines.append("      notes: [")
    for i in range(0, len(notes), 10):
        lines.append("        " + ', '.join('[' + ','.join(fmt(v) for v in n) + ']' for n in notes[i:i + 10]) + ",")
    lines.append("      ],")
    lines.append("    },")
    print(f"{name}: {len(notes)} notes, {len(rows)} keys ({rows[-1]}–{rows[0]})")
lines += ["  ],", "};", ""]
with open(OUT, 'w') as f:
    f.write('\n'.join(lines))
print(f"{BARS} bars, {END} steps, {END * 60 / (BPM * SPB):.1f} s, {total} notes → {os.path.relpath(OUT, ROOT)}")
