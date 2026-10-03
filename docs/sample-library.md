# Sample library

The app serves its own samples from `public/samples/` (no external CDN). Sources and licenses:
[`public/samples/CREDITS.md`](../public/samples/CREDITS.md).

## How the files were prepared (`scripts/build-samples.py`)

- **Leading silence trimmed.** Some source recordings started 25–35 ms late, which made notes drag behind the beat.
- **FLAC, not MP3.** Browsers don't remove MP3 encoder padding, which adds about 27 ms of delay to every note. FLAC
  decodes with no delay in Chrome, Firefox and Safari.
- **Mono, 16-bit, peak-normalized to -1 dBFS.** Tails are capped (3–5 s) with a fade.
- **Pitch-checked.** Every file is compared with its note name using a YIN pitch detector.

## Fixes found during the audit

| Problem | Fix |
|---------|-----|
| The old piano set had 26 keys that were byte-identical copies of a neighbouring key (wrong pitch) | Skipped; the engine re-pitches the nearest real key |
| The old VSCO files were named an octave low | Replaced by the correctly named tonejs-instruments versions |
| The old electric guitar and bass were Git LFS pointers (no audio on the CDN) | Replaced by Karoryfer guitar and bass |
| French horn `A3` really sounds A4 | Skipped |
| Nylon guitar `D5` really sounds D#5 | Renamed to `Ds5` |
| No clap sample | Added the Berklee clap (CC BY 3.0) |

## Adding a sample set

1. Add a `add_set(...)` line to `scripts/build-samples.py` and run it.
2. Add a `makeSet(...)` line to `src/app/data/sample-manifests.ts` with the file note names (sharps written as `s`, e.g. `Cs4`).
3. Set `noteOffRelease`: how long the sound dies away after the grid note ends (about 0.25 s for bowed or blown
   instruments, 0.4–0.7 s for guitar and piano).
