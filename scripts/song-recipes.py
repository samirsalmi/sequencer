"""Song recipes for scripts/build-songs.py.

Songs are instruments only: never map a vocal track (not even onto an instrument). Pick segments where the band carries
the song (intros, riffs, instrumental breaks, solos). build-songs.py refuses source tracks that look like vocals.

Each recipe: source file (relative to $SONG_SOURCES), bar ranges (1-based, inclusive, concatenated), and parts.
A part maps one source track to app tracks:
  role 'guitar'  → split into power chords / palm-muted power chords / single notes / palm-muted notes
  role 'drums'   → General MIDI drums onto the app kit
  role 'bass' | anything else → one track; `config` overrides instrument, sample set, volume, pan, sends.
  Other part options: transpose, channel (MIDI), pm (force palm-muted samples), roots_only (lowest note of each chord,
  e.g. to derive a bass line), loose_power (play any chord holding root + 5th as that power chord), from_q (start partway in, in quarter notes), keep_above / keep_below / drop_below (pitch
  filters), max_len (cap note length in steps).
Sources are listed in docs/song-sources.md.
"""

CLEAN_GTR = dict(synthType='sawtooth', instrumentPreset='guitar', playbackMode='sample', sampleSet='electric-guitar')
NYLON_GTR = dict(synthType='triangle', instrumentPreset='classicalGuitar', playbackMode='sample', sampleSet='nylon-guitar')
STEEL_GTR = dict(synthType='sawtooth', instrumentPreset='acousticGuitar', playbackMode='sample', sampleSet='acoustic-guitar')
PIANO = dict(synthType='triangle', instrumentPreset='piano', playbackMode='sample', sampleSet='acoustic-piano')
CELLO = dict(synthType='sawtooth', instrumentPreset='cello', playbackMode='sample', sampleSet='cello')
TRUMPET = dict(synthType='sawtooth', instrumentPreset='trumpet', playbackMode='sample', sampleSet='trumpet')
VIOLIN = dict(synthType='sawtooth', instrumentPreset='violin', playbackMode='sample', sampleSet='violin')
WHISTLE = dict(synthType='triangle', instrumentPreset='tinWhistle', playbackMode='sample', sampleSet='recorder')
BAGPIPE = dict(synthType='sawtooth', instrumentPreset='bagpipe', playbackMode='sample', sampleSet='bagpipe')
HURDY_GURDY = dict(synthType='sawtooth', instrumentPreset='hurdyGurdy', playbackMode='sample', sampleSet='hurdy-gurdy')

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
        source='Guitar Pro transcription (github.com/AlexMi-Ha/GuitarTabs), bars 1–13 (intro) + 22–37 (pre-chorus and chorus, band only)',
        file='Skillet - Hero.gp5', bars=[(1, 13), (22, 37)], rootNote='D', scale='naturalMinor',
        parts=[
            dict(track=3, name='🎸 Ben — Riff', role='guitar', config={'pan': 0.35}),
            dict(track=4, name='🤘 Korey', role='guitar', config={'pan': -0.4}),
            dict(track=7, name='🎹 Korey — Keys', role='keys', config={**PIANO, 'volume': 0.45, 'pan': 0.15, 'reverbSend': 0.25}),
            dict(track=8, name='🎻 Korey — Strings', role='strings'),
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
        source='Guitar Pro transcription (github.com/AlexMi-Ha/GuitarTabs), bars 1–8 (intro riff) + 26–41 (chorus, post-chorus and interlude, band only)',
        file='Skillet - Monster.gp5', bars=[(1, 8), (26, 41)], rootNote='G', scale='naturalMinor',
        parts=[
            dict(track=2, name='🤘 Ben', role='guitar', config={'pan': -0.4}),
            dict(track=3, name='🤘 Korey', role='guitar', config={'pan': 0.4}),
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
            dict(track=3, name='🎹 Piano', role='keys', config={**PIANO, 'volume': 0.3, 'reverbSend': 0.25}),
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
        source='Guitar Pro transcription (github.com/AlexMi-Ha/GuitarTabs), bars 17–49: music-box intro into the 6/8 main riff',
        file='Avenged Sevenfold - NIghtmare.gp5', bars=[(17, 49)], timeSignature='6/8', rootNote='D', scale='naturalMinor',
        parts=[
            dict(track=2, name='🎸 Synyster — Lead', role='guitar', config={'pan': 0.35}),
            dict(track=3, name='🤘 Zacky — Rhythm', role='guitar', config={'pan': -0.35}),
            dict(track=4, name='🤘 Backing Guitar', role='guitar', config={'pan': -0.15}, single={'volume': 0.33}),
            dict(track=12, name='🔔 Music Box', role='keys', config={'synthType': 'sine', 'instrumentPreset': 'ePiano', 'playbackMode': 'synth', 'volume': 0.5, 'reverbSend': 0.4, 'delaySend': 0.2}),
            dict(track=10, name='🎻 Violin', role='violin'),
            dict(track=11, name='🎻 Cello', role='cello'),
            dict(track=7, name='🎸 Johnny — Bass', role='bass'),
            dict(track=8, name='🥁 Mike — Drums', role='drums', config={'volume': 0.9}),
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
            dict(track=7, name='🥁 Lars — Drums', role='drums', config={'volume': 0.9}),
        ],
    ),
    'billie-jean': dict(
        name='Billie Jean', artist='Michael Jackson',
        source='MIDI arrangement (Lakh MIDI Dataset clean_midi, "Billie Jean.2"), bars 3–14 (drum intro, bassline, synth stabs) + 37–52 (pre-chorus and chorus backing), band only',
        file='lakh - Jackson Michael - Billie Jean.2.mid', bars=[(3, 14), (37, 52)], rootNote='F#', scale='dorian',
        parts=[
            dict(track=10, name='🥁 Drums', role='drums', config={'volume': 1.6}),
            dict(track=2, name='🎸 Bassline', role='bass', config={'volume': 0.65}),
            dict(track=3, name='🎛️ Synth Stabs', role='keys', config={'synthType': 'sawtooth', 'instrumentPreset': 'polySynth', 'playbackMode': 'synth', 'volume': 0.35, 'pan': -0.2, 'reverbSend': 0.2}),
            dict(track=1, name='🎹 Electric Piano', role='keys', config={'synthType': 'sine', 'instrumentPreset': 'ePiano', 'playbackMode': 'synth', 'volume': 0.4, 'pan': 0.2, 'reverbSend': 0.25}),
            dict(track=7, name='🎸 Muted Guitar', role='clean', max_len=1, config={**CLEAN_GTR, 'volume': 0.5, 'pan': 0.4}),
            dict(track=8, name='🎻 Strings', role='strings'),
            dict(track=11, name='🎺 Trumpet', role='brass', config={**TRUMPET, 'volume': 0.4, 'pan': -0.15, 'reverbSend': 0.25}),
        ],
    ),
    'beat-it': dict(
        name='Beat It', artist='Michael Jackson',
        source='MIDI arrangement (Lakh MIDI Dataset clean_midi, "Beat It"), bars 13–27 (drum intro, the riff, verse backing) + 40–51 (chorus backing), band only',
        file='lakh - Michael Jackson - Beat It.mid', bars=[(13, 27), (40, 51)], rootNote='E', scale='dorian',
        parts=[
            dict(track=2, name='🥁 Drums', role='drums'),
            dict(track=5, name='🤘 Guitar Riff', role='guitar', config={'pan': -0.35}),
            dict(track=7, name='🤘 Guitar Riff 2', role='guitar', config={'pan': 0.35}),
            dict(track=8, name='🎸 Muted Guitar', role='clean', config={**CLEAN_GTR, 'volume': 0.35, 'pan': 0.2}),
            dict(track=3, name='🎸 Bass', role='bass', config={'volume': 0.6}),
            dict(track=4, name='🎛️ Synth', role='keys', config={'synthType': 'sawtooth', 'instrumentPreset': 'polySynth', 'playbackMode': 'synth', 'volume': 0.3, 'pan': -0.15, 'reverbSend': 0.2}),
        ],
    ),
    'smooth-criminal': dict(
        name='Smooth Criminal', artist='Michael Jackson',
        source='MIDI arrangement (Lakh MIDI Dataset clean_midi, "Smooth Criminal"), bars 2–13 (synth-bass groove, brass stabs) + 70–85 (the instrumental break), band only',
        file='lakh - Michael Jackson - Smooth Criminal.mid', bars=[(2, 13), (70, 85)], rootNote='A', scale='naturalMinor',
        parts=[
            dict(track=2, name='🥁 Drums', role='drums'),
            dict(track=3, name='🎛️ Synth Bass', role='bass', config={'synthType': 'square', 'instrumentPreset': 'synthBass', 'playbackMode': 'synth', 'volume': 0.55}),
            dict(track=5, name='🎸 Muted Guitar', role='clean', config={**CLEAN_GTR, 'volume': 0.7, 'pan': 0.35}),
            dict(track=4, name='🎺 Synth Brass', role='keys', config={'synthType': 'sawtooth', 'instrumentPreset': 'synthBrass', 'playbackMode': 'synth', 'volume': 0.5, 'pan': 0.25, 'reverbSend': 0.2}),
            dict(track=11, name='🎺 Brass Section', role='brass', config={**TRUMPET, 'volume': 0.28, 'pan': -0.15, 'reverbSend': 0.2}),
            dict(track=10, name='🌫️ Pad', role='keys', config={'synthType': 'sawtooth', 'instrumentPreset': 'synthPad', 'playbackMode': 'synth', 'volume': 0.22, 'reverbSend': 0.35}),
        ],
    ),
    'thriller': dict(
        name='Thriller', artist='Michael Jackson',
        source='MIDI arrangement (Lakh MIDI Dataset clean_midi, "Thriller"), bars 3–20 (intro, the hits, bassline groove) + 37–44 (chorus backing), band only',
        file='lakh - Michael Jackson - Thriller.mid', bars=[(3, 20), (37, 44)], rootNote='C#', scale='dorian',
        parts=[
            dict(track=0, channel=9, name='🥁 Drums', role='drums'),
            dict(track=0, channel=1, name='🎛️ Synth Bass', role='bass', config={'synthType': 'square', 'instrumentPreset': 'synthBass', 'playbackMode': 'synth', 'volume': 0.6}),
            dict(track=0, channel=6, name='🎸 Muted Guitar', role='clean', config={**CLEAN_GTR, 'volume': 0.5, 'pan': 0.35}),
            dict(track=0, channel=0, name='🎹 Electric Piano', role='keys', config={'synthType': 'sine', 'instrumentPreset': 'ePiano', 'playbackMode': 'synth', 'volume': 0.4, 'pan': -0.25, 'reverbSend': 0.25}),
            dict(track=0, channel=5, name='🎺 Synth Brass', role='keys', config={'synthType': 'sawtooth', 'instrumentPreset': 'synthBrass', 'playbackMode': 'synth', 'volume': 0.4, 'pan': 0.2, 'reverbSend': 0.25}),
            dict(track=0, channel=4, name='🎻 Strings', role='strings', config={'volume': 0.32}),
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
            dict(track=5, name='🥁 Drums', role='drums', config={'volume': 1.7}),
        ],
    ),
    'numb': dict(
        name='Numb', artist='Linkin Park',
        source='MIDI arrangement (github.com/qtangdongzkie-lab/Midi-files), bars 3–10 (intro and piano riff) + 19–32 (chorus into the piano riff), band only',
        file='qt - Numb.mid', bars=[(3, 10), (19, 32)], rootNote='F#', scale='naturalMinor',
        parts=[
            dict(track=2, name='🎛️ Intro Synth', role='keys', config={'synthType': 'sawtooth', 'instrumentPreset': 'polySynth', 'playbackMode': 'synth', 'volume': 0.55, 'pan': 0.2, 'reverbSend': 0.3}),
            dict(track=3, name='🎹 Piano', role='keys', config={**PIANO, 'volume': 0.5, 'reverbSend': 0.25}),
            dict(track=5, name='🌫️ Pad', role='keys', config={'synthType': 'sawtooth', 'instrumentPreset': 'synthPad', 'playbackMode': 'synth', 'volume': 0.25, 'reverbSend': 0.35}),
            dict(track=4, name='🎻 Low Strings', role='cello'),
            dict(track=0, name='🤘 Guitar', role='guitar', config={'pan': -0.15}),
            dict(track=1, name='🎸 Bass', role='bass'),
            dict(track=10, name='🥁 Drums', role='drums', config={'volume': 1.6}),
            dict(track=8, name='👏 Claps', role='drums', config={'volume': 1.5}),
        ],
    ),
    'sweet-child-o-mine': dict(
        name="Sweet Child O' Mine", artist="Guns N' Roses",
        source='Guitar Pro transcription (github.com/AlexMi-Ha/GuitarTabs), bars 1–24: the intro riff and the band build-up',
        file="Guns N' Roses - Sweet Child O' Mine.gp5", bars=[(1, 24)], rootNote='C#', scale='major',
        parts=[
            dict(track=2, name='🎸 Slash — Intro Riff', role='guitar', config={'pan': 0.25, 'delaySend': 0.12, 'reverbSend': 0.2}),
            dict(track=3, name='🤘 Izzy — Rhythm', role='guitar', config={'pan': -0.4}, single={'volume': 0.35}),
            dict(track=4, name='🎸 Slash — Clean', role='clean', config={**CLEAN_GTR, 'volume': 0.6, 'pan': 0.45, 'reverbSend': 0.25}),
            dict(track=5, name='🎸 Duff — Bass', role='bass', config={'volume': 0.5}),
            dict(track=6, name='🥁 Steven — Drums', role='drums', config={'volume': 1.8}),
        ],
    ),
    'thunderstruck': dict(
        name='Thunderstruck', artist='AC/DC',
        source='Guitar Pro transcription (github.com/AlexMi-Ha/GuitarTabs), bars 14–37: the hammer-on riff as drums, bass and rhythm guitar join',
        file='ACDC - Thunderstruck.gp5', bars=[(14, 37)], rootNote='B', scale='major',
        parts=[
            dict(track=3, name='🎸 Angus — Riff', role='guitar', config={'pan': 0.25, 'reverbSend': 0.15}),
            dict(track=2, name='🤘 Malcolm — Rhythm', role='guitar', config={'pan': -0.35}),
            dict(track=5, name='🎸 Cliff — Bass', role='bass'),
            dict(track=6, name='🥁 Chris — Drums', role='drums'),
        ],
    ),
    'smells-like-teen-spirit': dict(
        name='Smells Like Teen Spirit', artist='Nirvana',
        source='Guitar Pro transcription (github.com/AlexMi-Ha/GuitarTabs), bars 1–7 (intro) + 76–95 (bridge and the guitar solo)',
        file='Nirvana - Smells Like Teen Spirit.gp5', bars=[(1, 7), (76, 95)], rootNote='F', scale='naturalMinor',
        parts=[
            dict(track=1, name='🎸 Kurt — Clean Intro', role='clean', config={**CLEAN_GTR, 'volume': 0.55, 'pan': -0.2, 'reverbSend': 0.2}),
            dict(track=2, name='🤘 Kurt — Main Riff', role='guitar', config={'pan': -0.3}),
            dict(track=4, name='🤘 Kurt — Overdubs', role='guitar', config={'volume': 0.35, 'pan': 0.35}),
            dict(track=3, name='🎸 Kurt — Solo', role='guitar', config={'pan': 0.15, 'delaySend': 0.15, 'reverbSend': 0.2}),
            dict(track=5, name='🎸 Krist — Bass', role='bass'),
            dict(track=6, name='🥁 Dave — Drums', role='drums'),
        ],
    ),
    'chop-suey': dict(
        name='Chop Suey!', artist='System of a Down',
        source='Guitar Pro transcription (github.com/AlexMi-Ha/GuitarTabs), bars 1–24: the acoustic intro riff into the heavy riff',
        file='System Of A Down - Chop Suey!.gp5', bars=[(1, 24)], rootNote='G', scale='harmonicMinor',
        parts=[
            dict(track=3, name='🎸 Daron — Acoustic Riff', role='clean', config={**STEEL_GTR, 'volume': 0.55, 'pan': -0.1, 'reverbSend': 0.2}),
            dict(track=0, name='🤘 Daron — Guitar L', role='guitar', config={'pan': -0.45}),
            dict(track=1, name='🤘 Daron — Guitar R', role='guitar', config={'pan': 0.45}),
            dict(track=2, name='🎸 Daron — Clean', role='clean', config={**CLEAN_GTR, 'volume': 0.4, 'pan': 0.25, 'reverbSend': 0.2}),
            dict(track=4, name='🎸 Shavo — Bass', role='bass', config={'volume': 0.8}),
            dict(track=10, name='🥁 John — Drums', role='drums', config={'volume': 0.8}),
        ],
    ),
    'down-with-the-sickness': dict(
        name='Down with the Sickness', artist='Disturbed',
        source='Guitar Pro transcription (github.com/AlexMi-Ha/GuitarTabs), bars 3–6 (drum intro) + 11–26 (the riff)',
        file='Disturbed - Down With The Sickness.gp5', bars=[(3, 6), (11, 26)], rootNote='C#', scale='naturalMinor',
        parts=[
            dict(track=0, name='🤘 Dan — Guitar', role='guitar', config={'pan': -0.1}),
            dict(track=3, name='🎸 Dan — Extras', role='clean', config={**CLEAN_GTR, 'volume': 0.4, 'pan': 0.4, 'reverbSend': 0.25}),
            dict(track=1, name='🎸 Fuzz — Bass', role='bass', config={'volume': 0.75}),
            dict(track=2, name='🥁 Mike — Drums', role='drums', config={'volume': 0.9}),
        ],
    ),
    'last-resort': dict(
        name='Last Resort', artist='Papa Roach',
        source='Guitar Pro transcription (github.com/AlexMi-Ha/GuitarTabs), bars 3–22: intro, the main riff, verse and chorus (band only)',
        file='Papa Roach - Last Resort.gp5', bars=[(3, 22)], rootNote='F#', scale='naturalMinor',
        parts=[
            dict(track=1, name='🤘 Jerry — Guitar', role='guitar', config={'pan': -0.3}),
            dict(track=2, name='🤘 Jerry — Fills', role='guitar', config={'volume': 0.32, 'pan': 0.35}),
            dict(track=3, name='🎸 Tobin — Bass', role='bass'),
            dict(track=4, name='🥁 Dave — Drums', role='drums'),
        ],
    ),
    'eye-of-the-tiger': dict(
        name='Eye of the Tiger', artist='Survivor',
        source='MIDI arrangement (Lakh MIDI Dataset clean_midi, "Eye Of The Tiger"), bars 2–23: the muted-guitar intro and the big hits (band only)',
        file='lakh - Survivor - Eye Of The Tiger.mid', bars=[(2, 23)], rootNote='C', scale='naturalMinor',
        parts=[
            dict(track=6, name='🤘 Muted Guitar', role='guitar', pm=True, config={'pan': -0.3}),
            dict(track=7, name='🤘 Overdrive Guitar', role='guitar', config={'pan': 0.4}, single={'volume': 0.35}),
            dict(track=8, name='🤘 Distortion Guitar', role='guitar', config={'pan': -0.4}),
            dict(track=5, name='🎹 Piano', role='keys', config={**PIANO, 'volume': 0.35, 'pan': 0.15, 'reverbSend': 0.2}),
            dict(track=4, name='🎸 Bass', role='bass'),
            dict(track=10, name='🥁 Drums', role='drums'),
        ],
    ),
    'the-final-countdown': dict(
        name='The Final Countdown', artist='Europe',
        source='MIDI arrangement (Lakh MIDI Dataset clean_midi, "The Final Countdown.1"), bars 8–35: the synth-brass intro and the full-band riff',
        file='lakh - Europe - The Final Countdown.1.mid', bars=[(8, 35)], rootNote='F#', scale='naturalMinor',
        parts=[
            dict(track=2, name='🎺 Synth Brass — Riff', role='keys', config={'synthType': 'sawtooth', 'instrumentPreset': 'synthBrass', 'playbackMode': 'synth', 'volume': 0.7, 'pan': 0.05, 'reverbSend': 0.25}),
            dict(track=3, name='🎺 Synth Brass 2', role='keys', config={'synthType': 'sawtooth', 'instrumentPreset': 'synthBrass', 'playbackMode': 'synth', 'volume': 0.3, 'pan': -0.2, 'reverbSend': 0.25}),
            dict(track=4, name='🎹 Organ', role='keys', config={'synthType': 'sawtooth', 'instrumentPreset': 'synthPad', 'playbackMode': 'synth', 'volume': 0.25, 'pan': 0.2, 'reverbSend': 0.3}),
            dict(track=5, name='🎻 Strings', role='strings', config={'volume': 0.3}),
            dict(track=6, name='🎛️ Poly Synth', role='keys', config={'synthType': 'sawtooth', 'instrumentPreset': 'polySynth', 'playbackMode': 'synth', 'volume': 0.3, 'pan': -0.1, 'reverbSend': 0.25}),
            dict(track=8, name='🤘 Overdrive Guitar', role='guitar', config={'pan': 0.4}),
            dict(track=11, name='🤘 Distortion Guitar', role='guitar', config={'pan': -0.4}),
            dict(track=7, name='🎸 Bass', role='bass', config={'volume': 0.5}),
            dict(track=10, name='🥁 Drums', role='drums', config={'volume': 0.9}),
        ],
    ),
    'megalovania': dict(
        name='Megalovania', artist='Toby Fox (Undertale), rock arrangement',
        source='Guitar Pro transcription (github.com/AlexMi-Ha/GuitarTabs), bars 1–24: intro riff, rhythm entry, lead melody; the bass follows the rhythm-guitar roots (the arrangement has no bass)',
        file='Toby Fox - Megalovania.gp5', bars=[(1, 24)], rootNote='D', scale='naturalMinor',
        parts=[
            dict(track=2, name='🎸 Intro Riff', role='guitar', config={'pan': 0.2}),
            dict(track=1, name='🤘 Rhythm', role='guitar', loose_power=True, config={'pan': -0.35}),
            dict(track=0, name='🎸 Lead', role='guitar', config={'volume': 0.6, 'pan': 0.3, 'delaySend': 0.15, 'reverbSend': 0.15}),
            dict(track=1, name='🎸 Bass', role='bass', roots_only=True, transpose=-12),
            dict(track=3, name='🥁 Drums', role='drums'),
        ],
    ),
    'inis-mona': dict(
        name='Inis Mona', artist='Eluveitie',
        source='Guitar Pro transcription (gprotab.net), bars 1–30 with repeats played: intro, verse, pre-chorus and chorus. '
               'The vocals are not in the transcription; the verse switches to 3/4 for bars 12–16',
        file='Eluveitie - Inis Mona.gp5',
        bars=[(1, 5), (2, 5), (6, 15), (12, 15), (16, 29), (26, 30)], rootNote='D', scale='naturalMinor',
        parts=[
            dict(track=0, name='🎵 Chrigel — Tin Whistle', role='whistle', config={**WHISTLE, 'volume': 0.5, 'pan': 0.15, 'reverbSend': 0.3}),
            dict(track=1, name='🎻 Meri — Fiddle', role='fiddle', config={**VIOLIN, 'volume': 0.45, 'pan': -0.2, 'reverbSend': 0.3}),
            # Written an octave below the chanter's range (F4–G5)
            dict(track=2, name='🎶 Sevan — Bagpipes', role='pipes', transpose=12, config={**BAGPIPE, 'volume': 0.35, 'pan': 0.3, 'reverbSend': 0.25}),
            dict(track=3, name='🎻 Anna — Hurdy-Gurdy', role='hurdy', config={**HURDY_GURDY, 'volume': 0.45, 'pan': -0.3, 'reverbSend': 0.25}),
            dict(track=4, name='🤘 Ivo', role='guitar', config={'pan': -0.45}),
            dict(track=5, name='🤘 Siméon', role='guitar', config={'pan': 0.45}),
            dict(track=7, name='🎸 Rafi — Bass', role='bass'),
            dict(track=6, name='🥁 Merlin — Drums', role='drums'),
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
    # more rock & metal
    'sweet-child-o-mine', 'thunderstruck', 'smells-like-teen-spirit', 'chop-suey', 'down-with-the-sickness',
    'last-resort', 'eye-of-the-tiger', 'the-final-countdown',
    # video games
    'megalovania',
    # folk metal
    'inis-mona',
    # indie / acoustic
    'stolen-dance',
]
