import { readFileSync, existsSync, readdirSync, copyFileSync } from 'fs';
import { resolve, join } from 'path';

// Standard note names
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToNote(midi) {
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[midi % 12];
  return `${name}${octave}`;
}

function noteToMidi(note) {
  const m = note.match(/^([A-G]#?)(-?\d+)$/);
  if (!m) return -1;
  const name = m[1];
  const octave = parseInt(m[2], 10);
  const idx = NOTE_NAMES.indexOf(name);
  return (octave + 1) * 12 + idx;
}

// Repo filename convention
function repoFilename(midi, note) {
  return `${String(midi).padStart(3, '0')}_${note.replace('#', 's')}.flac`;
}

// Source sample directory (FF/MF layer files)
const SAMPLES_DIR = resolve('SplendidGrandPiano/Samples');
const REPO_PIANO_DIR = resolve('samples/piano');

// Parse SFZ region file to map MIDI ranges to sample filenames
function parseRegions(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const regions = [];
  for (const line of content.split('\n')) {
    const lokey_m = line.match(/lokey=(\d+)/);
    const hikey_m = line.match(/hikey=(\d+)/);
    const keycenter_m = line.match(/pitch_keycenter=(\d+)/);
    // Sample name is: `sample=<name>.$EXT` — name may contain spaces
    const sample_m = line.match(/sample=(.+)\.\$EXT/);
    if (lokey_m && hikey_m && keycenter_m && sample_m) {
      regions.push({
        lokey: parseInt(lokey_m[1], 10),
        hikey: parseInt(hikey_m[1], 10),
        keycenter: parseInt(keycenter_m[1], 10),
        sampleFile: `${sample_m[1]}.flac`,
      });
    }
  }
  return regions;
}

const ffRegions = parseRegions('SplendidGrandPiano/Data/FF.txt');
const mfRegions = parseRegions('SplendidGrandPiano/Data/MF.txt');

// Match a MIDI note to its source sample file
function findSourceFile(midi) {
  for (const r of ffRegions) {
    if (midi >= r.lokey && midi <= r.hikey) {
      return r.sampleFile;
    }
  }
  for (const r of mfRegions) {
    if (midi >= r.lokey && midi <= r.hikey) {
      return r.sampleFile;
    }
  }
  return null;
}

// Check which files already exist in the repo
const existingFiles = new Set();
if (existsSync(REPO_PIANO_DIR)) {
  for (const f of readdirSync(REPO_PIANO_DIR)) {
    existingFiles.add(f);
  }
}

console.log(`Existing repo files: ${existingFiles.size}`);

let copied = 0;
let skipped = 0;
let missing = 0;

for (let midi = 21; midi <= 108; midi++) {
  const note = midiToNote(midi);
  const fname = repoFilename(midi, note);
  
  if (existingFiles.has(fname)) {
    skipped++;
    continue;
  }
  
  const sourceFile = findSourceFile(midi);
  if (!sourceFile) {
    console.log(`No source for MIDI ${midi} (${note})`);
    missing++;
    continue;
  }
  
  const sourcePath = join(SAMPLES_DIR, sourceFile);
  if (!existsSync(sourcePath)) {
    console.log(`Source file missing: ${sourcePath}`);
    missing++;
    continue;
  }
  
  const destPath = join(REPO_PIANO_DIR, fname);
  copyFileSync(sourcePath, destPath);
  console.log(`Created: ${fname} ← ${sourceFile}`);
  copied++;
}

console.log(`\nDone: ${copied} added, ${skipped} existed, ${missing} missing source`);
