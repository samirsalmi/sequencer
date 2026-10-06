"""Builds Loomin song presets (src/app/data/songs/*.ts) from Guitar Pro (.gp3/4/5) and MIDI transcriptions.

Each recipe in scripts/song-recipes.py picks a bar range of a source file and says which source track becomes which
app track (instrument, sample set, volume, pan...). The converter:
  * reads exact notes (fret + string tuning, or MIDI pitch), ties, let-ring, palm mutes, accents, dynamics, drums;
  * splits distorted guitar parts into power chords (one grid note = the whole chord, using the real-amp power-chord
    samples) and single notes, each with a palm-muted variant;
  * maps General MIDI drums onto the app's kit;
  * keeps songs instruments only: a source track that looks like a vocal part is refused;
  * picks the coarsest grid that holds the rhythm (16ths, or 12 steps per beat when there are triplets);
  * writes a compact note list (src/app/data/songs/song-format.ts expands it to the editor grid on load).

Usage:  SONG_SOURCES=/path/to/sources python3 scripts/build-songs.py [recipe ids...]
Requires: pip install pyguitarpro mido
"""
import importlib.util, json, math, os, re, sys
from collections import defaultdict
from fractions import Fraction

import guitarpro
import mido

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'src', 'app', 'data', 'songs')
SOURCES = os.environ.get('SONG_SOURCES', os.path.join(ROOT, 'song-sources'))
NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']


def note_name(midi):
    return f"{NAMES[midi % 12]}{midi // 12 - 1}"


# ── General MIDI drums → app drum names ──────────────────────────────────────
GM_DRUMS = {
    35: 'Kick', 36: 'Kick',
    37: 'Snare', 38: 'Snare', 40: 'Snare',          # side stick / acoustic / electric snare
    39: 'Clap',
    41: 'Tom Low', 43: 'Tom Low',                   # floor toms
    45: 'Tom Mid', 47: 'Tom Mid',
    48: 'Tom High', 50: 'Tom High',
    42: 'Hi-Hat', 44: 'Hi-Hat',                     # closed / pedal
    46: 'Open Hi-Hat',
    49: 'Crash', 57: 'Crash', 52: 'Crash', 55: 'Crash',   # crash 1/2, china, splash
    51: 'Ride', 59: 'Ride', 53: 'Ride',             # ride, ride bell
    54: 'Hi-Hat',                                   # tambourine → hat
}
DRUM_ROW_ORDER = ['Crash', 'Ride', 'Open Hi-Hat', 'Hi-Hat', 'Clap', 'Snare', 'Tom High', 'Tom Mid', 'Tom Low', 'Kick']
DRUM_GAIN = {54: 0.6, 44: 0.7, 37: 0.6, 55: 0.7, 53: 1.0}  # quieter tambourine / pedal hat / side stick / splash

# Distorted power-chord sample roots available (C2..F3); single-note distorted samples cover E2..A5.
POWER_MIN, POWER_MAX = 36, 53


class Ev:
    """One note in quarter notes from the start of the segment."""
    __slots__ = ('start', 'dur', 'pitch', 'vel', 'pm', 'string', 'let_ring', 'drum')

    def __init__(self, start, dur, pitch, vel, pm=False, string=None, let_ring=False, drum=None):
        self.start, self.dur, self.pitch, self.vel = start, dur, pitch, vel
        self.pm, self.string, self.let_ring, self.drum = pm, string, let_ring, drum


def gp_velocity(v):
    # Guitar Pro dynamics: ppp 15 … f 95 … fff 127
    return max(0.3, min(1.0, 0.25 + 0.75 * (v / 127)))


