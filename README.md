# Loomin

A browser-based step sequencer that plays **real instrument samples**, **retro synth voices**, or **both layered together**, with per-track delay/reverb sends, filters, swing, ties, an arpeggiator and MusicXML import. Built with Angular (signals) + Tailwind, running entirely on the Web Audio API. No server: real-instrument samples ship with the app (`public/samples/`, see [credits](public/samples/CREDITS.md)) and are cached in the browser.

## Run it

```bash
npm install
npm start          # http://localhost:4200
npm test           # unit tests (Vitest)
npm run build      # production build → dist/dev-gotchi/browser (deployed by Vercel)
```

## How sound is produced

Every track has a **playback mode**:

| Mode | What you hear |
|------|---------------|
| `synth` | Retro voices built only from the four basic waves (sine / square / triangle / sawtooth), shaped by each instrument's envelope, filter and vibrato. |
| `sample` | Real recorded instrument samples. Any note without a usable sample falls back to the retro voice, so a track never goes silent. |
| `layer` | Synth + sample together; `sampleBlend` sets the mix. |

The global **RETRO** toggle forces every track to synth.

## Code map

| Path | Role |
|------|------|
| `src/app/services/audio.service.ts` | Transport clock (look-ahead scheduler), track state, per-track mode dispatch |
| `src/app/services/master-mixer.service.ts` | Per-track channels (fader → filter → delay/reverb sends), master bus, LFO |
| `src/app/services/instruments/` | Poly / bass / distortion synths, drum synth, sample engine |
| `src/app/data/sample-manifests.ts` | Which sample files exist, at which pitch |
| `src/app/data/playlist-presets.ts` | Built-in songs and instrument presets |
| `src/app/utils/music-theory.ts` | Notes, scales, chords (single source of truth) |
| `src/app/utils/musicxml-parser.ts` | MusicXML / MXL import |

More detail: [`AI.md`](AI.md) (architecture and instrument catalogue), [`PRESET-FORMAT.md`](PRESET-FORMAT.md), [`loomin-composer-guide.md`](loomin-composer-guide.md), [`docs/sample-library.md`](docs/sample-library.md).
