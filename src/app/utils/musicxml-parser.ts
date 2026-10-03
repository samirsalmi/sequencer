import { SequencePreset } from '../data/playlist-presets';

const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const FLAT_TO_SHARP: Record<string, string> = {
  Cb: 'B', Db: 'C#', Eb: 'D#', Fb: 'E', Gb: 'F#', Ab: 'G#', Bb: 'A#',
};

const DYNAMICS_MAP: Record<string, number> = {
  ppp: 0.1, pp: 0.2, p: 0.35, mp: 0.5, mf: 0.6, f: 0.75, ff: 0.85, fff: 1.0,
  sfz: 0.9, fp: 0.6, sf: 0.85, sffz: 0.95, rfz: 0.8,
};

const CIRCLE_FIFTHS_MAJOR: Record<number, string> = {
  0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B',
  6: 'F#', 7: 'C#',
  [-1]: 'F', [-2]: 'A#', [-3]: 'D#', [-4]: 'G#', [-5]: 'C#', [-6]: 'F#', [-7]: 'B',
};

const SCALE_FROM_MODE: Record<string, string> = {
  major: 'major', minor: 'naturalMinor',
  'dorian': 'dorian', 'phrygian': 'naturalMinor',
  'lydian': 'major', 'mixolydian': 'major',
  'aeolian': 'naturalMinor', 'locrian': 'naturalMinor',
};

function musicXmlNoteName(step: string, alter: number | null, octave: number): string {
  let raw = `${step}${octave}`;
  if (!alter || alter === 0) return raw;
  const withAccidental = `${step}${octave}`;
  if (alter === 1) return `${step}#${octave}`;
  if (alter === -1) {
    if (step === 'C') return `B${octave - 1}`;
    if (step === 'F') return `E${octave}`;
    return FLAT_TO_SHARP[`${step}b`] + octave;
  }
  return raw;
}

function stepsPerMeasureFromTs(beats: number, beatType: number): number {
  return beats * (16 / beatType);
}

function findTempo(measureEl: Element): number | null {
  const directions = measureEl.querySelectorAll('direction');
  for (const d of directions) {
    const sound = d.querySelector('sound');
    if (sound?.getAttribute('tempo')) {
      return parseFloat(sound.getAttribute('tempo')!);
    }
  }
  return null;
}

function findDynamics(noteEl: Element): number | null {
  const dynEl = noteEl.querySelector('dynamic');
  if (!dynEl) return null;
  for (const child of dynEl.children) {
    const tag = child.tagName.toLowerCase();
    if (DYNAMICS_MAP[tag] !== undefined) return DYNAMICS_MAP[tag];
  }
  return null;
}