# ── Guitar Pro reader ────────────────────────────────────────────────────────
def read_gp(path, track_index, bars, transpose=0):
    """Events of one GP track over a list of (first, last) bar ranges (1-based, inclusive), concatenated."""
    song = guitarpro.parse(path)
    track = song.tracks[track_index]
    tuning = [s.value for s in track.strings]
    events, offset_q = [], Fraction(0)
    last_by_string = {}
    for first, last in bars:
        for mi in range(first - 1, last):
            m = track.measures[mi]
            header = m.header
            ts = header.timeSignature
            bar_q = Fraction(ts.numerator * 4, ts.denominator.value)
            for voice in m.voices:
                for beat in voice.beats:
                    if not beat.notes:
                        continue
                    b_start = offset_q + Fraction(beat.start - header.start, 960)
                    b_dur = Fraction(beat.duration.time, 960)
                    for n in beat.notes:
                        if n.effect.grace is not None and getattr(n.effect, 'isGrace', False):
                            continue
                        if track.isPercussionTrack:
                            name = GM_DRUMS.get(n.value)
                            if not name:
                                continue
                            vel = gp_velocity(n.velocity) * DRUM_GAIN.get(n.value, 1.0)
                            if n.effect.ghostNote:
                                vel *= 0.55
                            if n.effect.accentuatedNote or n.effect.heavyAccentuatedNote:
                                vel = min(1.0, vel + 0.12)
                            events.append(Ev(b_start, Fraction(1, 4), None, vel, drum=name))
                            continue
                        if str(n.type) == 'NoteType.dead':
                            continue
                        pitch = tuning[n.string - 1] + n.value + track.offset + transpose
                        if str(n.type) == 'NoteType.tie':
                            prev = last_by_string.get(n.string)
                            if prev is not None:
                                prev.dur = (b_start + b_dur) - prev.start
                            continue
                        if n.effect.isBend and n.effect.bend.points:
                            # Hold the bent pitch (GP bend values are in quarter tones: 4 = whole step)
                            top = max(p.value for p in n.effect.bend.points)
                            pitch += round(top / 2)
                        if n.effect.isHarmonic:
                            # Natural harmonics at frets 12 / 7 / 5 sound an octave, octave+5th, two octaves up
                            pitch = tuning[n.string - 1] + track.offset + transpose + {12: 12, 7: 19, 5: 24}.get(n.value, n.value)
                        vel = gp_velocity(n.velocity)
                        if n.effect.ghostNote:
                            vel *= 0.6
                        if n.effect.accentuatedNote or n.effect.heavyAccentuatedNote:
                            vel = min(1.0, vel + 0.1)
                        ev = Ev(b_start, b_dur, pitch, vel, pm=bool(n.effect.palmMute), string=n.string,
                                let_ring=bool(n.effect.letRing))
                        events.append(ev)
                        last_by_string[n.string] = ev
            offset_q += bar_q
    # Let-ring: a note rings until the next note on the same string (max one bar)
    by_string = defaultdict(list)
    for e in events:
        if e.string is not None:
            by_string[e.string].append(e)
    for evs in by_string.values():
        evs.sort(key=lambda e: e.start)
        for a, b in zip(evs, evs[1:] + [None]):
            if a.let_ring:
                end = b.start if b else offset_q
                a.dur = max(a.dur, min(end - a.start, Fraction(4)))
    return events, offset_q


def gp_tempo_at(path, bar):
    """Tempo in effect at the start of a bar (follows mix-table tempo changes)."""
    song = guitarpro.parse(path)
    tempo = song.tempo
    for mh in song.measureHeaders[:bar - 1]:
        for t in song.tracks:
            for v in t.measures[mh.number - 1].voices:
                for b in v.beats:
                    mt = b.effect.mixTableChange
                    if mt and mt.tempo and mt.tempo.value:
                        tempo = mt.tempo.value
    return tempo


