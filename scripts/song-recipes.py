"""Song recipes for scripts/build-songs.py.

Each recipe: source file (relative to $SONG_SOURCES), bar ranges (1-based, inclusive, concatenated), and parts.
A part maps one source track to app tracks:
  role 'guitar'  → split into power chords / palm-muted power chords / single notes / palm-muted notes
  role 'drums'   → General MIDI drums onto the app kit
  role 'bass' | anything else → one track; `config` overrides instrument, sample set, volume, pan, sends.
Sources are listed in docs/song-sources.md.
"""

CLEAN_GTR = dict(synthType='sawtooth', instrumentPreset='guitar', playbackMode='sample', sampleSet='electric-guitar')
NYLON_GTR = dict(synthType='triangle', instrumentPreset='classicalGuitar', playbackMode='sample', sampleSet='nylon-guitar')
STEEL_GTR = dict(synthType='sawtooth', instrumentPreset='acousticGuitar', playbackMode='sample', sampleSet='acoustic-guitar')
PIANO = dict(synthType='triangle', instrumentPreset='piano', playbackMode='sample', sampleSet='acoustic-piano')
CELLO = dict(synthType='sawtooth', instrumentPreset='cello', playbackMode='sample', sampleSet='cello')
VIOLIN = dict(synthType='sawtooth', instrumentPreset='violin', playbackMode='sample', sampleSet='violin')

