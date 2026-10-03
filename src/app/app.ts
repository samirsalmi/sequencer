import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AudioService } from './services/audio.service';
import { CHROMATIC, getChordNotes, getScaleNotes, midiToNote, normalizeNote } from './utils/music-theory';
import { INSTRUMENT_PRESETS, PLAYLIST_PRESETS, SequencePreset, StepResolution } from './data/playlist-presets';
import { SAMPLE_SETS } from './data/sample-manifests';
import { validateStepAlignment, stepsPerMeasure } from './utils/time-signature';
import { parseMusicXML } from './utils/musicxml-parser';

// ── localStorage helpers ───────────────────────────────────────────────────────
const USER_SONGS_KEY = 'loomin_user_songs';
function loadUserSongs(): SequencePreset[] {
  try { return JSON.parse(localStorage.getItem(USER_SONGS_KEY) ?? '[]'); } catch { return []; }
}
function saveUserSongs(songs: SequencePreset[]): void {
  try { localStorage.setItem(USER_SONGS_KEY, JSON.stringify(songs)); } catch {}
}

// ── Music helpers ─────────────────────────────────────────────────────────────
/** Canonical sharp spelling for pitched notes ("Bb3" → "A#3"); drum names pass through. */
function normalizeNoteOrDrum(n: string): string {
  return normalizeNote(n) ?? n;
}

/** Default row notes for a new melodic track: one octave of the song's scale. */
function defaultRowNotes(root: string, scale: string): string[] {
  const notes = getScaleNotes(root, scale, 4);
  return notes.length ? notes : getScaleNotes('C', 'pentatonic', 4);
}