# ── MIDI reader ──────────────────────────────────────────────────────────────
def midi_bar_starts(mid):
    """Tick of each bar start (follows time-signature changes), plus the time signature of each bar."""
    ts_events = []
    for tr in mid.tracks:
        t = 0
        for msg in tr:
            t += msg.time
            if msg.type == 'time_signature':
                ts_events.append((t, msg.numerator, msg.denominator))
    ts_events.sort()
    if not ts_events or ts_events[0][0] > 0:
        ts_events.insert(0, (0, 4, 4))
    end = max(sum(m.time for m in tr) for tr in mid.tracks)
    starts, sigs, tick, i = [], [], 0, 0
    tpq = mid.ticks_per_beat
    while tick <= end:
        while i + 1 < len(ts_events) and ts_events[i + 1][0] <= tick:
            i += 1
        num, den = ts_events[i][1], ts_events[i][2]
        starts.append(tick)
        sigs.append((num, den))
        tick += int(tpq * num * 4 / den)
    return starts, sigs


def midi_tempo_at(mid, tick):
    tempo, best = 500000, -1
    for tr in mid.tracks:
        t = 0
        for msg in tr:
            t += msg.time
            if msg.type == 'set_tempo' and t <= tick and t >= best:
                tempo, best = msg.tempo, t
    return 60_000_000 / tempo


def midi_tempo_map(mid):
    """Sorted (tick, microseconds per quarter) of every tempo change."""
    changes = []
    for tr in mid.tracks:
        t = 0
        for msg in tr:
            t += msg.time
            if msg.type == 'set_tempo':
                changes.append((t, msg.tempo))
    changes.sort()
    if not changes or changes[0][0] > 0:
        changes.insert(0, (0, 500000))
    return changes


def read_midi(path, track_index, bars, channel=None, transpose=0, drums=False, pedal=False, bake_tempo=False):
    """`pedal`: no sustain-pedal data in the file, so play it like a pianist changing pedal on every bar line: each
    note rings until the next bar line (or until the same key is struck again).
    `bake_tempo`: write the file's tempo changes (ritardandos, fermatas) into the note positions — at the starting
    tempo a slowed-down beat simply takes more steps — since a song has one fixed bpm."""
    mid = mido.MidiFile(path)
    tpq = mid.ticks_per_beat
    starts, sigs = midi_bar_starts(mid)
    tempo_map = midi_tempo_map(mid)
    base = next(tp for t, tp in reversed(tempo_map) if t <= starts[bars[0][0] - 1])

    def q(tick):
        """Quarter notes at the starting tempo from tick 0 to `tick` (plain tick count unless baking the tempo)."""
        if not bake_tempo:
            return Fraction(tick, tpq)
        total, (t0, tp) = Fraction(0), tempo_map[0]
        for t1, tp1 in tempo_map[1:]:
            if t1 >= tick:
                break
            total += Fraction((t1 - t0) * tp, tpq * base)
            t0, tp = t1, tp1
        return total + Fraction((tick - t0) * tp, tpq * base)
    tr = mid.tracks[track_index]
    notes, on = [], {}
    t = 0
    for msg in tr:
        t += msg.time
        if msg.type not in ('note_on', 'note_off'):
            continue
        if channel is not None and msg.channel != channel:
            continue
        key = (msg.channel, msg.note)
        if msg.type == 'note_on' and msg.velocity > 0:
            if key in on:  # retrigger without note-off
                s, v = on.pop(key)
                notes.append((s, t, msg.note, v))
            on[key] = (t, msg.velocity)
        else:
            if key in on:
                s, v = on.pop(key)
                notes.append((s, t, msg.note, v))
    if pedal:
        onsets = defaultdict(list)
        for s, _, p, _ in notes:
            onsets[p].append(s)
        held = []
        for s, e, p, v in notes:
            bar_end = next((t for t in starts if t > s), starts[-1] + tpq * 4)
            restrike = next((t for t in sorted(onsets[p]) if t > s), bar_end)
            held.append((s, max(e, min(bar_end, restrike)), p, v))
        notes = held
    events, offset_q = [], Fraction(0)
    for first, last in bars:
        a, b = starts[first - 1], starts[last] if last < len(starts) else starts[-1] + tpq * 4
        for s, e, p, v in notes:
            if a <= s < b:
                start = offset_q + q(s) - q(a)
                if drums:
                    name = GM_DRUMS.get(p)
                    if name:
                        events.append(Ev(start, Fraction(1, 4), None, max(0.3, min(1.0, v / 127 * DRUM_GAIN.get(p, 1.0))), drum=name))
                else:
                    events.append(Ev(start, max(q(e) - q(s), Fraction(1, tpq)), p + transpose, max(0.3, min(1.0, 0.2 + 0.8 * v / 127))))
        offset_q += q(b) - q(a)
    return events, offset_q


