import { noteToMidi } from '../utils/music-theory';

// Sample library, served from this app (public/samples/). Built by scripts/build-samples.py:
// leading silence trimmed (notes start exactly on the beat), tails capped, peak-normalized, mono 16-bit FLAC,
// and every file pitch-checked against its note name. Sources and licenses: public/samples/CREDITS.md

export interface SampleSet {
  name: string;
  label: string;
  basePath: string;
  /** Sounding MIDI pitch → filename. */
  samples: ReadonlyMap<number, string>;
  /** Lowest / highest sounding MIDI note with a sample. */
  noteRange: [number, number];
  /** Optional cap on total ring time in seconds. */
  releaseSeconds?: number;
  /**
   * Seconds the sound takes to die away after the grid note ends (key / bow / finger released).
   * Short for bowed and blown instruments, longer for piano and guitar. Tie notes to let them ring longer.
   */
  noteOffRelease: number;
  /** Optional fade-in in seconds: softens the scratchy bow / breath onset of sustained instruments. */
  attackSeconds?: number;
}


const BASE = 'samples/';

function buildSamples(fileNotes: string[]): Map<number, string> {
  return new Map(fileNotes.map(n => [noteToMidi(n.replace('s', '#')), `${n}.flac`]));
}

function makeSet(name: string, label: string, noteOffRelease: number, fileNotes: string[], releaseSeconds?: number, attackSeconds?: number): SampleSet {
  const samples = buildSamples(fileNotes);
  const keys = [...samples.keys()];
  return { name, label, basePath: `${BASE}${name}/`, samples, noteRange: [Math.min(...keys), Math.max(...keys)], noteOffRelease, releaseSeconds, attackSeconds };
}

export const SAMPLE_SETS: Record<string, SampleSet> = {
  // Splendid Grand Piano (Steinway D), public domain
  'acoustic-piano': makeSet('acoustic-piano', 'Grand Piano', 0.7, ['B0', 'Ds1', 'F1', 'G1', 'A1', 'B1', 'Cs2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'Gs3', 'A3', 'As3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'Gs5', 'A5', 'As5', 'B5', 'Cs6', 'D6', 'Ds6', 'E6', 'F6', 'Fs6', 'G6', 'Gs6', 'A6', 'As6', 'B6', 'C7', 'Cs7', 'D7', 'Ds7', 'E7', 'F7', 'Fs7', 'G7', 'Gs7', 'A7', 'As7', 'B7', 'C8']),
  // Upright Piano KW, CC0 (freepats)
  'upright-piano': makeSet('upright-piano', 'Upright Piano', 0.5, ['A0', 'B0', 'C1', 'Ds1', 'Fs1', 'A1', 'B1', 'C2', 'Ds2', 'Fs2', 'B2', 'C3', 'Ds3', 'Fs3', 'A3', 'B3', 'Ds4', 'Fs4', 'A4', 'B4', 'C5', 'Ds5', 'Fs5', 'A5', 'B5', 'C6', 'Ds6', 'Fs6', 'A6', 'B6', 'C7', 'Ds7', 'Fs7', 'A7', 'B7', 'C8']),
  // University of Iowa MIS, free to use
  'acoustic-guitar': makeSet('acoustic-guitar', 'Acoustic Guitar (Steel)', 0.45, ['D2', 'Ds2', 'E2', 'F2', 'Fs2', 'G2', 'Gs2', 'A2', 'As2', 'B2', 'C3', 'Cs3', 'D3', 'Ds3', 'E3', 'F3', 'Fs3', 'G3', 'Gs3', 'A3', 'As3', 'B3', 'C4', 'Cs4', 'D4', 'Ds4', 'E4', 'F4', 'Fs4', 'G4', 'Gs4', 'A4', 'As4', 'B4', 'C5', 'Cs5', 'D5']),
  // Freesound pack 11573 by quartertone, CC BY
  'nylon-guitar': makeSet('nylon-guitar', 'Classical Guitar (Nylon)', 0.45, ['B1', 'D2', 'E2', 'Fs2', 'Gs2', 'A2', 'B2', 'Cs3', 'D3', 'E3', 'Fs3', 'G3', 'A3', 'B3', 'Cs4', 'Ds4', 'E4', 'Fs4', 'Gs4', 'A4', 'B4', 'Cs5', 'Ds5', 'E5', 'Fs5', 'G5', 'Gs5', 'A5', 'As5']),
  // Karoryfer Samples, CC0
  'electric-guitar': makeSet('electric-guitar', 'Electric Guitar', 0.4, ['Cs2', 'E2', 'Fs2', 'A2', 'C3', 'Ds3', 'Fs3', 'A3', 'C4', 'Ds4', 'Fs4', 'A4', 'C5', 'Ds5', 'Fs5', 'A5', 'C6']),
  // Karoryfer Samples, CC0
  'electric-bass': makeSet('electric-bass', 'Electric Bass', 0.25, ['Cs1', 'E1', 'G1', 'As1', 'Cs2', 'E2', 'G2', 'As2', 'Cs3', 'E3', 'G3', 'As3', 'Cs4', 'E4', 'G4', 'As4', 'Cs5']),
  // Karoryfer Emily Guitar, CC0
  'emily-guitar': makeSet('emily-guitar', 'Emily Guitar', 0.4, ['Cs2', 'E2', 'Fs2', 'A2', 'C3', 'Ds3', 'Fs3', 'A3', 'C4', 'Ds4', 'Fs4', 'A4', 'C5', 'Ds5', 'Fs5', 'A5', 'C6', 'D6']),
  // VSCO 2 CE, CC0
  'bjam-guitar': makeSet('bjam-guitar', 'BJAM Guitar', 0.35, ['E2', 'A2', 'D3', 'G3', 'B3', 'E4']),
  // VSCO 2 CE, CC0
  'violin': makeSet('violin', 'Violin', 0.25, ['G3', 'A3', 'C4', 'E4', 'G4', 'A4', 'C5', 'E5', 'G5', 'A5', 'C6', 'E6', 'G6', 'A6', 'C7']),
  // Freesound pack 12408 by flcellogrl, CC BY
  'cello': makeSet('cello', 'Cello', 0.25, ['C2', 'D2', 'Ds2', 'E2', 'F2', 'G2', 'Gs2', 'A2', 'As2', 'B2', 'C3', 'Cs3', 'D3', 'Ds3', 'E3', 'F3', 'Fs3', 'G3', 'Gs3', 'A3', 'As3', 'B3', 'C4', 'Cs4', 'D4', 'Ds4', 'E4', 'F4', 'Fs4', 'G4', 'Gs4', 'A4', 'B4', 'C5'], undefined, 0.07),
  // VSCO 2 CE, CC0
  'flute': makeSet('flute', 'Flute', 0.25, ['C4', 'E4', 'A4', 'C5', 'E5', 'A5', 'C6', 'E6', 'A6', 'C7']),
  // VSCO 2 CE, CC0
  'trumpet': makeSet('trumpet', 'Trumpet', 0.2, ['F3', 'A3', 'C4', 'Ds4', 'F4', 'G4', 'As4', 'D5', 'F5', 'A5', 'C6']),
  // VSCO 2 CE, CC0
  'french-horn': makeSet('french-horn', 'French Horn', 0.25, ['A1', 'C2', 'Ds2', 'G2', 'D3', 'F3', 'C4', 'D5', 'F5']),
};