// ── MXL (ZIP) extraction ───────────────────────────────────────────────────────
async function extractFromMxl(buf: ArrayBuffer): Promise<string> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buf);

  // Standard MXL: container.xml points to the rootfile
  const container = zip.file('META-INF/container.xml');
  if (container) {
    const text = await container.async('string');
    const doc = new DOMParser().parseFromString(text, 'text/xml');
    const rootfile = doc.querySelector('rootfile');
    const fullPath = rootfile?.getAttribute('full-path');
    if (fullPath) {
      const entry = zip.file(fullPath);
      if (entry) return await entry.async('string');
    }
  }

  // Fallback: first .xml / .musicxml outside META-INF/
  const files = zip.files;
  const found = Object.keys(files).find(f =>
    !f.startsWith('META-INF/') && (f.endsWith('.xml') || f.endsWith('.musicxml'))
  );
  if (found) return await files[found].async('string');

  throw new Error('Could not find a MusicXML file inside the MXL archive.');
}

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected readonly audio = inject(AudioService);
  readonly SAMPLE_SETS = SAMPLE_SETS;
  readonly Math = Math;
  readonly playbackModes: ('synth' | 'sample' | 'layer')[] = ['synth', 'sample', 'layer'];

  // ── Playlists (static + user songs) ─────────────────────────────────────────
  readonly userSongs = signal<SequencePreset[]>(loadUserSongs());
  readonly playlists = computed(() => [...PLAYLIST_PRESETS, ...this.userSongs()]);

  readonly selectedPresetIndex = signal(0);
  readonly activeTrackIndex = signal(0);

  readonly activeNotes = computed(() =>
    this.audio.preset()?.tracks[this.activeTrackIndex()]?.rowNotes ?? []
  );
  readonly activeSynthType = computed(() =>
    this.audio.preset()?.tracks[this.activeTrackIndex()]?.synthType ?? 'triangle'
  );
  readonly activeNodes = computed(() =>
    this.audio.nodes().filter(n => n.trackIndex === this.activeTrackIndex())
  );

  // ── Grid Pagination ───────────────────────────────────────────────────────────
  readonly gridOffset = signal(0);
  readonly pageSize = 50;

  readonly visibleSteps = computed(() => {
    const start = this.gridOffset();
    const end = Math.min(start + this.pageSize, this.audio.stepCount());
    return Array.from({ length: end - start }, (_, i) => i + start);
  });

  readonly canScrollLeft = computed(() => this.gridOffset() > 0);
  readonly canScrollRight = computed(() =>
    this.gridOffset() + this.pageSize < this.audio.stepCount()
  );
  readonly visibleStart = computed(() => this.gridOffset() + 1);
  readonly visibleEnd = computed(() =>
    Math.min(this.gridOffset() + this.pageSize, this.audio.stepCount())
  );

  scrollLeft(): void {
    if (!this.canScrollLeft()) return;
    this.gridOffset.set(this.gridOffset() - this.pageSize);
  }

  scrollRight(): void {
    if (!this.canScrollRight()) return;
    this.gridOffset.set(this.gridOffset() + this.pageSize);
  }

  // Reset pagination when switching presets
  // (keyed on the song name only — grid edits also update the preset signal)
  private readonly _presetName = computed(() => this.audio.preset()?.name);
  private readonly _resetOffset = effect(() => {
    this._presetName();
    this.gridOffset.set(0);
  });

  // ── FX Panel ──────────────────────────────────────────────────────────────────
  readonly showFXPanel = signal(false);

  // ── New Song / Edit Song Modal ───────────────────────────────────────────────
  readonly showNewSongModal = signal(false);
  readonly editingSongIndex = signal<number | null>(null);
  newSongName   = 'My Song';
  newSongArtist = 'Me';
  newSongBpm    = 120;
  newSongRoot   = 'C';
  newSongScale  = 'major';
  newSongSteps  = 16;
  newSongTimeSignature = '4/4';
  newSongStepResolution: StepResolution = '16th';

  readonly timeSignatureOptions = ['2/4', '3/4', '4/4', '5/4', '6/8', '12/8'];
  readonly stepResolutionOptions: StepResolution[] = ['16th', '8th'];

  readonly stepAlignmentMessage = computed(() => {
    if (this.showNewSongModal()) {
      const result = validateStepAlignment(this.newSongSteps, this.newSongTimeSignature, this.newSongStepResolution);
      return result.message;
    }
    return '';
  })
  readonly rootNotes = [...CHROMATIC];
  readonly scaleOptions = [
    { label: 'Major',         value: 'major' },
    { label: 'Natural Minor', value: 'naturalMinor' },
    { label: 'Harmonic Minor', value: 'harmonicMinor' },
    { label: 'Dorian',        value: 'dorian' },
    { label: 'Pentatonic',    value: 'pentatonic' },
    { label: 'Minor Pentatonic', value: 'minorPentatonic' },
  ];

  openNewSongModal(): void {
    this.editingSongIndex.set(null);
    this.newSongName   = 'My Song';
    this.newSongArtist = 'Me';
    this.newSongBpm    = 120;
    this.newSongRoot   = 'C';
    this.newSongScale  = 'major';
    this.newSongSteps  = 16;
    this.newSongTimeSignature = '4/4';
    this.newSongStepResolution = '16th';
    this.showNewSongModal.set(true);
  }

  openEditSongModal(globalIndex: number, event: MouseEvent): void {
    event.stopPropagation();
    const song = this.playlists()[globalIndex];
    if (!song) return;
    this.newSongName   = song.name;
    this.newSongArtist = song.artist;
    this.newSongBpm    = song.bpm;
    this.newSongRoot   = song.rootNote;
    this.newSongScale  = song.scale;
    this.newSongSteps  = song.stepCount || 16;
    this.newSongTimeSignature = song.timeSignature || '4/4';
    this.newSongStepResolution = song.stepResolution || '16th';
    this.editingSongIndex.set(globalIndex);
    this.showNewSongModal.set(true);
  }

  cancelNewSong(): void { this.showNewSongModal.set(false); }

  createSong(): void {
    const editIdx = this.editingSongIndex();

    if (editIdx !== null) {
      // ── Edit mode: update existing user song ──
      const userIdx = editIdx - PLAYLIST_PRESETS.length;
      const songs = [...this.userSongs()];
      const old = songs[userIdx];
      if (!old) return;
      songs[userIdx] = {
        ...old,
        name:     this.newSongName.trim()   || old.name,
        artist:   this.newSongArtist.trim() || old.artist,
        bpm:      Math.max(40, Math.min(300, this.newSongBpm)),
        scale:    this.newSongScale,
        rootNote: this.newSongRoot,
        stepCount: Math.max(1, this.newSongSteps),
        timeSignature: this.newSongTimeSignature,
        stepResolution: this.newSongStepResolution,
      };
      this.userSongs.set(songs);
      saveUserSongs(songs);
      this.audio.loadPreset(songs[userIdx]);
    } else {
      // ── Create mode: build a brand new song ──
      const notes     = defaultRowNotes(this.newSongRoot, this.newSongScale);
      const sc        = Math.max(1, this.newSongSteps);
      const emptyGrid = notes.map(() => Array(sc).fill(0));
      const song: SequencePreset = {
        name:     this.newSongName.trim()   || 'My Song',
        artist:   this.newSongArtist.trim() || 'Me',
        bpm:      Math.max(40, Math.min(300, this.newSongBpm)),
        scale:    this.newSongScale,
        rootNote: this.newSongRoot,
        stepCount: sc,
        timeSignature: this.newSongTimeSignature,
        stepResolution: this.newSongStepResolution,
        tracks: [{
          trackName: 'Track 1',
          synthType: 'triangle',
          rowNotes: notes,
          grid: emptyGrid,
        }],
      };
      const updated = [...this.userSongs(), song];
      this.userSongs.set(updated);
      saveUserSongs(updated);
      const newIndex = PLAYLIST_PRESETS.length + updated.length - 1;
      this.selectedPresetIndex.set(newIndex);
      this.activeTrackIndex.set(0);
      this.audio.loadPreset(song);
    }

    this.showNewSongModal.set(false);
  }

  deleteSong(index: number, event: MouseEvent): void {
    event.stopPropagation();
    if (index < PLAYLIST_PRESETS.length) return; // protect built-ins
    const userIndex = index - PLAYLIST_PRESETS.length;
    const updated   = this.userSongs().filter((_, i) => i !== userIndex);
    this.userSongs.set(updated);
    saveUserSongs(updated);

    // If we deleted the active/a-later song, reset to 0
    if (this.selectedPresetIndex() === index || this.selectedPresetIndex() >= this.playlists().length) {
      this.selectPreset(0);
    } else if (this.selectedPresetIndex() > index) {
      this.selectedPresetIndex.update(i => i - 1);
    }
  }

  // ── Import MusicXML Modal ─────────────────────────────────────────────────────
  readonly showImportModal = signal(false);
  readonly importFileName  = signal('');
  readonly importStatus    = signal<'idle' | 'loading' | 'done' | 'error'>('idle');
  readonly importError     = signal('');
  readonly importResult    = signal<SequencePreset | null>(null);
  readonly importBpm       = signal(120);
  readonly importName      = signal('');
  readonly importArtist    = signal('');
  readonly importRoot      = signal('C');
  readonly importScale     = signal('major');
  readonly importTimeSig   = signal('4/4');
  readonly importStepRes   = signal<StepResolution>('16th');
  readonly importMeasuresStr = computed(() => {
    const r = this.importResult();
    if (!r) return '';
    const spm = stepsPerMeasure(this.importTimeSig(), this.importStepRes());
    const measures = (r.stepCount || 0) / spm;
    return Number.isInteger(measures) ? String(measures) : measures.toFixed(1);
  });

  openImportModal(): void {
    this.importFileName.set('');
    this.importStatus.set('idle');
    this.importError.set('');
    this.importResult.set(null);
    this.showImportModal.set(true);
  }

  cancelImport(): void {
    this.showImportModal.set(false);
  }

  async handleImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.importFileName.set(file.name);
    this.importStatus.set('loading');
    this.importError.set('');
    this.importResult.set(null);

    try {
      const buf = await file.arrayBuffer();

      // Detect ZIP magic bytes (PK\x03\x04) — MXL compressed format
      const header = new Uint8Array(buf, 0, 4);
      const isZip = header[0] === 0x50 && header[1] === 0x4B && header[2] === 0x03 && header[3] === 0x04;

      const text = isZip
        ? await extractFromMxl(buf)
        : new TextDecoder('utf-8').decode(buf);

      const preset = parseMusicXML(text);
      this.importResult.set(preset);
      this.importBpm.set(preset.bpm);
      this.importName.set(preset.name);
      this.importArtist.set(preset.artist);
      this.importRoot.set(preset.rootNote);
      this.importScale.set(preset.scale);
      this.importTimeSig.set(preset.timeSignature || '4/4');
      this.importStepRes.set((preset.stepResolution as StepResolution) || '16th');
      this.importStatus.set('done');
    } catch (err) {
      this.importStatus.set('error');
      this.importError.set(err instanceof Error ? err.message : 'Failed to parse MusicXML');
    }
  }

  confirmImport(): void {
    const preset = this.importResult();
    if (!preset) return;

    const adjusted: SequencePreset = {
      ...preset,
      name:     this.importName().trim()   || preset.name,
      artist:   this.importArtist().trim() || preset.artist,
      bpm:      this.importBpm(),
      rootNote: this.importRoot(),
      scale:    this.importScale(),
      timeSignature: this.importTimeSig(),
      stepResolution: this.importStepRes(),
    };
    const updated = [...this.userSongs(), adjusted];
    this.userSongs.set(updated);
    saveUserSongs(updated);

    const newIndex = PLAYLIST_PRESETS.length + updated.length - 1;
    this.selectedPresetIndex.set(newIndex);
    this.activeTrackIndex.set(0);
    this.audio.loadPreset(adjusted);
    this.showImportModal.set(false);
  }

  // ── New Track Modal ──────────────────────────────────────────────────────────
  readonly showNewTrackModal = signal(false);
  readonly showNoteRef       = signal(false);
  newTrackName     = 'My Track';
  newTrackSynth: SequencePreset['tracks'][0]['synthType'] = 'triangle';
  newTrackNotes    = 'C4, D4, E4, G4';
  newTrackInstrument = '';

  readonly synthDescriptions: Record<string, { emoji: string; title: string; desc: string }> = {
    triangle:   { emoji: '🔔', title: 'Warm & Flute-like',  desc: 'Soft overtones — great for pads, leads, and melodic lines.' },
    sine:       { emoji: '〰️', title: 'Pure & Smooth',      desc: 'No harmonics, just a clean tone. Perfect for deep bass or gentle ambient layers.' },
    square:     { emoji: '🎮', title: 'Retro & Buzzy',      desc: 'Hollow, hollow chiptune sound. The classic bass synth / 8-bit game character.' },
    sawtooth:   { emoji: '🎸', title: 'Bright & Aggressive',desc: 'Rich in harmonics — mimics brass, synth leads, and distorted guitar stabs.' },
    distortion: { emoji: '🎛️', title: 'High-Gain Guitar',  desc: 'Dual-oscillator distortion with waveshaper saturation, cabinet simulation, and punchy ADSR. Built for chugs and crunch.' },
  };

  readonly instrumentOptions = Object.values(INSTRUMENT_PRESETS).map(inst => ({
    value: inst.name,
    label: `${inst.label}  (${inst.oscType} + envelopes)`,
  }));
  readonly INSTRUMENT_PRESETS = INSTRUMENT_PRESETS;

  /** Musical note chips available in the reference panel — chromatic C3 to B5 */
  readonly noteChips = [
    'C3','C#3','D3','D#3','E3','F3','F#3','G3','G#3','A3','A#3','B3',
    'C4','C#4','D4','D#4','E4','F4','F#4','G4','G#4','A4','A#4','B4',
    'C5','C#5','D5','D#5','E5','F5','F#5','G5','G#5','A5','A#5','B5',
  ];

  readonly drumChips = [
    { name: 'Kick',        desc: 'Deep bass thump — the heartbeat of the beat' },
    { name: 'Snare',       desc: 'Sharp crack — sits on beats 2 & 4' },
    { name: 'Hi-Hat',      desc: 'Tight metallic click — drives the pulse' },
    { name: 'Open Hi-Hat', desc: 'Long sizzling wash — adds groove' },
    { name: 'Tom Low',     desc: 'Low floor tom — deep punch' },
    { name: 'Tom Mid',     desc: 'Mid floor tom — round body' },
    { name: 'Tom High',    desc: 'High rack tom — bright attack' },
    { name: 'Ride',        desc: 'Bright cymbal wash — pingy bell' },
    { name: 'Crash',       desc: 'Explosive accent — full cymbal crash' },
    { name: 'Clap',        desc: 'Snappy electronic clap' },
  ];

  readonly noteRangePresets: { label: string; minMidi: number; maxMidi: number }[] = [
    { label: 'Song scale (default)', minMidi: -1, maxMidi: -1 },
    { label: 'All 88 keys (A0–C8)',     minMidi: 21, maxMidi: 108 },
    { label: 'Bass (A0–E3)',            minMidi: 21, maxMidi: 52 },
    { label: 'Mid (F3–B4)',             minMidi: 53, maxMidi: 71 },
    { label: 'Treble (C5–C8)',          minMidi: 72, maxMidi: 108 },
    { label: 'Octave 1 (A0–G#1)',       minMidi: 21, maxMidi: 32 },
    { label: 'Octave 2 (A1–G#2)',       minMidi: 33, maxMidi: 44 },
    { label: 'Octave 3 (A2–G#3)',       minMidi: 45, maxMidi: 56 },
    { label: 'Octave 4 (A3–G#4)',       minMidi: 57, maxMidi: 68 },
    { label: 'Octave 5 (A4–G#5)',       minMidi: 69, maxMidi: 80 },
    { label: 'Octave 6 (A5–G#6)',       minMidi: 81, maxMidi: 92 },
    { label: 'Octave 7 (A6–G#7)',       minMidi: 93, maxMidi: 104 },
    { label: 'Octave 8 (B7–C8)',        minMidi: 105, maxMidi: 108 },
  ];

  readonly synthOptions: { label: string; value: SequencePreset['tracks'][0]['synthType'] }[] = [
    { label: 'Triangle  – warm & soft',     value: 'triangle' },
    { label: 'Sine      – pure tone',       value: 'sine' },
    { label: 'Square    – bass / retro',    value: 'square' },
    { label: 'Sawtooth  – bright / lead',   value: 'sawtooth' },
    { label: 'Distortion – chug & crunch',  value: 'distortion' },
  ];

  openNewTrackModal(): void {
    const root = this.audio.preset()?.rootNote ?? 'C';
    this.newTrackName     = 'My Track';
    this.newTrackSynth    = 'triangle';
    this.newTrackInstrument = '';
    this.showNoteRef.set(false);
    this.showNewTrackModal.set(true);
    this._updateNotesForInstrument(this.newTrackInstrument, root);
  }
  cancelNewTrack(): void { this.showNoteRef.set(false); this.showNewTrackModal.set(false); }

  onInstrumentChange(value: string): void {
    this.newTrackInstrument = value;
    const root = this.audio.preset()?.rootNote ?? 'C';
    this._updateNotesForInstrument(value, root);
  }

  private _updateNotesForInstrument(instrument: string, root: string): void {
    if (instrument === 'drums') {
      this.newTrackNotes = 'Kick, Snare, Hi-Hat, Open Hi-Hat';
    } else {
      this.newTrackNotes = defaultRowNotes(root, this.audio.preset()?.scale ?? 'pentatonic').join(', ');
    }
  }

  fillRangePreset(preset: { label: string; minMidi: number; maxMidi: number }): void {
    if (preset.minMidi === -1) {
      const root = this.audio.preset()?.rootNote ?? 'C';
      this.newTrackNotes = defaultRowNotes(root, this.audio.preset()?.scale ?? 'pentatonic').join(', ');
      return;
    }
    const notes: string[] = [];
    for (let m = preset.minMidi; m <= preset.maxMidi; m++) {
      notes.push(midiToNote(m));
    }
    this.newTrackNotes = notes.join(', ');
  }

  /** Appends a note chip to the notes input. */
  appendNote(note: string): void {
    const current = this.newTrackNotes.trim();
    const parts   = current ? current.split(',').map(n => n.trim()).filter(Boolean) : [];
    parts.push(note);
    this.newTrackNotes = parts.join(', ');
  }

  createTrack(): void {
    const name  = this.newTrackName.trim() || 'My Track';
    const notes = this.newTrackNotes.split(',').map(n => n.trim()).filter(n => n.length > 0)
      .map(n => normalizeNoteOrDrum(n));
    if (!notes.length) return;
    const inst = this.newTrackInstrument || undefined;
    this.audio.addTrack(name, inst ? (INSTRUMENT_PRESETS[inst]?.oscType as SequencePreset['tracks'][0]['synthType']) : this.newTrackSynth, notes, inst);
    const totalTracks = this.audio.preset()?.tracks.length ?? 1;
    this.activeTrackIndex.set(totalTracks - 1);
    this.showNewTrackModal.set(false);
    this._syncUserSongIfNeeded();
  }

  deleteTrack(index: number): void {
    const original = this.audio.originalTrackCount();
    this.audio.deleteTrack(index, original);
    if (this.activeTrackIndex() >= index) {
      this.activeTrackIndex.set(Math.max(0, this.activeTrackIndex() - 1));
    }
    this._syncUserSongIfNeeded();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  getEffectiveSampleSet(trackIdx: number): string | undefined {
    const override = this.audio.perTrackSampleSet()[trackIdx];
    if (override) return override;
    const track = this.audio.preset()?.tracks[trackIdx];
    if (track?.sampleSet) return track.sampleSet;
    const inst = track?.instrumentPreset ? INSTRUMENT_PRESETS[track.instrumentPreset] : undefined;
    return inst?.sampleSet;
  }

  selectPreset(index: number): void {
    this.selectedPresetIndex.set(index);
    this.activeTrackIndex.set(0);
    this.audio.loadPreset(this.playlists()[index]);
  }

  handleGridClick(event: MouseEvent, trackIdx: number, row: number, step: number): void {
    if (event.shiftKey) {
      this.audio.toggleTie(trackIdx, row, step);
    } else {
      this.audio.toggleCell(trackIdx, row, step);
      const track = this.audio.preset()?.tracks[trackIdx];
      this.audio.playNote(this.activeNotes()[row], this.activeSynthType(), this.audio.getVelocity(trackIdx, row, step), track?.instrumentPreset, trackIdx);
    }
    this._syncUserSongIfNeeded();
  }

  removeNode(id: string): void {
    this.audio.removeNode(id);
    this._syncUserSongIfNeeded();
  }

  toggleArp(trackIdx: number): void {
    const enabled = [...this.audio.arpEnabled()];
    enabled[trackIdx] = !enabled[trackIdx];
    this.audio.arpEnabled.set(enabled);
  }

  setArpPattern(trackIdx: number, pattern: string): void {
    const patterns = [...this.audio.arpPattern()];
    patterns[trackIdx] = pattern as 'up' | 'down' | 'invert' | 'random';
    this.audio.arpPattern.set(patterns);
  }

  fillChord(): void {
    const preset = this.audio.preset();
    if (!preset) return;
    const notes = getChordNotes(preset.rootNote, preset.scale, 1);
    this.newTrackNotes = notes.join(', ');
  }

  switchTrack(index: number): void { this.activeTrackIndex.set(index); }

  changeStepCount(count: number): void {
    this.audio.setStepCount(count);
    this._syncUserSongIfNeeded();
  }

  /** After a track add/delete, push the updated preset back into userSongs storage. */
  private _syncUserSongIfNeeded(): void {
    const songIndex = this.selectedPresetIndex();
    if (songIndex < PLAYLIST_PRESETS.length) return;
    const userIndex     = songIndex - PLAYLIST_PRESETS.length;
    const currentPreset = this.audio.preset();
    if (!currentPreset) return;
    const updated = this.userSongs().map((s, i) => i === userIndex ? { ...currentPreset } : s);
    this.userSongs.set(updated);
    saveUserSongs(updated);
  }

  ngOnInit(): void {
    this.audio.loadPreset(PLAYLIST_PRESETS[0]);
  }
}