# ── Splitting distorted guitars into power chords / single notes ─────────────
def split_guitar(events, power=True, loose=False):
    """Groups simultaneous notes; root+5th(+octave) shapes become one power-chord note on the root.
    `loose`: any chord holding root + 5th is played as that power chord (full barre chords through a high-gain amp)."""
    groups = defaultdict(list)
    for e in events:
        groups[e.start].append(e)
    out = {'power': [], 'power_pm': [], 'single': [], 'single_pm': []}
    for start, grp in sorted(groups.items()):
        pitches = sorted({e.pitch for e in grp})
        root = pitches[0]
        intervals = {p - root for p in pitches[1:]}
        shape_ok = (7 in intervals and intervals <= {7, 12, 19, 24}) or (loose and bool(intervals & {7, 19}))
        is_power = power and len(pitches) >= 2 and shape_ok and POWER_MIN - 2 <= root <= POWER_MAX + 2
        pm = any(e.pm for e in grp)
        if is_power:
            out['power_pm' if pm else 'power'].append(Ev(start, max(e.dur for e in grp), root, max(e.vel for e in grp), pm=pm))
        else:
            for e in grp:
                out['single_pm' if e.pm else 'single'].append(e)
    return out


# ── Grid ─────────────────────────────────────────────────────────────────────
def choose_grid(all_events, candidates=(4, 12, 8, 6, 24)):
    starts = [e.start for e in all_events]
    if not starts:
        return 4, 1.0
    best = None
    for spb in candidates:
        ok = sum(1 for s in starts if abs(float(s * spb) - round(float(s * spb))) < 0.12) / len(starts)
        if best is None or ok > best[1] + 0.02:
            best = (spb, ok)
        if ok >= 0.97:  # a few ornaments (flams, grace notes) may snap to the nearest step
            return spb, ok
    return best


RESOLUTION = {2: '8th', 4: '16th', 8: '32nd', 3: '8th-triplet', 6: '16th-triplet', 12: '16th+triplet'}


def to_notes(events, spb, total_steps, is_drum=False, min_len=1, max_len=None):
    """Quantizes events onto the grid → (rowNotes, [step,row,len,vel]); same-row notes never overlap."""
    cells = {}
    for e in events:
        step = int(round(float(e.start * spb)))
        if step >= total_steps or step < 0:
            continue
        key = e.drum if is_drum else e.pitch
        length = 1 if is_drum else max(min_len, int(round(float(e.dur * spb))))
        if max_len:
            length = min(length, max_len)
        prev = cells.get((key, step))
        if prev is None or e.vel > prev[1]:
            cells[(key, step)] = (length, e.vel)
    if is_drum:
        rows = [d for d in DRUM_ROW_ORDER if any(k == d for (k, _) in cells)]
    else:
        rows = sorted({k for (k, _) in cells}, reverse=True)
    index = {k: i for i, k in enumerate(rows)}
    by_row = defaultdict(list)
    for (k, step), (length, vel) in cells.items():
        by_row[k].append([step, index[k], length, round(vel, 2)])
    notes = []
    for k, lst in by_row.items():
        lst.sort()
        for a, b in zip(lst, lst[1:] + [None]):
            if b is not None and a[0] + a[2] > b[0]:
                a[2] = max(1, b[0] - a[0])
            a[2] = min(a[2], total_steps - a[0])
            notes.append(a)
    notes.sort()
    row_names = rows if is_drum else [note_name(p) for p in rows]
    return row_names, notes