RECIPES = {
    'enter-sandman': dict(
        name='Enter Sandman', artist='Metallica',
        source='Guitar Pro transcription (github.com/AlexMi-Ha/GuitarTabs), bars 2–37: intro, build-up and main riff',
        file='Metallica - Enter Sandman.gp5', bars=[(2, 37)], rootNote='E', scale='naturalMinor',
        parts=[
            dict(track=1, name='🎸 James — Clean Intro', role='clean', config={**CLEAN_GTR, 'volume': 0.6, 'pan': -0.25, 'reverbSend': 0.25, 'delaySend': 0.1}),
            dict(track=3, name='🤘 James — Rhythm', role='guitar', config={'pan': -0.4}),
            dict(track=4, name='🤘 Kirk', role='guitar', config={'pan': 0.4}),
            dict(track=5, name='🎸 Jason — Bass', role='bass'),
            dict(track=6, name='🥁 Lars — Drums', role='drums'),
        ],
    ),
    'hero': dict(
        name='Hero', artist='Skillet',
        source='Guitar Pro transcription (github.com/AlexMi-Ha/GuitarTabs), bars 1–13 (intro) + 30–37 (chorus, vocal line on lead guitar)',
        file='Skillet - Hero.gp5', bars=[(1, 13), (30, 37)], rootNote='D', scale='naturalMinor',
        parts=[
            dict(track=3, name='🎸 Ben — Riff', role='guitar', config={'pan': 0.35}),
            dict(track=4, name='🤘 Korey', role='guitar', config={'pan': -0.4}),
            dict(track=0, name='🎤 Vocal Line (Lead Guitar)', role='lead', transpose=12,
                 config={'synthType': 'sawtooth', 'instrumentPreset': 'distGuitar', 'playbackMode': 'sample', 'sampleSet': 'dist-guitar',
                         'volume': 0.5, 'pan': 0.1, 'delaySend': 0.15, 'reverbSend': 0.2}),
            dict(track=5, name='🎸 John — Bass', role='bass'),
            dict(track=6, name='🥁 Jen — Drums', role='drums'),
        ],
    ),
    'hail-to-the-king': dict(
        name='Hail to the King', artist='Avenged Sevenfold',
        source='Guitar Pro transcription (github.com/AlexMi-Ha/GuitarTabs), bars 1–32: the full intro build-up',
        file='Avenged Sevenfold - Hail to the King.gp5', bars=[(1, 32)], rootNote='C#', scale='harmonicMinor',
        parts=[
            dict(track=0, name='🎸 Synyster — Lead', role='guitar', config={'pan': 0.3, 'delaySend': 0.1}),
            dict(track=1, name='🤘 Zacky — Rhythm', role='guitar', config={'pan': -0.4}),
            dict(track=5, name='🎸 Johnny — Bass', role='bass'),
            dict(track=2, name='🥁 Drums', role='drums'),
        ],
    ),
    'monster': dict(
        name='Monster', artist='Skillet',
        source='Guitar Pro transcription (github.com/AlexMi-Ha/GuitarTabs), bars 1–8 (intro riff) + 26–33 (chorus, vocal line on lead guitar)',
        file='Skillet - Monster.gp5', bars=[(1, 8), (26, 33)], rootNote='G', scale='naturalMinor',
        parts=[
            dict(track=2, name='🤘 Ben', role='guitar', config={'pan': -0.4}),
            dict(track=3, name='🤘 Korey', role='guitar', config={'pan': 0.4}),
            dict(track=0, name='🎤 Vocal Line (Lead Guitar)', role='lead', transpose=12, config={'synthType': 'sawtooth', 'instrumentPreset': 'distGuitar', 'playbackMode': 'sample', 'sampleSet': 'dist-guitar', 'volume': 0.5, 'pan': 0.1, 'delaySend': 0.15, 'reverbSend': 0.2}),
            dict(track=7, name='🎻 Strings', role='strings'),
            dict(track=4, name='🎸 John — Bass', role='bass'),
            dict(track=6, name='🥁 Jen — Drums', role='drums'),
        ],
    ),
    'awake-and-alive': dict(
        name='Awake and Alive', artist='Skillet',
        source='Guitar Pro transcription (github.com/AlexMi-Ha/GuitarTabs), bars 1–13 (intro) + 30–37 (chorus)',
        file='Skillet - Awake And Alive.gp5', bars=[(1, 13), (30, 37)], rootNote='C', scale='naturalMinor',
        parts=[
            dict(track=0, name='🤘 Rhythm', role='guitar', config={'pan': -0.4}),
            dict(track=1, name='🤘 Lead', role='guitar', config={'pan': 0.4}),
            dict(track=2, name='🎻 Strings', role='strings'),
            dict(track=3, name='🎹 Piano', role='keys', config={**PIANO, 'volume': 0.5, 'reverbSend': 0.25}),
            dict(track=4, name='🎸 Bass', role='bass'),
            dict(track=5, name='🥁 Drums', role='drums'),
        ],
    ),
    'comatose': dict(
        name='Comatose', artist='Skillet',
        source='Guitar Pro transcription (github.com/AlexMi-Ha/GuitarTabs), bars 1–8 (strings intro into the riff) + 15–22',
        file='Skillet - Comatose.gp5', bars=[(1, 8), (15, 22)], rootNote='E', scale='naturalMinor',
        parts=[
            dict(track=0, name='🤘 Guitar L', role='guitar', config={'pan': -0.45}),
            dict(track=1, name='🤘 Guitar R', role='guitar', config={'pan': 0.45}),
            dict(track=4, name='🎻 Violin', role='violin'),
            dict(track=5, name='🎻 Cello', role='cello'),
            dict(track=6, name='🎹 Piano', role='keys', config={**PIANO, 'volume': 0.45, 'reverbSend': 0.25}),
            dict(track=7, name='🎛️ Synth', role='keys', config={'synthType': 'square', 'instrumentPreset': 'synthLead', 'playbackMode': 'synth', 'volume': 0.3, 'reverbSend': 0.2}),
            dict(track=8, name='🎛️ High Synth', role='keys', config={'synthType': 'square', 'instrumentPreset': 'synthLead', 'playbackMode': 'synth', 'volume': 0.22, 'delaySend': 0.2}),
            dict(track=3, name='🎸 Bass', role='bass'),
            dict(track=9, name='🥁 Drums', role='drums'),
            dict(track=10, name='🥁 Drums 2', role='drums', config={'volume': 0.9}),
        ],
    ),
    'nightmare': dict(
        name='Nightmare', artist='Avenged Sevenfold',
        source='Guitar Pro transcription (github.com/AlexMi-Ha/GuitarTabs), bars 17–49: music-box intro, 6/8 riff, "Nightmare!"',
        file='Avenged Sevenfold - NIghtmare.gp5', bars=[(17, 49)], timeSignature='6/8', rootNote='D', scale='naturalMinor',
        parts=[
            dict(track=2, name='🎸 Synyster — Lead', role='guitar', config={'pan': 0.35}),
            dict(track=3, name='🤘 Zacky — Rhythm', role='guitar', config={'pan': -0.35}),
            dict(track=4, name='🤘 Backing Guitar', role='guitar', config={'pan': -0.15}),
            dict(track=12, name='🔔 Music Box', role='keys', config={'synthType': 'sine', 'instrumentPreset': 'ePiano', 'playbackMode': 'synth', 'volume': 0.5, 'reverbSend': 0.4, 'delaySend': 0.2}),
            dict(track=10, name='🎻 Violin', role='violin'),
            dict(track=11, name='🎻 Cello', role='cello'),
            dict(track=7, name='🎸 Johnny — Bass', role='bass'),
            dict(track=8, name='🥁 Mike — Drums', role='drums'),
        ],
    ),
    'nothing-else-matters': dict(
        name='Nothing Else Matters', artist='Metallica',
        source='Guitar Pro transcription (github.com/AlexMi-Ha/GuitarTabs), bars 1–24: the clean intro',
        file='Metallica - Nothing Else Matters.gp5', bars=[(1, 24)], timeSignature='6/8', rootNote='E', scale='naturalMinor',
        parts=[
            dict(track=1, name='🎸 Kirk — Arpeggio', role='clean', config={**CLEAN_GTR, 'volume': 0.6, 'pan': -0.2, 'reverbSend': 0.35, 'delaySend': 0.08}),
            dict(track=2, name='🎸 James — Clean', role='clean', config={**CLEAN_GTR, 'volume': 0.55, 'pan': 0.25, 'reverbSend': 0.35}),
        ],
    ),
    'one': dict(
        name='One', artist='Metallica',
        source='Guitar Pro transcription (github.com/AlexMi-Ha/GuitarTabs), bars 9–32: clean intro with the lead melody, bass entry',
        file='Metallica - One.gp5', bars=[(9, 32)], rootNote='B', scale='naturalMinor',
        parts=[
            dict(track=3, name='🎸 James — Clean Rhythm', role='clean', config={**CLEAN_GTR, 'volume': 0.55, 'pan': -0.3, 'reverbSend': 0.3}),
            dict(track=2, name='🎸 Kirk — Clean Lead', role='clean', config={**CLEAN_GTR, 'volume': 0.6, 'pan': 0.25, 'reverbSend': 0.35, 'delaySend': 0.15}),
            dict(track=4, name='🎸 Kirk — Acoustic', role='clean', config={**STEEL_GTR, 'volume': 0.45, 'pan': 0.4, 'reverbSend': 0.25}),
            dict(track=5, name='🎸 Jason — Bass', role='bass'),
            dict(track=7, name='🥁 Lars — Drums', role='drums'),
        ],
    ),
    'billie-jean': dict(
        name='Billie Jean', artist='Michael Jackson',
        source='MIDI arrangement (Lakh MIDI Dataset clean_midi, "Billie Jean.2"), bars 3–28: drum intro, bassline, synth stabs, first verse melody',
        file='lakh - Jackson Michael - Billie Jean.2.mid', bars=[(3, 28)], rootNote='F#', scale='dorian',
        parts=[
            dict(track=10, name='🥁 Drums', role='drums'),
            dict(track=2, name='🎸 Bassline', role='bass', config={'volume': 0.8}),
            dict(track=3, name='🎛️ Synth Stabs', role='keys', config={'synthType': 'sawtooth', 'instrumentPreset': 'polySynth', 'playbackMode': 'synth', 'volume': 0.35, 'pan': -0.2, 'reverbSend': 0.2}),
            dict(track=4, name='🎤 Melody (Synth Lead)', role='lead', config={'synthType': 'square', 'instrumentPreset': 'synthLead', 'playbackMode': 'synth', 'volume': 0.4, 'pan': 0.1, 'delaySend': 0.15, 'reverbSend': 0.2}),
            dict(track=7, name='🎸 Muted Guitar', role='clean', config={**CLEAN_GTR, 'volume': 0.35, 'pan': 0.4}),
            dict(track=8, name='🎻 Strings', role='strings'),
        ],
    ),
    'beat-it': dict(
        name='Beat It', artist='Michael Jackson',
        source='MIDI arrangement (Lakh MIDI Dataset clean_midi, "Beat It"), bars 13–31: drum intro, the riff, first verse melody',
        file='lakh - Michael Jackson - Beat It.mid', bars=[(13, 31)], rootNote='E', scale='dorian',
        parts=[
            dict(track=2, name='🥁 Drums', role='drums'),
            dict(track=5, name='🤘 Guitar Riff', role='guitar', config={'pan': -0.35}),
            dict(track=7, name='🤘 Guitar Riff 2', role='guitar', config={'pan': 0.35}),
            dict(track=8, name='🎸 Muted Guitar', role='clean', config={**CLEAN_GTR, 'volume': 0.35, 'pan': 0.2}),
            dict(track=3, name='🎸 Bass', role='bass', config={'volume': 0.75}),
            dict(track=4, name='🎛️ Synth', role='keys', config={'synthType': 'sawtooth', 'instrumentPreset': 'polySynth', 'playbackMode': 'synth', 'volume': 0.3, 'pan': -0.15, 'reverbSend': 0.2}),
            dict(track=1, name='🎤 Melody (Synth Lead)', role='lead', config={'synthType': 'square', 'instrumentPreset': 'synthLead', 'playbackMode': 'synth', 'volume': 0.4, 'pan': 0.1, 'delaySend': 0.15, 'reverbSend': 0.2}),
        ],
    ),
    'smooth-criminal': dict(
        name='Smooth Criminal', artist='Michael Jackson',
        source='MIDI arrangement (Lakh MIDI Dataset clean_midi, "Smooth Criminal"), bars 2–25: synth-bass groove, brass stabs, verse melody',
        file='lakh - Michael Jackson - Smooth Criminal.mid', bars=[(2, 25)], rootNote='A', scale='naturalMinor',
        parts=[
            dict(track=2, name='🥁 Drums', role='drums'),
            dict(track=3, name='🎛️ Synth Bass', role='bass', config={'synthType': 'square', 'instrumentPreset': 'synthBass', 'playbackMode': 'synth', 'volume': 0.55}),
            dict(track=5, name='🎸 Muted Guitar', role='clean', config={**CLEAN_GTR, 'volume': 0.4, 'pan': 0.35}),
            dict(track=4, name='🎺 Synth Brass', role='keys', config={'synthType': 'sawtooth', 'instrumentPreset': 'synthBrass', 'playbackMode': 'synth', 'volume': 0.35, 'pan': -0.25, 'reverbSend': 0.2}),
            dict(track=8, name='🎛️ Poly Synth', role='keys', config={'synthType': 'sawtooth', 'instrumentPreset': 'polySynth', 'playbackMode': 'synth', 'volume': 0.28, 'pan': 0.25, 'reverbSend': 0.2}),
            dict(track=6, name='🎻 Strings', role='strings'),
            dict(track=1, name='🎤 Melody (Synth Lead)', role='lead', config={'synthType': 'square', 'instrumentPreset': 'synthLead', 'playbackMode': 'synth', 'volume': 0.4, 'pan': 0.05, 'delaySend': 0.15, 'reverbSend': 0.2}),
        ],
    ),
    'thriller': dict(
        name='Thriller', artist='Michael Jackson',
        source='MIDI arrangement (Lakh MIDI Dataset clean_midi, "Thriller"), bars 3–28: intro hits, the bassline groove, first verse melody',
        file='lakh - Michael Jackson - Thriller.mid', bars=[(3, 28)], rootNote='C#', scale='dorian',
        parts=[
            dict(track=0, channel=9, name='🥁 Drums', role='drums'),
            dict(track=0, channel=1, name='🎛️ Synth Bass', role='bass', config={'synthType': 'square', 'instrumentPreset': 'synthBass', 'playbackMode': 'synth', 'volume': 0.6}),
            dict(track=0, channel=6, name='🎸 Muted Guitar', role='clean', config={**CLEAN_GTR, 'volume': 0.35, 'pan': 0.35}),
            dict(track=0, channel=0, name='🎹 Electric Piano', role='keys', config={'synthType': 'sine', 'instrumentPreset': 'ePiano', 'playbackMode': 'synth', 'volume': 0.4, 'pan': -0.25, 'reverbSend': 0.25}),
            dict(track=0, channel=5, name='🎺 Synth Brass', role='keys', config={'synthType': 'sawtooth', 'instrumentPreset': 'synthBrass', 'playbackMode': 'synth', 'volume': 0.35, 'pan': 0.2, 'reverbSend': 0.25}),
            dict(track=0, channel=4, name='🎻 Strings', role='strings'),
            dict(track=0, channel=3, name='🎤 Melody (Synth Lead)', role='lead', config={'synthType': 'square', 'instrumentPreset': 'synthLead', 'playbackMode': 'synth', 'volume': 0.4, 'pan': 0.05, 'delaySend': 0.15, 'reverbSend': 0.2}),
        ],
    ),
    'in-the-end': dict(
        name='In the End', artist='Linkin Park',
        source='MIDI arrangement (github.com/qtangdongzkie-lab/Midi-files), bars 1–8 (piano riff) + 17–32 (riff with the band, chorus)',
        file='qt - In the End.mid', bars=[(1, 8), (17, 32)], rootNote='D#', scale='naturalMinor',
        parts=[
            dict(track=0, name='🎹 Piano Riff', role='keys', transpose=12, config={**PIANO, 'volume': 0.6, 'reverbSend': 0.3}),
            dict(track=1, name='🎸 Lead Guitar', role='lead', config={'synthType': 'sawtooth', 'instrumentPreset': 'distGuitar', 'playbackMode': 'sample', 'sampleSet': 'dist-guitar', 'volume': 0.4, 'pan': 0.3, 'delaySend': 0.15}),
            dict(track=2, name='🤘 Rhythm Guitar', role='guitar', config={'pan': -0.35}),
            dict(track=3, name='🎸 Bass', role='bass'),
            dict(track=5, name='🥁 Drums', role='drums'),
        ],
    ),
    'numb': dict(
        name='Numb', artist='Linkin Park',
        source='MIDI arrangement (github.com/qtangdongzkie-lab/Midi-files), bars 3–10 (intro) + 19–24 (chorus, vocal line on synth lead)',
        file='qt - Numb.mid', bars=[(3, 10), (19, 24)], rootNote='F#', scale='naturalMinor',
        parts=[
            dict(track=2, name='🎛️ Intro Synth', role='keys', config={'synthType': 'sawtooth', 'instrumentPreset': 'polySynth', 'playbackMode': 'synth', 'volume': 0.3, 'pan': 0.2, 'reverbSend': 0.3}),
            dict(track=3, name='🎹 Piano', role='keys', config={**PIANO, 'volume': 0.5, 'reverbSend': 0.25}),
            dict(track=5, name='🌫️ Pad', role='keys', config={'synthType': 'sawtooth', 'instrumentPreset': 'synthPad', 'playbackMode': 'synth', 'volume': 0.25, 'reverbSend': 0.35}),
            dict(track=0, name='🤘 Guitar', role='guitar', config={'pan': -0.3}),
            dict(track=6, name='🎤 Vocal Line (Synth Lead)', role='lead', config={'synthType': 'square', 'instrumentPreset': 'synthLead', 'playbackMode': 'synth', 'volume': 0.4, 'pan': 0.1, 'delaySend': 0.15, 'reverbSend': 0.2}),
            dict(track=1, name='🎸 Bass', role='bass'),
            dict(track=10, name='🥁 Drums', role='drums'),
            dict(track=8, name='👏 Claps', role='drums', config={'volume': 0.8}),
        ],
    ),
}

# Playlist order of every song file in src/app/data/songs (hand-written ones are not rebuilt from recipes).
PLAYLIST_ORDER = [
    # classics (hand-written)
    'fur-elise', 'canon-in-d', 'canon-in-d-2-0', 'happy-birthday-to-you',
    # Metallica
    'enter-sandman', 'nothing-else-matters', 'one',
    # Skillet
    'hero', 'monster', 'awake-and-alive', 'comatose',
    # Avenged Sevenfold
    'hail-to-the-king', 'nightmare', 'afterlife',
    # Michael Jackson
    'billie-jean', 'beat-it', 'smooth-criminal', 'thriller',
    # Linkin Park
    'in-the-end', 'numb',
    # indie / acoustic
    'stolen-dance', 'rockadown',
]

