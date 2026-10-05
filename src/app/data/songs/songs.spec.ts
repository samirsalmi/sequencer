import { SONG_CATALOG } from '.';
import { expandSong } from './song-format';
import { INSTRUMENT_PRESETS, PLAYLIST_PRESETS } from '../playlist-presets';
import { getSampleSet } from '../sample-manifests';
import { noteToMidi } from '../../utils/music-theory';

const DRUMS = new Set(['Kick', 'Snare', 'Hi-Hat', 'Open Hi-Hat', 'Tom Low', 'Tom Mid', 'Tom High', 'Ride', 'Crash', 'Clap']);

describe('built-in songs', () => {
  it('every catalog entry is in the playlist, with unique names', () => {
    expect(PLAYLIST_PRESETS.length).toBe(SONG_CATALOG.length);
    expect(new Set(SONG_CATALOG.map(s => s.name)).size).toBe(SONG_CATALOG.length);
  });

  it('every song is in a playlist category, with the Main songs first', () => {
    for (const meta of SONG_CATALOG) expect(['Main', 'Draft'], meta.name).toContain(meta.category);
    expect(SONG_CATALOG.filter(s => s.category === 'Main').map(s => s.name))
      .toEqual(['Für Elise (Easy Piano)', 'Canon in D', 'Canon in D 2.0', 'River Flows in You']);
    expect(PLAYLIST_PRESETS[0].category).toBe('Main'); // the app opens on the first song, under Main
  });

  it('every song loads and is valid', async () => {
    for (const meta of SONG_CATALOG) {
      const song = await meta.load();
      const where = song.name;
      expect(song.name, where).toBe(meta.name);
      expect(song.tracks.length, where).toBe(meta.trackCount);
      expect(song.bpm, where).toBeGreaterThan(30);
      expect(song.stepsPerBeat, where).toBeGreaterThan(0);
      for (const t of song.tracks) {
        const at = `${where} / ${t.trackName}`;
        if (t.instrumentPreset) expect(INSTRUMENT_PRESETS[t.instrumentPreset], at).toBeDefined();
        if (t.sampleSet) expect(getSampleSet(t.sampleSet), at).toBeDefined();
        for (const n of t.rowNotes) {
          if (!DRUMS.has(n)) expect(() => noteToMidi(n), `${at}: ${n}`).not.toThrow();
        }
        expect(t.notes.length, at).toBeGreaterThan(0);
        for (const [step, row, len, vel] of t.notes) {
          expect(row, at).toBeLessThan(t.rowNotes.length);
          expect(step + len, at).toBeLessThanOrEqual(song.stepCount);
          expect(vel, at).toBeGreaterThan(0);
          expect(vel, at).toBeLessThanOrEqual(1);
        }
      }
      const grid = expandSong(song);
      expect(grid.tracks.every(t => t.grid.every(r => r.length === song.stepCount)), where).toBe(true);
    }
  });

  it('songs are instruments only (no vocal parts)', async () => {
    for (const meta of SONG_CATALOG) {
      const song = await meta.load();
      for (const t of song.tracks) {
        expect(t.trackName, song.name).not.toMatch(/vocal|voice|lyric|singer|🎤/i);
      }
    }
  });
});