/** Old set names (still stored in saved songs / browser storage) → current set. */
export const SAMPLE_SET_ALIASES: Record<string, string> = {
  'vsco-upright': 'upright-piano',
  'vsco-violin': 'violin',
  'vsco-cello': 'cello',
  'vsco-flute': 'flute',
  'vsco-trumpet': 'trumpet',
  'vsco-horn': 'french-horn',
  'karoryfer-guitar': 'emily-guitar',
};

export function getSampleSet(name: string | undefined): SampleSet | undefined {
  if (!name) return undefined;
  return SAMPLE_SETS[name] ?? SAMPLE_SETS[SAMPLE_SET_ALIASES[name]];
}

const drumFiles: Record<string, string> = {
  'Kick': 'kick.flac',
  'Snare': 'snare.flac',
  'Hi-Hat': 'hat-closed.flac',
  'Open Hi-Hat': 'hat-open.flac',
  'Tom Low': 'tom-low.flac',
  'Tom Mid': 'tom-mid.flac',
  'Tom High': 'tom-high.flac',
  'Ride': 'ride.flac',
  'Crash': 'crash.flac',
  'Clap': 'clap.flac',
};

/** URL of the sample for a drum name, or null. */
export function getDrumSamplePath(drumName: string): string | null {
  const file = drumFiles[drumName];
  return file ? `${BASE}drums/${file}` : null;
}

export function drumHasSample(drumName: string): boolean {
  return drumName in drumFiles;
}

/** URL of the sample recorded at exactly `midi`, or null if the set has none. */
export function sampleUrl(set: SampleSet, midi: number): string | null {
  const file = set.samples.get(midi);
  return file ? `${set.basePath}${file}` : null;
}

/** Sample MIDI notes ordered by distance from `midi` (closest first, lower pitch wins ties). */
export function samplesByDistance(set: SampleSet, midi: number, maxDistance = 12): number[] {
  return [...set.samples.keys()]
    .filter(m => Math.abs(m - midi) <= maxDistance)
    .sort((a, b) => Math.abs(a - midi) - Math.abs(b - midi) || a - b);
}
