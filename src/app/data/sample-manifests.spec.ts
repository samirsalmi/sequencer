import { SAMPLE_SETS, sampleUrl, samplesByDistance } from './sample-manifests';
import { INSTRUMENT_PRESETS, PLAYLIST_PRESETS } from './playlist-presets';
import { noteToMidi } from '../utils/music-theory';

describe('SAMPLE_SETS', () => {
  it('maps VSCO files to their real sounding pitch (files are named one octave low)', () => {
    expect(sampleUrl(SAMPLE_SETS['vsco-violin'], noteToMidi('A4'))).toMatch(/Violin_susVib_A3\.flac$/);
    expect(sampleUrl(SAMPLE_SETS['vsco-flute'], noteToMidi('C4'))).toMatch(/Flute_susvib_C3\.flac$/);
    expect(sampleUrl(SAMPLE_SETS['vsco-cello'], noteToMidi('C2'))).toMatch(/Cello_susvib_C1\.flac$/);
  });

  it('keeps the correctly named sets unshifted', () => {
    expect(sampleUrl(SAMPLE_SETS['acoustic-piano'], 69)).toMatch(/069_A4\.flac$/);
    expect(sampleUrl(SAMPLE_SETS['vsco-upright'], 69)).toMatch(/A4vH\.flac$/);
    expect(sampleUrl(SAMPLE_SETS['karoryfer-guitar'], 69)).toMatch(/Emily_A4\.flac$/);
  });

  it('excludes the piano files that are wrong-pitch copies', () => {
    const piano = SAMPLE_SETS['acoustic-piano'];
    expect(sampleUrl(piano, noteToMidi('C#4'))).toBeNull();
    expect(sampleUrl(piano, noteToMidi('C4'))).not.toBeNull();
    expect(samplesByDistance(piano, noteToMidi('C#4'))[0]).toBe(noteToMidi('C4'));
  });

  it('derives note ranges from the files', () => {
    expect(SAMPLE_SETS['vsco-violin'].noteRange).toEqual([noteToMidi('G3'), noteToMidi('D6')]);
    expect(SAMPLE_SETS['acoustic-piano'].noteRange).toEqual([noteToMidi('B0'), noteToMidi('C8')]);
  });

  it('every instrument preset points at an existing sample set', () => {
    for (const inst of Object.values(INSTRUMENT_PRESETS)) {
      if (inst.sampleSet) expect(SAMPLE_SETS[inst.sampleSet], inst.name).toBeDefined();
    }
    for (const preset of PLAYLIST_PRESETS) {
      for (const t of preset.tracks) {
        if (t.sampleSet) expect(SAMPLE_SETS[t.sampleSet], `${preset.name}/${t.trackName}`).toBeDefined();
      }
    }
  });
});
