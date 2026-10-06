# Limitations

What the built-in songs and the song converter can and can't do, and why. Sources for every song are listed in
[docs/song-sources.md](docs/song-sources.md).

## Where the songs come from

- **Transcriptions, not recordings.** Every song is built from a community transcription: a Guitar Pro tab or a MIDI
  file. A song is only as accurate as its transcriber, and some MIDI arrangements simplify parts. For example, the
  Beat It MIDI has no guitar solo.
- **Only GitHub was reachable.** The usual tab and music sites (Songsterr, Ultimate Guitar, MuseScore, BitMIDI,
  FreeMIDI, YouTube) can't be reached from the environment the songs were built in. The songs built there therefore
  come from public GitHub repositories, which is why some songs are missing or come from a particular arrangement.
  A tab downloaded by hand works the same way: Inis Mona comes from gprotab.net.
- **No transcription found:** Afterlife (Avenged Sevenfold) and Stolen Dance (Milky Chance).
  - Their hand-written intros were kept.
  - Afterlife's drum part is composed to follow its rhythm guitars, not transcribed.
  - Stolen Dance was re-voiced to acoustic guitar and bass.
  - Rockadown had no source at all and was removed.
- **Source files are not in the repo.** Rebuilding a song needs its source file downloaded locally (see
  docs/song-sources.md).
- **Segments, not full songs.** Each song is a 20–60 second segment (intro, main riff, chorus or solo).
- **Rush E stops before its "impossible" part.** That part plays thousands of notes a second, more than a
  browser piano can play. The segment ends where the theme in octaves lands on A, just before a joke chord of
  every key from C-1 to G9.

## Instruments only

- Songs never include a vocal part, not even a vocal melody played on an instrument. Songs carried mostly by the
  singer therefore play as band arrangements. This applies to Billie Jean, Thriller, Numb and Hero, among others.
  Their segments were picked around intros, riffs, instrumental breaks and solos instead.
- The converter refuses a source track whose name or General MIDI program looks like a vocal ("Vocals", "Lyrics",
  "Melody", choir and voice sounds). The check goes by names, so a vocal track with an unhelpful name (for example,
  just the singer's name) has to be left out of the recipe by hand.
- Gang shouts and chants (e.g. Thunderstruck's) are vocals too, so they are left out.

## What doesn't carry over from a tab or MIDI file

- **Bends** play as their target note, with no glide. Slides, vibrato, whammy bar, wah and pinch harmonics are not
  reproduced. Natural harmonics play as their harmonic pitch.
- **Dead notes** (muted string scratches) and grace notes are skipped. Because of that, Down with the Sickness skips
  the bars where the guitar only scratches along with the drums.
- **One tempo per song.** Tempo changes inside a segment are ignored; the tempo at the start of the segment is used. A MIDI recipe can set `bake_tempo` to write them into the note positions instead (River Flows in You's ritardandos).
- **Time signature is display only.** The grid plays steps in a row, so mixed meters (a 3/4 bar inside 4/4) are
  avoided when choosing segments.
- **Everything snaps to the grid.** The grid is 16th notes, or 12 or 24 steps per beat when the music has triplets.
  Loosely played MIDI loses some feel:
  - Beat It: only 74% of its notes sit on the 16th grid; the rest are snapped.
  - Billie Jean: 91%.
  - Smooth Criminal: 95%.
- **One note per pitch per step.** A repeated note that overlaps itself is shortened.
- **Dynamics are approximate.** Guitar Pro dynamics, accents and ghost notes map to note velocity.

## Sound

- **Distorted guitars** use real amp recordings:
  - power chords with roots C2–F3;
  - single notes E2–A5;
  - a palm-muted version of each.

  Other shapes are handled differently:
  - Double stops and open chords play as stacked single notes.
  - Full barre chords can be reduced to power chords; Megalovania's rhythm guitar does this.
  - The single-note set has 13 recorded pitches, so notes far from one are pitch-shifted further and sound
    slightly different.
- **Missing instruments.** There are no samples for:
  - saxophone, organ or choir;
  - real analog synths, so synth parts use the pure-wave synth presets in both modes;
  - slap or fretless bass (one electric bass set).

  The brass section uses the trumpet samples.
- **Drum kit.** The kit has 10 pieces: kick, snare, clap, closed and open hi-hat, three toms, ride and crash. General
  MIDI drums are mapped onto it as follows:
  - china and splash play as crash;
  - tambourine plays as hi-hat;
  - cowbell, maracas and other hand percussion are dropped.
- **Made-up parts.** Megalovania's arrangement has no bass, so its bass line follows the rhythm guitar's roots.
- **Retro mode** replaces every instrument with a synth built only from sine, square, triangle and sawtooth waves. It
  is a different sound by design; distortion and acoustic character are approximated.

## App and editor

- **Fine grids are heavy to edit.** Songs on 12 or 24 steps per beat (Chop Suey!: 1,152 steps, Nightmare: 2,472
  steps) are heavy to scroll and edit in the grid editor.
- **Songs load on demand.** Each song downloads the first time it's selected. That is instant locally, but may take
  a moment on a slow connection.
- **Humanize is random.** It adds random timing and velocity variation; there are no per-song groove templates.