# ── TypeScript writer ────────────────────────────────────────────────────────
def ts_value(v):
    return json.dumps(v, ensure_ascii=False)


def write_song(recipe_id, song, tracks):
    var = re.sub(r'[^A-Za-z0-9]', '_', recipe_id).upper()
    lines = [
        "// Generated by scripts/build-songs.py — edit scripts/song-recipes.py and rebuild instead of editing by hand.",
        "import type { SongDef } from './song-format';",
        "",
        f"export const {var}: SongDef = {{",
    ]
    for key in ('name', 'artist', 'source', 'bpm', 'stepsPerBeat', 'stepResolution', 'timeSignature', 'stepCount',
                'scale', 'rootNote', 'swingPercentage', 'humanize'):
        if key in song and song[key] is not None:
            lines.append(f"  {key}: {ts_value(song[key])},")
    lines.append("  tracks: [")
    for t in tracks:
        lines.append("    {")
        for key in ('trackName', 'synthType', 'instrumentPreset', 'playbackMode', 'sampleSet', 'volume', 'pan',
                    'filterCutoff', 'delaySend', 'reverbSend'):
            if t.get(key) is not None:
                lines.append(f"      {key}: {ts_value(t[key])},")
        lines.append(f"      rowNotes: {ts_value(t['rowNotes'])},")
        lines.append("      notes: [")
        for chunk in _chunks(t['notes']):
            lines.append("        " + chunk + ",")
        lines.append("      ],")
        lines.append("    },")
    lines.append("  ],")
    lines.append("};")
    path = os.path.join(OUT_DIR, f"{recipe_id}.ts")
    with open(path, 'w') as f:
        f.write('\n'.join(lines) + '\n')
    return var, path


def _fmt(x):
    if isinstance(x, float):
        s = f"{x:.2f}".rstrip('0').rstrip('.')
        return s if s not in ('', '-0') else '0'
    return str(x)


def _chunks(notes, per_line=10):
    out = []
    for i in range(0, len(notes), per_line):
        out.append(', '.join('[' + ','.join(_fmt(v) for v in n) + ']' for n in notes[i:i + per_line]))
    return out


# ── Recipe runner ────────────────────────────────────────────────────────────
DEFAULTS = {
    'drums': dict(trackName='🥁 Drums', synthType='sine', instrumentPreset='drums', playbackMode='sample', volume=1.3),
    'bass': dict(trackName='🎸 Bass', synthType='triangle', instrumentPreset='bass', playbackMode='sample', sampleSet='electric-bass', volume=0.6),
    'power': dict(synthType='sawtooth', instrumentPreset='powerChords', playbackMode='sample', sampleSet='dist-power', volume=0.5),
    'power_pm': dict(synthType='sawtooth', instrumentPreset='powerChords', playbackMode='sample', sampleSet='dist-power-pm', volume=0.5),
    'single': dict(synthType='sawtooth', instrumentPreset='distGuitar', playbackMode='sample', sampleSet='dist-guitar', volume=0.45),
    'single_pm': dict(synthType='sawtooth', instrumentPreset='distGuitar', playbackMode='sample', sampleSet='dist-guitar-pm', volume=0.45),
}
STRING_DEFAULTS = {
    'violin': dict(synthType='sawtooth', instrumentPreset='violin', playbackMode='sample', sampleSet='violin', volume=0.45, reverbSend=0.35),
    'cello': dict(synthType='sawtooth', instrumentPreset='cello', playbackMode='sample', sampleSet='cello', volume=0.5, reverbSend=0.3),
}
SPLIT_SUFFIX = {'power': ' — Power Chords', 'power_pm': ' — Palm Mute', 'single': '', 'single_pm': ' — Palm-Muted Notes'}

# Songs are instruments only: a source track that looks like a vocal part (by name, or a GM voice/choir program) is refused.
VOCAL_NAME = re.compile(r'vocal|voice|voix|lyric|melody|singer|choir|chant', re.I)
VOCAL_PROGRAMS = {52, 53, 54, 85}  # Choir Aahs, Voice Oohs, Synth Voice, Lead 6 (voice)


