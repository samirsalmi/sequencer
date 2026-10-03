# Sample library status

Samples are served from `github.com/samirsalmi/samples` via jsDelivr (`cdn.jsdelivr.net/gh/samirsalmi/samples@main/...`).
`src/app/data/sample-manifests.ts` lists only files that exist **and** sound at the pitch they are mapped to.
For any other note the sample engine re-pitches the nearest real sample (up to 7 semitones); beyond that, or when a
file can't be loaded, the synth plays instead.

## Known problems in the samples repo (audited 2026-10)

| Set | Problem | Status in the app |
|-----|---------|-------------------|
| `electric-guitar` (`guitar/*.wav`), `electric-bass` (`bass/*.wav`) | Stored with **Git LFS**. The repo (and so the CDN) holds 132-byte pointer files, not audio. | They fail to decode, so these tracks play the synth. **Fix:** commit the real WAVs (or FLAC) without LFS. |
| `acoustic-piano` | `scripts/fill-piano-notes.mjs` filled 26 missing keys by **copying** the neighbouring sample without re-pitching it, so those files play the wrong note (e.g. `061_Cs4.flac` is byte-identical to `060_C4.flac`). | Excluded from the manifest (`PIANO_WRONG_PITCH_COPIES`); neighbours are re-pitched instead. **Fix:** delete the copies, or re-render them pitch-shifted. |
| All `vsco-*` orchestral sets | VSCO names files with the "middle C = C3" convention, so `Violin_susVib_A3.flac` really sounds A4 (440 Hz). | Corrected with `VSCO_OCTAVE_SHIFT = 1`. Before this, every orchestral note played an octave too high. |
| `vsco-*`, `karoryfer-guitar`, `bjam-guitar` | Sparse: roughly one sample every 2–4 semitones. | Expected; gaps are re-pitched. The old manifest pointed at a URL for every semitone, so most notes 404'd and played late. |
| Drums | No `Clap` sample. | Clap uses the synth drum. |

Pitches were checked with an autocorrelation (YIN) detector on the decoded files. The piano copies were found by
matching git blob hashes.

## Adding a sample set

1. Upload files to the samples repo **without Git LFS**.
2. In `sample-manifests.ts`, build the map with `buildSamples(fileNotes, toFilename, octaveShift)`. Set `octaveShift`
   if the files' note names don't match their real pitch (check one file, e.g. A4 should be 440 Hz).
3. Set `sustained: true` for bowed, wind or brass instruments (notes stop at the end of the grid note), or
   `releaseSeconds` for plucked or struck ones (they ring out).
