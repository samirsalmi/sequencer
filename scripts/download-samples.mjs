/**
 * Download instrument samples from open-source GitHub repos into public/samples/
 *
 * Sources:
 *   Piano  — GareBear99/Free-Dark-Piano-Sound-Kit (MIT)
 *   Guitar — cluesurf/wave (Public Domain)
 *   Bass   — cluesurf/wave (Public Domain)
 *   Drums  — teropa/drumkit
 *
 * Run: node scripts/download-samples.mjs
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { get } from 'node:https';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = join(__dirname, '..', 'public', 'samples');

// ── Helpers ────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`  ↓ ${url}`);
    get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        download(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        console.error(`  ✗ HTTP ${res.statusCode} for ${url}`);
        resolve(false);
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        writeFileSync(dest, Buffer.concat(chunks));
        console.log(`  ✓ ${dest.split('\\').pop()}`);
        resolve(true);
      });
    }).on('error', (e) => {
      console.error(`  ✗ ${e.message}`);
      resolve(false);
    });
  });
}

const BASE_RAW = 'https://raw.githubusercontent.com';

// ── Piano: Free Dark Piano Sound Kit ──────────────────────────────────────
// MIDI 21 (A0) → MIDI 108 (C8)
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiToPianoNote(midi) {
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[midi % 12];
  return `${name}${octave}`;
}

async function downloadPiano() {
  console.log('\n🎹 Piano samples');
  const dir = join(SAMPLES_DIR, 'piano');
  ensureDir(dir);

  const PIANO_REPO = `${BASE_RAW}/GareBear99/Free-Dark-Piano-Sound-Kit/main/notes`;
  let count = 0;

  for (let midi = 21; midi <= 108; midi++) {
    const note = midiToPianoNote(midi);
    const filename = `${String(midi).padStart(3, '0')}_${note.replace('#', 's')}.wav`;
    const dest = join(dir, filename);

    if (existsSync(dest)) {
      count++;
      continue;
    }

    const ok = await download(`${PIANO_REPO}/${filename}`, dest);
    if (ok) count++;
  }

  console.log(`  Piano: ${count}/88 files ready`);
}

// ── Guitar: cluesurf/wavebase ────────────────────────────────────────────
const GUITAR_REPO = `${BASE_RAW}/cluesurf/wavebase/make/base/guitar/stratocaster`;

// MIDI ranges per string (Drop-D tuning as recorded in the repo)
// string-6: D2(38) - G#2(44)
// string-5: A2(45) - B2(47)
// string-4: D3(50) - F#3(54)
// string-3: G3(55) - A#3(58)
// string-2: B3(59) - D#4(63)
// string-1: E4(64) - C6(84)

function guitarStringNum(midi) {
  if (midi <= 44) return 6;
  if (midi <= 47) return 5;
  if (midi <= 54) return 4;
  if (midi <= 58) return 3;
  if (midi <= 63) return 2;
  return 1;
}

function noteToMidi(note) {
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const m = note.match(/^([A-G]#?)(-?\d+)$/);
  if (!m) return -1;
  const name = m[1];
  const octave = parseInt(m[2], 10);
  const idx = NOTE_NAMES.indexOf(name);
  if (idx === -1) return -1;
  return (octave + 1) * 12 + idx;
}

// Guitar notes that actually exist in the repo, with correct filenames
const GUITAR_FILES = [
  // string-6: D2 - G#2
  { note: 'D2', str: 6 }, { note: 'D#2', str: 6 }, { note: 'E2', str: 6 },
  { note: 'F2', str: 6 }, { note: 'F#2', str: 6 }, { note: 'G2', str: 6 }, { note: 'G#2', str: 6 },
  // string-5: A2 - B2
  { note: 'A2', str: 5 }, { note: 'A#2', str: 5 }, { note: 'B2', str: 5 },
  // string-4: D3 - F#3
  { note: 'D3', str: 4 }, { note: 'D#3', str: 4 }, { note: 'E3', str: 4 },
  { note: 'F3', str: 4 }, { note: 'F#3', str: 4 },
  // string-3: G3 - A#3
  { note: 'G3', str: 3 }, { note: 'G#3', str: 3 }, { note: 'A3', str: 3 }, { note: 'A#3', str: 3 },
  // string-2: B3 - D#4
  { note: 'B3', str: 2 }, { note: 'C4', str: 2 }, { note: 'C#4', str: 2 },
  { note: 'D4', str: 2 }, { note: 'D#4', str: 2 },
  // string-1: E4 - C6
  { note: 'E4', str: 1 }, { note: 'F4', str: 1 }, { note: 'F#4', str: 1 },
  { note: 'G4', str: 1 }, { note: 'G#4', str: 1 }, { note: 'A4', str: 1 },
  { note: 'A#4', str: 1 }, { note: 'B4', str: 1 }, { note: 'C5', str: 1 },
  { note: 'C#5', str: 1 }, { note: 'D5', str: 1 }, { note: 'D#5', str: 1 },
  { note: 'E5', str: 1 }, { note: 'F5', str: 1 }, { note: 'F#5', str: 1 },
  { note: 'G5', str: 1 }, { note: 'G#5', str: 1 }, { note: 'A5', str: 1 },
  { note: 'A#5', str: 1 }, { note: 'B5', str: 1 }, { note: 'C6', str: 1 },
];

async function downloadGuitar() {
  console.log('\n🎸 Guitar samples');
  const dir = join(SAMPLES_DIR, 'guitar');
  ensureDir(dir);
  let count = 0;

  for (const { note, str } of GUITAR_FILES) {
    const m = note.match(/^([A-G])(#?)(-?\d+)$/);
    if (!m) continue;
    const letter = m[1];
    const sharp = m[2] === '#' ? 'x' : '';
    const octave = m[3];
    const noteName = `${letter}${sharp}${octave}`;
    const displayLetter = sharp ? `${letter}x` : letter;
    const filename = `string-${str}-${displayLetter}-as-${noteName}.wav`;
    const dest = join(dir, filename);
    if (existsSync(dest)) { count++; continue; }
    const ok = await download(`${GUITAR_REPO}/${filename}`, dest);
    if (ok) count++;
  }

  console.log(`  Guitar: ${count}/${GUITAR_FILES.length} files ready`);
}

// ── Bass: cluesurf/wavebase ──────────────────────────────────────────────
const BASS_REPO = `${BASE_RAW}/cluesurf/wavebase/make/base/bass`;

const BASS_FILES = [
  // string-4: D1 - G#1
  { note: 'D1', str: 4 }, { note: 'D#1', str: 4 },
  { note: 'E1', str: 4 }, { note: 'F1', str: 4 }, { note: 'F#1', str: 4 },
  { note: 'G1', str: 4 }, { note: 'G#1', str: 4 },
  // string-3: A1 - C#2
  { note: 'A1', str: 3 }, { note: 'A#1', str: 3 }, { note: 'B1', str: 3 },
  { note: 'C2', str: 3 }, { note: 'C#2', str: 3 },
  // string-2: D2 - F#2
  { note: 'D2', str: 2 }, { note: 'D#2', str: 2 }, { note: 'E2', str: 2 },
  { note: 'F2', str: 2 }, { note: 'F#2', str: 2 },
  // string-1: G2 - G#3
  { note: 'G2', str: 1 }, { note: 'G#2', str: 1 }, { note: 'A2', str: 1 },
  { note: 'A#2', str: 1 }, { note: 'B2', str: 1 }, { note: 'C3', str: 1 },
  { note: 'C#3', str: 1 }, { note: 'D3', str: 1 }, { note: 'D#3', str: 1 },
  { note: 'E3', str: 1 }, { note: 'F3', str: 1 }, { note: 'F#3', str: 1 },
  { note: 'G3', str: 1 }, { note: 'G#3', str: 1 },
];

async function downloadBass() {
  console.log('\n🔊 Bass samples');
  const dir = join(SAMPLES_DIR, 'bass');
  ensureDir(dir);
  let count = 0;

  for (const { note, str } of BASS_FILES) {
    const m = note.match(/^([A-G])(#?)(-?\d+)$/);
    if (!m) continue;
    const letter = m[1];
    const sharp = m[2] === '#' ? 'x' : '';
    const octave = m[3];
    const noteName = `${letter}${sharp}${octave}`;
    const displayLetter = sharp ? `${letter}x` : letter;
    const filename = `string-${str}-${displayLetter}-as-${noteName}.wav`;
    const dest = join(dir, filename);
    if (existsSync(dest)) { count++; continue; }
    const ok = await download(`${BASS_REPO}/${filename}`, dest);
    if (ok) count++;
  }

  console.log(`  Bass: ${count}/${BASS_FILES.length} files ready`);
}

// ── Drums: teropa/drumkit ────────────────────────────────────────────────
const DRUM_REPO = `${BASE_RAW}/teropa/drumkit/master/src/assets`;

const DRUMS = {
  'kick.mp3': 'kick.mp3',
  'snare.mp3': 'snare.mp3',
  'hat-closed.mp3': 'hatClosed.mp3',
  'hat-open.mp3': 'hatOpen.mp3',
  'tom-low.mp3': 'tomLow.mp3',
  'tom-mid.mp3': 'tomMid.mp3',
  'tom-high.mp3': 'tomHigh.mp3',
  'ride.mp3': 'ride.mp3',
  'crash.mp3': 'crash.mp3',
};

async function downloadDrums() {
  console.log('\n🥁 Drum samples');
  const dir = join(SAMPLES_DIR, 'drums');
  ensureDir(dir);
  let count = 0;

  for (const [localName, repoName] of Object.entries(DRUMS)) {
    const dest = join(dir, localName);
    if (existsSync(dest)) { count++; continue; }
    const ok = await download(`${DRUM_REPO}/${repoName}`, dest);
    if (ok) count++;
  }

  console.log(`  Drums: ${count}/${Object.keys(DRUMS).length} files ready`);
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Downloading instrument samples ===\n');

  await downloadPiano();
  await downloadGuitar();
  await downloadBass();
  await downloadDrums();

  console.log('\n=== Done ===');
}

main().catch(console.error);