def source_track_info(path, kind, track_index, channel=None):
    """(name, GM program) of a source track, for the vocal check."""
    if kind == 'gp':
        t = guitarpro.parse(path).tracks[track_index]
        return t.name, None if t.isPercussionTrack else t.channel.instrument
    tr = mido.MidiFile(path).tracks[track_index]
    name = next((m.name for m in tr if m.type == 'track_name'), '')
    prog = next((m.program for m in tr if m.type == 'program_change' and (channel is None or m.channel == channel)), None)
    return name, prog


def check_instrumental(recipe_id, path, kind, part):
    name, prog = source_track_info(path, kind, part['track'], part.get('channel'))
    if VOCAL_NAME.search(name) or prog in VOCAL_PROGRAMS:
        raise SystemExit(f"{recipe_id}: source track {part['track']} ({name!r}, program {prog}) looks like a vocal part — "
                         "songs are instruments only")


def build(recipe_id, r):
    src = os.path.join(SOURCES, r['file'])
    kind = 'gp' if re.search(r'\.gp\d?$', src) else 'mid'
    bars = r['bars']
    parts = []  # (config, events, is_drum)
    total_q = None
    for part in r['parts']:
        check_instrumental(recipe_id, src, kind, part)
        if kind == 'gp':
            evs, total_q = read_gp(src, part['track'], bars, part.get('transpose', 0))
        else:
            evs, total_q = read_midi(src, part['track'], bars, part.get('channel'), part.get('transpose', 0), part.get('role') == 'drums',
                                    pedal=part.get('pedal', False), bake_tempo=r.get('bake_tempo', False))
        role = part.get('role', 'single')
        if part.get('pm'):  # MIDI has no palm-mute marks: force the palm-muted samples for this part
            for e in evs:
                e.pm = True
        if part.get('from_q') is not None:  # this part only plays from that point of the segment (in quarter notes)
            evs = [e for e in evs if e.start >= part['from_q']]
        if part.get('until_q') is not None:  # ...and/or stops before that point
            evs = [e for e in evs if e.start < part['until_q']]
        if part.get('roots_only'):  # derive a bass line from a chord part: keep the lowest note of each onset
            lowest = {}
            for e in evs:
                if e.start not in lowest or e.pitch < lowest[e.start].pitch:
                    lowest[e.start] = e
            evs = sorted(lowest.values(), key=lambda e: e.start)
        if part.get('drop_below') is not None:
            evs = [e for e in evs if e.drum or e.pitch >= part['drop_below']]
        if part.get('keep_above') is not None:
            evs = [e for e in evs if e.drum or e.pitch >= part['keep_above']]
        if part.get('keep_below') is not None:
            evs = [e for e in evs if e.drum or e.pitch < part['keep_below']]
        if role == 'strings':
            # One "strings" part → violin samples for G3 and up, cello below
            for sub, keep, defaults in (('violin', lambda p: p >= 55, STRING_DEFAULTS['violin']),
                                        ('cello', lambda p: p < 55, STRING_DEFAULTS['cello'])):
                sub_evs = [e for e in evs if keep(e.pitch)]
                if sub_evs:
                    cfg = {**defaults, **part.get('config', {}), **part.get(sub, {})}
                    cfg['trackName'] = part.get(sub, {}).get('trackName', part['name'] + (' — Violins' if sub == 'violin' else ' — Cellos'))
                    parts.append((cfg, sub_evs, False, part))
            continue
        if role == 'guitar':
            split = split_guitar(evs, power=part.get('power', True), loose=part.get('loose_power', False))
            for sub, sub_evs in split.items():
                if not sub_evs:
                    continue
                cfg = {**DEFAULTS[sub], **part.get('config', {}), **part.get(sub, {})}
                cfg['trackName'] = part.get(sub, {}).get('trackName', part['name'] + SPLIT_SUFFIX[sub])
                parts.append((cfg, sub_evs, False, part))
        else:
            cfg = {**DEFAULTS.get(role, STRING_DEFAULTS.get(role, {})), **part.get('config', {})}
            cfg['trackName'] = part.get('name', cfg.get('trackName'))
            parts.append((cfg, evs, role == 'drums', part))
    spb = r.get('stepsPerBeat')
    fit = None
    if not spb:
        spb, fit = choose_grid([e for _, evs, _, _ in parts for e in evs])
    total_steps = int(total_q * spb)
    tracks = []
    for cfg, evs, is_drum, part in parts:
        rows, notes = to_notes(evs, spb, total_steps, is_drum, max_len=part.get('max_len'))
        if not notes:
            continue
        tracks.append({**cfg, 'rowNotes': rows, 'notes': notes})
    tempo = r.get('bpm')
    if tempo is None:
        tempo = gp_tempo_at(src, bars[0][0]) if kind == 'gp' else round(midi_tempo_at(mido.MidiFile(src), 0))
    song = {
        'name': r['name'], 'artist': r['artist'], 'source': r.get('source'),
        'bpm': tempo, 'stepsPerBeat': spb, 'stepResolution': RESOLUTION.get(spb, '16th'),
        'timeSignature': r.get('timeSignature', '4/4'), 'stepCount': total_steps,
        'scale': r.get('scale', 'naturalMinor'), 'rootNote': r.get('rootNote', 'E'),
        'swingPercentage': r.get('swing', 0), 'humanize': r.get('humanize', 0.25),
    }
    var, path = write_song(recipe_id, song, tracks)
    summary = ', '.join(f"{t['trackName']}({len(t['notes'])})" for t in tracks)
    print(f"{recipe_id}: {total_steps} steps @ {spb}/beat{'' if fit is None else f' (fit {fit:.0%})'}, {tempo} bpm — {summary}")
    return var