function noteInRange(note: string): boolean {
  const m = note.match(/^([A-G]#?)(\d+)$/);
  if (!m) return false;
  const octave = parseInt(m[2]);
  if (octave < 0 || octave > 8) return false;
  if (octave === 0 && !['A', 'A#', 'B'].includes(m[1])) return false;
  if (octave === 8 && m[1] !== 'C') return false;
  return true;
}

interface ParsedNote {
  step: number;
  rowIndex: number;
  velocity: number;
  durationSteps: number;
}

export function parseMusicXML(xmlString: string): SequencePreset {
  // Strip BOM and leading whitespace before any XML declaration
  let cleaned = xmlString.replace(/^\uFEFF/, '').trim();
  if (!cleaned.startsWith('<')) {
    throw new Error(
      'File does not start with "<". It may be a compressed MXL file (ZIP), ' +
      'a binary format, or contain invalid content at the start. ' +
      'Try exporting as uncompressed MusicXML (.musicxml) from your notation software.'
    );
  }

  const doc = new DOMParser().parseFromString(cleaned, 'text/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) throw new Error('Invalid XML: ' + parseError.textContent);

  const title =
    doc.querySelector('movement-title')?.textContent?.trim() ||
    doc.querySelector('work-title')?.textContent?.trim() ||
    'Imported Song';
  const artist =
    doc.querySelector('identification > creator')?.textContent?.trim() || 'Unknown';

  const partElements = doc.querySelectorAll('score-partwise > part');
  if (!partElements.length) throw new Error('No parts found in MusicXML');

  const firstMeasure = partElements[0].querySelector('measure');
  if (!firstMeasure) throw new Error('No measures found');

  const firstAttrs = firstMeasure.querySelector('attributes');
  const divisions = parseInt(firstAttrs?.querySelector('divisions')?.textContent || '1', 10);
  if (divisions <= 0) throw new Error('Invalid divisions value');

  const keyEl = firstAttrs?.querySelector('key');
  const fifths = parseInt(keyEl?.querySelector('fifths')?.textContent || '0', 10);
  const mode = keyEl?.querySelector('mode')?.textContent?.toLowerCase() || 'major';

  const timeEl = firstAttrs?.querySelector('time');
  const beats = parseInt(timeEl?.querySelector('beats')?.textContent || '4', 10);
  const beatType = parseInt(timeEl?.querySelector('beat-type')?.textContent || '4', 10);

  const bpm = findTempo(firstMeasure) || 120;

  const rootNote = CIRCLE_FIFTHS_MAJOR[fifths] || 'C';
  const scale = SCALE_FROM_MODE[mode] || 'major';

  const spm = stepsPerMeasureFromTs(beats, beatType);

  const tracks: SequencePreset['tracks'] = [];
  let maxStep = 0;

  for (let pi = 0; pi < partElements.length; pi++) {
    const partEl = partElements[pi];
    const partName = partEl.getAttribute('id') || `Part ${pi + 1}`;

    const rowNotesMap = new Map<string, number>();
    const gridRows: number[][] = [];
    const tieRows: boolean[][] = [];
    let currentStep = 0;

    const measureEls = partEl.querySelectorAll('measure');
    for (let mi = 0; mi < measureEls.length; mi++) {
      const measure = measureEls[mi];
      const measureNum = parseInt(measure.getAttribute('number') || String(mi + 1), 10);
      const mAttrs = measure.querySelector('attributes');
      let mDivisions = divisions;
      if (mAttrs?.querySelector('divisions')) {
        mDivisions = parseInt(mAttrs.querySelector('divisions')!.textContent!, 10);
      }

      const measureStepOffset = (measureNum - 1) * spm;
      let voiceTick = 0;
      let lastNonChordStep = -1;
      let lastNonChordDurationSteps = 0;

      const children = Array.from(measure.children);
      for (let ci = 0; ci < children.length; ci++) {
        const el = children[ci];
        const tag = el.tagName.toLowerCase();

        if (tag === 'attributes' || tag === 'barline' || tag === 'print') continue;

        if (tag === 'forward') {
          const dur = parseInt(el.querySelector('duration')?.textContent || '0', 10);
          voiceTick += dur;
          continue;
        }

        if (tag === 'backup') {
          const dur = parseInt(el.querySelector('duration')?.textContent || '0', 10);
          voiceTick -= dur;
          if (voiceTick < 0) voiceTick = 0;
          continue;
        }

        if (tag === 'note') {
          const isChord = el.querySelector('chord') !== null;
          const isRest = el.querySelector('rest') !== null;
          const durEl = el.querySelector('duration');
          if (!durEl) continue;
          const duration = parseInt(durEl.textContent!, 10);
          const durationSteps = Math.round((duration * 4) / mDivisions);
          if (durationSteps < 1) continue;

          let noteStep: number;
          if (isChord && lastNonChordStep >= 0) {
            noteStep = lastNonChordStep;
          } else {
            const tickPos = voiceTick;
            noteStep = measureStepOffset + Math.round((tickPos * 4) / mDivisions);
            voiceTick += duration;
            lastNonChordStep = noteStep;
            lastNonChordDurationSteps = durationSteps;
          }

          if (isRest) continue;

          const pitch = el.querySelector('pitch');
          if (!pitch) continue;
          const step = pitch.querySelector('step')?.textContent || 'C';
          const alterEl = pitch.querySelector('alter');
          const alter = alterEl ? parseInt(alterEl.textContent!, 10) : 0;
          const octave = parseInt(pitch.querySelector('octave')?.textContent || '4', 10);
          const noteName = musicXmlNoteName(step, alter, octave);
          if (!noteInRange(noteName)) continue;

          const dynamics = findDynamics(el);
          const velocity = dynamics ?? 0.7;

          let rowIdx = rowNotesMap.get(noteName);
          if (rowIdx === undefined) {
            rowIdx = rowNotesMap.size;
            rowNotesMap.set(noteName, rowIdx);
            gridRows.push([]);
            tieRows.push([]);
          }

          while (gridRows[rowIdx].length <= noteStep + durationSteps) {
            gridRows[rowIdx].push(0);
            tieRows[rowIdx].push(false);
          }

          gridRows[rowIdx][noteStep] = velocity;

          for (let s = noteStep + 1; s < noteStep + durationSteps; s++) {
            if (s < tieRows[rowIdx].length) {
              tieRows[rowIdx][s] = true;
            }
          }

          const endStep = noteStep + durationSteps;
          if (endStep > maxStep) maxStep = endStep;

          continue;
        }
      }
    }

    const stepCount = gridRows[0]?.length || 0;
    if (stepCount === 0) continue;

    const alignedCount = Math.ceil(stepCount / spm) * spm;

    for (let r = 0; r < gridRows.length; r++) {
      while (gridRows[r].length < alignedCount) gridRows[r].push(0);
      while (tieRows[r].length < alignedCount) tieRows[r].push(false);
    }

    const rowNotes: string[] = [];
    const sortedEntries = [...rowNotesMap.entries()].sort((a, b) => a[1] - b[1]);
    for (const [note] of sortedEntries) rowNotes.push(note);

    tracks.push({
      trackName: partName,
      synthType: 'triangle',
      playbackMode: 'sample',
      sampleSet: 'acoustic-piano',
      instrumentPreset: 'piano',
      reverbSend: 0.3,
      delaySend: 0.05,
      rowNotes,
      grid: gridRows,
      ties: tieRows,
    });
  }

  if (tracks.length === 0) throw new Error('No playable notes found');

  const finalStepCount = tracks.reduce((max, t) => Math.max(max, t.grid[0]?.length || 0), 0);

  return {
    name: title,
    artist,
    bpm,
    scale,
    rootNote,
    timeSignature: `${beats}/${beatType}`,
    stepCount: finalStepCount,
    stepResolution: '16th',
    swingPercentage: 0,
    tracks,
  };
}