def write_index(playlist):
    """songs/index.ts: a small catalog (shown in the playlist, by category) whose notes load on demand as separate chunks.
    `playlist`: {category: [song ids]}."""
    lines = ["// Generated by scripts/build-songs.py — the playlist order of the built-in songs.",
             "// Each song's notes are a separate chunk, downloaded only when the song is selected.",
             "import type { SongMeta } from './song-format';", "", "export const SONG_CATALOG: SongMeta[] = ["]
    for category, rid in ((c, r) for c, ids in playlist.items() for r in ids):
        path = os.path.join(OUT_DIR, f"{rid}.ts")
        if not os.path.exists(path):
            continue
        src = open(path).read()
        var = re.search(r'export const (\w+): SongDef', src).group(1)
        meta = {k: json.loads(m.group(1)) for k in ('name', 'artist', 'bpm', 'stepsPerBeat', 'stepResolution', 'timeSignature',
                                                   'stepCount', 'scale', 'rootNote')
                for m in [re.search(rf'^  {k}: (.+),$', src, re.M)] if m}
        meta['trackCount'] = len(re.findall(r'^      trackName:', src, re.M))
        meta['category'] = category
        fields = ', '.join(f"{k}: {json.dumps(v, ensure_ascii=False)}" for k, v in meta.items())
        lines.append(f"  {{ {fields},")
        lines.append(f"    load: () => import('./{rid}').then(m => m.{var}) }},")
    lines.append("];")
    with open(os.path.join(OUT_DIR, 'index.ts'), 'w') as f:
        f.write('\n'.join(lines) + '\n')


if __name__ == '__main__':
    spec = importlib.util.spec_from_file_location('recipes', os.path.join(ROOT, 'scripts', 'song-recipes.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    recipes = mod.RECIPES
    wanted = sys.argv[1:] or list(recipes)
    for rid in wanted:
        if rid in recipes:
            build(rid, recipes[rid])
    write_index(getattr(mod, 'PLAYLIST', {'Draft': list(recipes)}))
