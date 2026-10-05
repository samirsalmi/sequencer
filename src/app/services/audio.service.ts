import { Injectable, inject, signal, computed } from '@angular/core';
import { INSTRUMENT_PRESETS, PLAYLIST_PRESETS, SequencePreset, PlaybackMode, StepResolution } from '../data/playlist-presets';
import { parseTimeSignature, stepsPerMeasure, stepsPerBeat, isMeasureStart, isBeatStart, validateStepAlignment, StepResolution as UtilStepRes } from '../utils/time-signature';

// Map preset name → how many tracks it originally ships with (built-ins are protected from deletion)
const PRESET_ORIGINAL_TRACK_COUNTS: Record<string, number> = Object.fromEntries(
  PLAYLIST_PRESETS.map(p => [p.name, p.trackCount ?? p.tracks.length])
);
import { noteToMidi, midiToFrequency } from '../utils/music-theory';
import { MasterMixerService } from './master-mixer.service';
import { BassSynthService } from './instruments/bass-synth.service';
import { PolySynthService } from './instruments/poly-synth.service';
import { DistortionSynthService } from './instruments/distortion-synth.service';
import { DrumEngineService } from './instruments/drum-engine.service';
import { SampleEngineService } from './instruments/sample-engine.service';

const STORAGE_KEY = 'loomin_custom_tracks';

/**
 * Length of one grid step. Songs with `stepsPerBeat` use the real tempo (bpm = quarter notes per minute);
 * older songs use the original rule, one step = 30 / bpm seconds.
 */
export function secondsPerStep(preset: Pick<SequencePreset, 'bpm' | 'stepsPerBeat'>): number {
  return preset.stepsPerBeat ? 60 / (preset.bpm * preset.stepsPerBeat) : 30 / preset.bpm;
}
const DRUM_NAME_RE = /^(Kick|Snare|Hi-Hat|Open Hi-Hat|Tom Low|Tom Mid|Tom High|Ride|Crash|Clap)$/;

type CustomTrackStore = Record<string, SequencePreset['tracks']>;

function loadCustomStore(): CustomTrackStore {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); } catch { return {}; }
}

function saveCustomStore(store: CustomTrackStore): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch {}
}

export interface AudioNodeEntry {
  id: string;
  trackIndex: number;
  noteName: string;
  frequency: number;
  midi: number;
  timeOffset: number;
  trackName: string;
  synthType: string;
}

@Injectable({ providedIn: 'root' })
export class AudioService {
  private readonly mixer = inject(MasterMixerService);
  private readonly bassSynth = inject(BassSynthService);
  private readonly polySynth = inject(PolySynthService);
  private readonly distortionSynth = inject(DistortionSynthService);
  private readonly drumEngine = inject(DrumEngineService);
  private readonly sampleEngine = inject(SampleEngineService);

  private loopId: ReturnType<typeof setInterval> | null = null;
  private previewChannel: GainNode | null = null;
  private trackChannels: GainNode[] = [];
  private lastFreqByTrack = new Map<number, number>();

  readonly isPreloading = signal(false);
  readonly preloadProgress = computed(() => this.sampleEngine.loadProgress());
  readonly retroMode = signal(false);
  readonly perTrackPlaybackMode = signal<PlaybackMode[]>([]);
  readonly perTrackSampleSet = signal<string[]>([]);
  readonly perTrackSampleBlend = signal<number[]>([]);
  readonly stepCount = signal(16);
  readonly stepsArray = computed(() => [...Array(this.stepCount()).keys()]);

  readonly preset = signal<SequencePreset | null>(null);
  readonly grids = signal<number[][][]>([]);
  readonly ties = signal<boolean[][][]>([]);
  readonly currentBeat = signal(0);
  readonly isPlaying = signal(false);
  readonly swingPercentage = signal(0);
  readonly timeSignature = signal('4/4');
  readonly stepResolution = signal<StepResolution>('16th');

  readonly stepsPerMeasure = computed(() => {
    const ts = this.timeSignature();
    const sr = this.stepResolution() as UtilStepRes;
    return stepsPerMeasure(ts, sr);
  });

  readonly beatSteps = computed(() => {
    const sc = this.stepCount();
    const ts = this.timeSignature();
    const sr = this.stepResolution() as UtilStepRes;
    const indices: number[] = [];
    const spm = stepsPerMeasure(ts, sr);
    const spb = stepsPerBeat(ts, sr);
    for (let s = 0; s < sc; s++) {
      const mo = s % spm;
      if (mo % spb === 0) indices.push(s);
    }
    return indices;
  });

  readonly measureSteps = computed(() => {
    const sc = this.stepCount();
    const ts = this.timeSignature();
    const sr = this.stepResolution() as UtilStepRes;
    const spm = stepsPerMeasure(ts, sr);
    const indices: number[] = [];
    for (let s = 0; s < sc; s += spm) indices.push(s);
    return indices;
  });

  isMeasureStart(step: number): boolean {
    return isMeasureStart(step, this.timeSignature(), this.stepResolution() as UtilStepRes);
  }

  isBeatStart(step: number): boolean {
    return isBeatStart(step, this.timeSignature(), this.stepResolution() as UtilStepRes);
  }

  getStepAlignmentMessage(): string {
    const result = validateStepAlignment(this.stepCount(), this.timeSignature(), this.stepResolution() as UtilStepRes);
    return result.message;
  }

  // FX parameters
  readonly delayTime = signal(0.25);
  readonly delayFeedback = signal(0.3);
  readonly reverbMix = signal(0.3);

  // LFO modulation
  readonly lfoRate = signal(3);
  readonly lfoDepth = signal(0);
  readonly lfoFilterFreq = signal(20000);

  // Portamento (ms, 0 = off)
  readonly portamento = signal(0);

  // Arpeggiator per-track settings
  readonly arpEnabled = signal<boolean[]>([]);
  readonly arpPattern = signal<('up' | 'down' | 'invert' | 'random')[]>([]);

  readonly notes = computed(() => this.preset()?.tracks[0]?.rowNotes ?? []);
  readonly scale = computed(() => this.notes().map(n => midiToFrequency(noteToMidi(n))));

  /** How many tracks the currently-loaded *base* preset ships with (user tracks sit above this index). */
  readonly originalTrackCount = computed(() => {
    const p = this.preset();
    if (!p) return 0;
    return PRESET_ORIGINAL_TRACK_COUNTS[p.name] ?? 0;
  });
  readonly nodes = computed(() => {
    const p = this.preset();
    const gs = this.grids();
    if (!p || !gs.length) return [];
    const entries: AudioNodeEntry[] = [];
    for (let t = 0; t < gs.length; t++) {
      const track = p.tracks[t];
      const g = gs[t];
      if (!track || !g) continue;
      for (let row = 0; row < g.length; row++) {
        for (let step = 0; step < g[row].length; step++) {
          if ((g[row][step] ?? 0) <= 0) continue;
          const noteName = track.rowNotes[row];
          let freq = 0, midi = 0;
          try { midi = noteToMidi(noteName); freq = midiToFrequency(midi); } catch {}
          entries.push({
            id: `t${t}r${row}s${step}`,
            trackIndex: t,
            noteName,
            frequency: freq,
            midi,
            timeOffset: step,
            trackName: track.trackName,
            synthType: track.synthType,
          });
        }
      }
    }
    return entries;
  });

  loadPreset(preset: SequencePreset): void {
    this.stop();
    // Mixer channels are addressed by track index, so they must be rebuilt in lockstep with trackChannels
    this.mixer.clearChannels();
    this.trackChannels = [];

    // Merge any custom tracks saved for this preset
    const store = loadCustomStore();
    const customTracks = store[preset.name] ?? [];
    const merged: SequencePreset = {
      ...preset,
      tracks: [
        ...preset.tracks,
        ...customTracks,
      ],
    };

    const sc = merged.stepCount ?? merged.tracks[0]?.grid[0]?.length ?? 16;
    this.stepCount.set(sc);
    this.swingPercentage.set(merged.swingPercentage ?? 0);
    this.timeSignature.set(merged.timeSignature ?? '4/4');
    this.stepResolution.set(merged.stepResolution ?? '16th');
    this.preset.set(merged);
    const alignment = validateStepAlignment(sc, this.timeSignature(), this.stepResolution() as UtilStepRes);
    if (!alignment.valid) console.warn(alignment.message);
    // Normalize grids to stepCount width
    this.grids.set(merged.tracks.map(t =>
      t.grid.map(row => {
        const r = [...row];
        if (r.length < sc) return [...r, ...Array(sc - r.length).fill(0)];
        return r.slice(0, sc);
      })
    ));
    this.ties.set(merged.tracks.map(t => {
      if (t.ties && t.ties.length === t.grid.length && t.ties[0]?.length === sc) {
        return t.ties.map(row => [...row]);
      }
      return t.grid.map(() => Array(sc).fill(false));
    }));
    for (let t = 0; t < merged.tracks.length; t++) {
      this.trackChannels.push(this.mixer.createChannel(merged.tracks[t].trackName, this._defaultVolume(merged.tracks[t], t)));
      const trk = merged.tracks[t];
      if (trk.delaySend != null) this.mixer.setDelaySend(t, trk.delaySend);
      if (trk.reverbSend != null) this.mixer.setReverbSend(t, trk.reverbSend);
      if (trk.filterCutoff != null) this.mixer.setTrackFilterFreq(t, trk.filterCutoff);
      if (trk.pan != null) this.mixer.setPan(t, trk.pan);
    }
    this.arpEnabled.set(merged.tracks.map(() => false));
    this.arpPattern.set(merged.tracks.map(() => 'up' as const));
    this.perTrackPlaybackMode.set(merged.tracks.map(t => t.playbackMode ?? 'synth'));
    this.perTrackSampleSet.set(merged.tracks.map(t => {
      if (t.sampleSet) return t.sampleSet;
      const inst = t.instrumentPreset ? INSTRUMENT_PRESETS[t.instrumentPreset] : undefined;
      return inst?.sampleSet ?? '';
    }));
    this.perTrackSampleBlend.set(merged.tracks.map(t => t.sampleBlend ?? 0.5));
    if (!this.retroMode()) this._preloadActiveSampleSets().catch(() => {});
  }

  /** Adds a blank user-created track to the current preset, persisting to localStorage. */
  addTrack(trackName: string, synthType: SequencePreset['tracks'][0]['synthType'], rowNotes: string[], instrumentPreset?: string): void {
    const p = this.preset();
    if (!p) return;

    const emptyGrid = rowNotes.map(() => Array(this.stepCount()).fill(0));
    const newTrack: SequencePreset['tracks'][0] = { trackName, synthType, rowNotes, grid: emptyGrid };
    if (instrumentPreset) {
      newTrack.instrumentPreset = instrumentPreset;
      const inst = INSTRUMENT_PRESETS[instrumentPreset];
      if (inst?.sampleSet) newTrack.sampleSet = inst.sampleSet;
    }

    const updatedTracks = [...p.tracks, newTrack];
    this.preset.set({ ...p, tracks: updatedTracks });
    const gs = this.grids();
    this.grids.set([...gs, emptyGrid]);
    this.ties.set([...this.ties(), emptyGrid.map(row => [...row].fill(false))]);
    this.arpEnabled.set([...this.arpEnabled(), false]);
    this.arpPattern.set([...this.arpPattern(), 'up']);
    this.perTrackPlaybackMode.set([...this.perTrackPlaybackMode(), instrumentPreset === 'drums' ? 'sample' : 'synth']);
    this.perTrackSampleSet.set([...this.perTrackSampleSet(), '']);
    this.perTrackSampleBlend.set([...this.perTrackSampleBlend(), 0.5]);
    this.trackChannels.push(this.mixer.createChannel(trackName, 0.8));

    // Persist only user-added tracks (those beyond the original preset count)
    this._saveCustomTracks(p.name, updatedTracks);
  }

  /** Deletes a track by index if it is a user-created track (not a built-in preset track). */
  deleteTrack(trackIndex: number, originalTrackCount: number): void {
    const p = this.preset();
    if (!p || trackIndex < originalTrackCount) return; // protect built-ins

    const updatedTracks = p.tracks.filter((_, i) => i !== trackIndex);
    this.preset.set({ ...p, tracks: updatedTracks });

    const gs = this.grids();
    this.grids.set(gs.filter((_, i) => i !== trackIndex));
    this.ties.set(this.ties().filter((_, i) => i !== trackIndex));

    this.mixer.removeChannel(trackIndex);
    this.trackChannels = this.trackChannels.filter((_, i) => i !== trackIndex);
    this.arpEnabled.set(this.arpEnabled().filter((_, i) => i !== trackIndex));
    this.arpPattern.set(this.arpPattern().filter((_, i) => i !== trackIndex));
    this.perTrackPlaybackMode.set(this.perTrackPlaybackMode().filter((_, i) => i !== trackIndex));
    this.perTrackSampleSet.set(this.perTrackSampleSet().filter((_, i) => i !== trackIndex));
    this.perTrackSampleBlend.set(this.perTrackSampleBlend().filter((_, i) => i !== trackIndex));

    this._saveCustomTracks(p.name, updatedTracks);
  }

  private _orderArpNotes(
    notes: { noteName: string; freq: number; velocity: number; tieCount: number; isDrum: boolean }[],
    pattern: 'up' | 'down' | 'invert' | 'random',
  ): { noteName: string; freq: number; velocity: number; tieCount: number; isDrum: boolean }[] {
    const sorted = [...notes].sort((a, b) => a.freq - b.freq);
    switch (pattern) {
      case 'down': return sorted.reverse();
      case 'invert': {
        const result: typeof sorted = [];
        let l = 0, r = sorted.length - 1;
        while (l <= r) {
          if (l === r) result.push(sorted[l]);
          else { result.push(sorted[l]); result.push(sorted[r]); }
          l++; r--;
        }
        return result;
      }
      case 'random': {
        const copy = [...sorted];
        for (let i = copy.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
      }
      default: return sorted; // 'up'
    }
  }

  private _saveCustomTracks(presetName: string, allTracks: SequencePreset['tracks']): void {
    // User-created songs are not in PRESET_ORIGINAL_TRACK_COUNTS; app.ts syncs them separately.
    if (!(presetName in PRESET_ORIGINAL_TRACK_COUNTS)) return;
    const original = PRESET_ORIGINAL_TRACK_COUNTS[presetName];
    const store = loadCustomStore();
    const custom = allTracks.slice(original);
    if (custom.length === 0) {
      delete store[presetName];
    } else {
      store[presetName] = custom;
    }
    saveCustomStore(store);
  }

  /** Sync the preset signal with current grids/ties, then persist custom tracks. */
  private _persistAfterGridChange(): void {
    const p = this.preset();
    if (!p) return;
    const updatedTracks = p.tracks.map((t, ti) => ({
      ...t,
      grid: this.grids()[ti] ?? t.grid,
      ties: this.ties()[ti] ?? t.ties,
    }));
    this.preset.set({ ...p, tracks: updatedTracks });
    this._saveCustomTracks(p.name, updatedTracks);
  }

  togglePlay(): void {
    if (this.isPreloading()) {
      this.stop();
      return;
    }
    this.isPlaying() ? this.stop() : this.play();
  }

  getDelaySend(trackIndex: number): number {
    return this.preset()?.tracks[trackIndex]?.delaySend ?? 0;
  }

  getReverbSend(trackIndex: number): number {
    return this.preset()?.tracks[trackIndex]?.reverbSend ?? 0;
  }

  setTrackFxSend(trackIndex: number, delay: number, reverb: number): void {
    this.mixer.setDelaySend(trackIndex, delay);
    this.mixer.setReverbSend(trackIndex, reverb);
    const p = this.preset();
    if (!p) return;
    const updatedTracks = p.tracks.map((t, i) =>
      i === trackIndex ? { ...t, delaySend: delay, reverbSend: reverb } : t
    );
    this.preset.set({ ...p, tracks: updatedTracks });
    this._saveCustomTracks(p.name, updatedTracks);
  }

  /** Track fader level: the song's `volume`, else the legacy position-based default older songs were balanced with. */
  private _defaultVolume(track: SequencePreset['tracks'][0], index: number): number {
    return track.volume ?? (index === 0 ? 0.62 : index === 1 ? 0.38 : 0.8);
  }

  getVolume(trackIndex: number): number {
    const t = this.preset()?.tracks[trackIndex];
    return t ? this._defaultVolume(t, trackIndex) : 0.8;
  }

  setTrackVolume(trackIndex: number, volume: number): void {
    this.mixer.setVolume(trackIndex, volume);
    const p = this.preset();
    if (!p) return;
    const updatedTracks = p.tracks.map((t, i) => i === trackIndex ? { ...t, volume } : t);
    this.preset.set({ ...p, tracks: updatedTracks });
    this._saveCustomTracks(p.name, updatedTracks);
  }

  getPan(trackIndex: number): number {
    return this.preset()?.tracks[trackIndex]?.pan ?? 0;
  }

  setTrackPan(trackIndex: number, pan: number): void {
    this.mixer.setPan(trackIndex, pan);
    const p = this.preset();
    if (!p) return;
    const updatedTracks = p.tracks.map((t, i) => i === trackIndex ? { ...t, pan } : t);
    this.preset.set({ ...p, tracks: updatedTracks });
    this._saveCustomTracks(p.name, updatedTracks);
  }

  setDelayTime(value: number): void {
    this.delayTime.set(value);
    this.mixer.setDelayTime(value);
  }

  setDelayFeedback(value: number): void {
    this.delayFeedback.set(value);
    this.mixer.setDelayFeedback(value);
  }

  setReverbMix(value: number): void {
    this.reverbMix.set(value);
    this.mixer.setReverbMix(value);
  }

  setLfoRate(value: number): void {
    this.lfoRate.set(value);
    this.mixer.setLfoRate(value);
  }

  setLfoDepth(value: number): void {
    this.lfoDepth.set(value);
    this.mixer.setLfoDepth(value);
  }

  setLfoFilterFreq(value: number): void {
    this.lfoFilterFreq.set(value);
    this.mixer.setLfoFilterFreq(value);
  }

  /** Resize grid to a new step count. Pads with 0s or truncates. */
  setStepCount(newCount: number): void {
    const clamped = Math.max(1, newCount);
    const old = this.stepCount();
    if (clamped === old) return;

    this.stepCount.set(clamped);

    // Resize all grids
    const gs = this.grids();
    this.grids.set(gs.map(g =>
      g.map(row => {
        if (row.length < clamped) return [...row, ...Array(clamped - row.length).fill(0)];
        return row.slice(0, clamped);
      })
    ));
    this.ties.set(this.ties().map(g =>
      g.map(row => {
        if (row.length < clamped) return [...row, ...Array(clamped - row.length).fill(false)];
        return row.slice(0, clamped);
      })
    ));

    // Update preset stepCount for persistence
    const p = this.preset();
    if (p) this.preset.set({ ...p, stepCount: clamped });

    // Reset beat if it's beyond the new range
    if (this.currentBeat() >= clamped) this.currentBeat.set(0);

    // Validate alignment
    const alignment = validateStepAlignment(clamped, this.timeSignature(), this.stepResolution() as UtilStepRes);
    if (!alignment.valid) console.warn(alignment.message);
  }

  play(): void {
    this.mixer.resume();
    this.lastFreqByTrack.clear();
    const initialPreset = this.preset();
    if (!initialPreset) { this.stop(); return; }

    const startTransport = () => {
      this.isPlaying.set(true);
      this.currentBeat.set(0);
      this._runLoop(initialPreset);
    };

    if (!this.retroMode()) {
      this.isPreloading.set(true);
      this._preloadActiveSampleSets().then(() => {
        this.isPreloading.set(false);
        startTransport();
      });
    } else {
      startTransport();
    }
  }

  private _runLoop(preset: SequencePreset): void {
    const swing = () => this.swingPercentage();
    // Small offset so the first step isn't scheduled in the past
    let baseTime = this.mixer.ctx.currentTime + 0.05;
    this.loopId = setInterval(() => {
      // 100 ms lookahead survives timer jitter and background-tab throttling far better than 40 ms
      const lookAhead = this.mixer.ctx.currentTime + 0.1;
      while (baseTime < lookAhead) {
        // Read BPM every step so tempo changes apply while playing.
        const stepDuration = secondsPerStep(this.preset() ?? preset);
        const step = this.currentBeat();
        const swingOffset = (step % 2 !== 0) ? stepDuration * (swing() / 100) * 0.5 : 0;
        const gridTime = baseTime + swingOffset;
        const gs = this.grids();
        const livePreset = this.preset();
        if (!livePreset) break;
        const tieMatrix = this.ties();
        const sc = this.stepCount();
        for (let t = 0; t < livePreset.tracks.length; t++) {
          const track = livePreset.tracks[t];
          const g = gs[t];
          const channel = this.trackChannels[t];
          if (!g || !channel) continue;
          // Humanize: each track drifts a few ms off the grid per step (notes of a chord stay together)
          const human = livePreset.humanize ?? 0;
          const stepTime = gridTime + (human > 0 ? (Math.random() * 2 - 1) * 0.012 * human : 0);
          const isDrumTrack = track.rowNotes.some(n => DRUM_NAME_RE.test(n));
          const arpOn = !isDrumTrack && this.arpEnabled()?.[t];
          const prevFreq = this.lastFreqByTrack.get(t) ?? 0;
          const portSec = this.portamento() > 0 ? this.portamento() / 1000 : undefined;
          let lastFreq = 0;
          // Collect active non-tied rows for this column
          const activeRows: { noteName: string; freq: number; velocity: number; tieCount: number; isDrum: boolean }[] = [];
          for (let row = 0; row < track.rowNotes.length; row++) {
            const cellVal = g[row]?.[step] ?? 0;
            if (cellVal <= 0) continue;
            const noteName = track.rowNotes[row];
            const isDrum = DRUM_NAME_RE.test(noteName);
            if (!isDrum && step > 0 && tieMatrix[t]?.[row]?.[step]) continue;
            let tieCount = 0;
            if (!isDrum) {
              while (step + 1 + tieCount < sc && tieMatrix[t]?.[row]?.[step + 1 + tieCount]) tieCount++;
            }
            let freq = 0;
            if (!isDrum) try { freq = midiToFrequency(noteToMidi(noteName)); } catch { continue; }
            const velocity = human > 0 ? Math.min(1, cellVal * (1 + (Math.random() * 2 - 1) * 0.12 * human)) : cellVal;
            activeRows.push({ noteName, freq, velocity, tieCount, isDrum });
          }
          const effectiveSampleSet = (): string | undefined => {
            const override = this.perTrackSampleSet()[t];
            if (override) return override;
            if (track.sampleSet) return track.sampleSet;
            return INSTRUMENT_PRESETS[track.instrumentPreset ?? '']?.sampleSet;
          };

          if (this.retroMode()) {
            // ── RETRO PATH: original synth-only behavior ──
            const triggerSynth = (freq: number, time: number, vel: number, dur: number) => {
              const inst = track.instrumentPreset ? INSTRUMENT_PRESETS[track.instrumentPreset] : undefined;
              if (inst) {
                this.polySynth.triggerNote(this.mixer.ctx, freq, channel, inst.oscType, time, vel, dur, prevFreq > 0 ? prevFreq : undefined, portSec, inst);
              } else if (track.synthType === 'square') {
                this.bassSynth.triggerNote(this.mixer.ctx, freq, channel, time, vel, dur, prevFreq > 0 ? prevFreq : undefined, portSec);
              } else if (track.synthType === 'distortion') {
                this.distortionSynth.triggerNote(this.mixer.ctx, freq, channel, time, vel, dur, prevFreq > 0 ? prevFreq : undefined, portSec, track);
              } else {
                this.polySynth.triggerNote(this.mixer.ctx, freq, channel, track.synthType, time, vel, dur, prevFreq > 0 ? prevFreq : undefined, portSec);
              }
              lastFreq = freq;
            };
            if (arpOn) {
              const nonDrums = activeRows.filter(r => !r.isDrum);
              const drums = activeRows.filter(r => r.isDrum);
              for (const n of drums) this.drumEngine.triggerNote(this.mixer.ctx, n.noteName, channel, stepTime, n.velocity);
              if (nonDrums.length >= 2) {
                const pattern = this.arpPattern()?.[t] ?? 'up';
                const ordered = this._orderArpNotes(nonDrums, pattern);
                const subDur = stepDuration / ordered.length;
                for (let i = 0; i < ordered.length; i++) {
                  const n = ordered[i];
                  const noteTime = stepTime + i * subDur;
                  const noteDur = (1 + n.tieCount) * stepDuration;
                  triggerSynth(n.freq, noteTime, n.velocity, noteDur);
                }
              } else {
                for (const n of nonDrums) {
                  triggerSynth(n.freq, stepTime, n.velocity, (1 + n.tieCount) * stepDuration);
                }
              }
            } else {
              for (const n of activeRows) {
                const noteDur = (1 + n.tieCount) * stepDuration;
                if (n.isDrum) {
                  this.drumEngine.triggerNote(this.mixer.ctx, n.noteName, channel, stepTime, n.velocity);
                } else {
                  triggerSynth(n.freq, stepTime, n.velocity, noteDur);
                }
              }
            }
          } else {
            // ── HYBRID PATH: per-track playback mode dispatch ──
            const mode = this.perTrackPlaybackMode()[t] ?? 'synth';
            const sampleSetName = effectiveSampleSet();
            const blend = this.perTrackSampleBlend()[t] ?? 0.5;

            const doSynth = (n: typeof activeRows[0], time: number, dur: number, gainScale = 1) => {
              const inst = track.instrumentPreset ? INSTRUMENT_PRESETS[track.instrumentPreset] : undefined;
              const vel = n.velocity * gainScale;
              if (inst) {
                this.polySynth.triggerNote(this.mixer.ctx, n.freq, channel, inst.oscType, time, vel, dur, prevFreq > 0 ? prevFreq : undefined, portSec, inst);
              } else if (track.synthType === 'square') {
                this.bassSynth.triggerNote(this.mixer.ctx, n.freq, channel, time, vel, dur, prevFreq > 0 ? prevFreq : undefined, portSec);
              } else if (track.synthType === 'distortion') {
                this.distortionSynth.triggerNote(this.mixer.ctx, n.freq, channel, time, vel, dur, prevFreq > 0 ? prevFreq : undefined, portSec, track);
              } else {
                this.polySynth.triggerNote(this.mixer.ctx, n.freq, channel, track.synthType, time, vel, dur, prevFreq > 0 ? prevFreq : undefined, portSec);
              }
              lastFreq = n.freq;
            };

            // Plays the real sample; if it isn't available (no sample set, not loaded yet, or a broken file)
            // the synth version plays instead so the track never drops out.
            // The instrument's synth filter sweep is deliberately not applied: recorded samples already have their timbre.
            const sampleOpts = { drive: INSTRUMENT_PRESETS[track.instrumentPreset ?? '']?.distortion?.amount };
            const doSample = (n: typeof activeRows[0], time: number, dur: number, gainScale = 1) => {
              const vel = n.velocity * gainScale;
              if (n.isDrum) {
                if (!this.sampleEngine.playDrum(n.noteName, vel, channel, time)) {
                  this.drumEngine.triggerNote(this.mixer.ctx, n.noteName, channel, time, vel);
                }
              } else if (!sampleSetName || !this.sampleEngine.playNote(n.noteName, vel, channel, sampleSetName, time, dur, sampleOpts)) {
                doSynth(n, time, dur, gainScale);
              }
            };

            if (arpOn) {
              const nonDrums = activeRows.filter(r => !r.isDrum);
              const drums = activeRows.filter(r => r.isDrum);
              for (const n of drums) {
                if (mode === 'synth') {
                  this.drumEngine.triggerNote(this.mixer.ctx, n.noteName, channel, stepTime, n.velocity);
                } else {
                  doSample(n, stepTime, stepDuration);
                }
              }
              if (nonDrums.length >= 2) {
                const pattern = this.arpPattern()?.[t] ?? 'up';
                const ordered = this._orderArpNotes(nonDrums, pattern);
                const subDur = stepDuration / ordered.length;
                for (let i = 0; i < ordered.length; i++) {
                  const n = ordered[i];
                  const noteTime = stepTime + i * subDur;
                  const noteDur = (1 + n.tieCount) * stepDuration;
                  if (mode === 'synth') {
                    doSynth(n, noteTime, noteDur);
                  } else if (mode === 'sample') {
                    doSample(n, noteTime, noteDur);
                  } else {
                    doSynth(n, noteTime, noteDur, 1 - blend);
                    doSample(n, noteTime, noteDur, blend);
                  }
                }
              } else {
                for (const n of nonDrums) {
                  if (mode === 'synth') {
                    doSynth(n, stepTime, (1 + n.tieCount) * stepDuration);
                  } else if (mode === 'sample') {
                    doSample(n, stepTime, (1 + n.tieCount) * stepDuration);
                  } else {
                    doSynth(n, stepTime, (1 + n.tieCount) * stepDuration, 1 - blend);
                    doSample(n, stepTime, (1 + n.tieCount) * stepDuration, blend);
                  }
                }
              }
            } else if (mode === 'synth') {
              for (const n of activeRows) {
                const noteDur = (1 + n.tieCount) * stepDuration;
                if (n.isDrum) {
                  this.drumEngine.triggerNote(this.mixer.ctx, n.noteName, channel, stepTime, n.velocity);
                } else {
                  doSynth(n, stepTime, noteDur);
                }
              }
            } else if (mode === 'sample') {
              for (const n of activeRows) {
                doSample(n, stepTime, (1 + n.tieCount) * stepDuration);
              }
            } else {
              // mode === 'layer'
              for (const n of activeRows) {
                const noteDur = (1 + n.tieCount) * stepDuration;
                if (n.isDrum) {
                  this.drumEngine.triggerNote(this.mixer.ctx, n.noteName, channel, stepTime, n.velocity * (1 - blend));
                  doSample(n, stepTime, noteDur, blend);
                } else {
                  doSynth(n, stepTime, noteDur, 1 - blend);
                  doSample(n, stepTime, noteDur, blend);
                }
              }
            }
          }
          if (lastFreq > 0) this.lastFreqByTrack.set(t, lastFreq);
        }
        this.currentBeat.set((step + 1) % this.stepCount());
        baseTime += stepDuration;
      }
    }, 25);
  }

  stop(): void {
    if (this.loopId) { clearInterval(this.loopId); this.loopId = null; }
    this.isPlaying.set(false);
    this.isPreloading.set(false);
    this.currentBeat.set(0);
    this.lastFreqByTrack.clear();
  }

  playNote(noteName: string, synthType: string, velocity = 0.8, instrumentPreset?: string, trackIdx?: number): void {
    this.mixer.resume();
    const channel = trackIdx != null && this.trackChannels[trackIdx]
      ? this.trackChannels[trackIdx]
      : this.trackChannels[0] ?? (this.previewChannel ??= this.mixer.createChannel('preview', 0.8, false));
    const isDrum = DRUM_NAME_RE.test(noteName);

    if (trackIdx != null && !this.retroMode()) {
      const mode = this.perTrackPlaybackMode()[trackIdx] ?? 'synth';
      const sampleSetName = (() => {
        const override = this.perTrackSampleSet()[trackIdx];
        if (override) return override;
        const track = this.preset()?.tracks[trackIdx];
        if (track?.sampleSet) return track.sampleSet;
        const inst = instrumentPreset ? INSTRUMENT_PRESETS[instrumentPreset] : undefined;
        return inst?.sampleSet;
      })();
      const blend = this.perTrackSampleBlend()[trackIdx] ?? 0.5;

      if (mode === 'sample' || mode === 'layer') {
        const gain = mode === 'layer' ? blend : 1;
        if (mode === 'layer') this._previewSynth(noteName, synthType, velocity * (1 - blend), instrumentPreset, channel, isDrum);
        if (isDrum) {
          if (!this.sampleEngine.playDrum(noteName, velocity * gain, channel)) {
            this.drumEngine.triggerNote(this.mixer.ctx, noteName, channel, undefined, velocity * gain);
          }
        } else if (sampleSetName) {
          this.sampleEngine.previewNote(noteName, velocity * gain, channel, sampleSetName, { drive: INSTRUMENT_PRESETS[instrumentPreset ?? '']?.distortion?.amount }).then(played => {
            if (!played) this._previewSynth(noteName, synthType, velocity * gain, instrumentPreset, channel, false);
          });
        } else {
          this._previewSynth(noteName, synthType, velocity * gain, instrumentPreset, channel, false);
        }
        return;
      }
      // fall through to synth for 'synth' mode
    }

    this._previewSynth(noteName, synthType, velocity, instrumentPreset, channel, isDrum);
  }

  private _previewSynth(noteName: string, synthType: string, velocity: number, instrumentPreset: string | undefined, channel: GainNode, isDrum: boolean): void {
    const inst = instrumentPreset ? INSTRUMENT_PRESETS[instrumentPreset] : undefined;
    if (isDrum) {
      this.drumEngine.triggerNote(this.mixer.ctx, noteName, channel, undefined, velocity);
    } else if (inst) {
      let freq = 0;
      try { freq = midiToFrequency(noteToMidi(noteName)); } catch { return; }
      this.polySynth.triggerNote(this.mixer.ctx, freq, channel, inst.oscType, undefined, velocity, undefined, undefined, undefined, inst);
    } else if (synthType === 'square') {
      let freq = 0;
      try { freq = midiToFrequency(noteToMidi(noteName)); } catch { return; }
      this.bassSynth.triggerNote(this.mixer.ctx, freq, channel, undefined, velocity);
    } else if (synthType === 'distortion') {
      let freq = 0;
      try { freq = midiToFrequency(noteToMidi(noteName)); } catch { return; }
      this.distortionSynth.triggerNote(this.mixer.ctx, freq, channel, undefined, velocity);
    } else {
      let freq = 0;
      try { freq = midiToFrequency(noteToMidi(noteName)); } catch { return; }
      this.polySynth.triggerNote(this.mixer.ctx, freq, channel, synthType as OscillatorType, undefined, velocity);
    }
  }

  setTrackPlaybackMode(trackIdx: number, mode: PlaybackMode): void {
    const copy = [...this.perTrackPlaybackMode()];
    copy[trackIdx] = mode;
    this.perTrackPlaybackMode.set(copy);
    if (mode === 'sample' || mode === 'layer') {
      const sampleSets = this.perTrackSampleSet();
      if (!sampleSets[trackIdx]) {
        const preset = this.preset();
        const track = preset?.tracks[trackIdx];
        const effective = track?.sampleSet ?? INSTRUMENT_PRESETS[track?.instrumentPreset ?? '']?.sampleSet;
        const ssCopy = [...sampleSets];
        ssCopy[trackIdx] = effective ?? '';
        this.perTrackSampleSet.set(ssCopy);
      }
      this._preloadActiveSampleSets().catch(() => {});
    }
  }

  setTrackSampleSet(trackIdx: number, sampleSet: string): void {
    const copy = [...this.perTrackSampleSet()];
    copy[trackIdx] = sampleSet;
    this.perTrackSampleSet.set(copy);
    if (!this.retroMode()) this._preloadActiveSampleSets().catch(() => {});
  }

  setTrackSampleBlend(trackIdx: number, blend: number): void {
    const copy = [...this.perTrackSampleBlend()];
    copy[trackIdx] = Math.max(0, Math.min(1, blend));
    this.perTrackSampleBlend.set(copy);
  }

  setRetroMode(enabled: boolean): void {
    this.retroMode.set(enabled);
    if (!enabled) this._preloadActiveSampleSets().catch(() => {});
  }

  private async _preloadActiveSampleSets(): Promise<void> {
    const preset = this.preset();
    if (!preset) return;
    const sets = new Set<string>();
    for (let t = 0; t < preset.tracks.length; t++) {
      const track = preset.tracks[t];
      const override = this.perTrackSampleSet()[t];
      if (override) { sets.add(override); continue; }
      if (track.sampleSet) { sets.add(track.sampleSet); continue; }
      const instPreset = track.instrumentPreset ? INSTRUMENT_PRESETS[track.instrumentPreset] : undefined;
      if (instPreset?.sampleSet) sets.add(instPreset.sampleSet);
    }
    const promises: Promise<unknown>[] = [];
    const drumNames = new Set(preset.tracks.flatMap(t => t.rowNotes).filter(n => DRUM_NAME_RE.test(n)));
    if (drumNames.size) promises.push(this.sampleEngine.preloadDrums([...drumNames]));
    for (const setName of sets) {
      if (!this.sampleEngine.isSampleSetLoaded(setName)) {
        promises.push(this.sampleEngine.preloadSampleSet(setName));
      }
    }
    await Promise.all(promises);
  }

  getVelocity(trackIdx: number, row: number, step: number): number {
    return this.grids()?.[trackIdx]?.[row]?.[step] ?? 0;
  }

  getTie(trackIdx: number, row: number, step: number): boolean {
    return this.ties()?.[trackIdx]?.[row]?.[step] ?? false;
  }

  hasNode(trackIdx: number, row: number, step: number): boolean {
    return this.getVelocity(trackIdx, row, step) > 0;
  }

  toggleCell(trackIdx: number, row: number, step: number): void {
    const gs = this.grids();
    if (!gs.length) return;
    const copy = gs.map(g => g.map(r => [...r]));
    const current = copy[trackIdx][row][step];
    // Cycle: Off (0) → Normal (0.6) → Accent (1.0) → Off
    copy[trackIdx][row][step] = current === 0 ? 0.6 : current === 0.6 ? 1.0 : 0;
    this.grids.set(copy);
    this._persistAfterGridChange();
  }

  toggleTie(trackIdx: number, row: number, step: number): void {
    const ts = this.ties();
    if (!ts.length) return;
    const copy = ts.map(g => g.map(r => [...r]));
    // Assign tie into next step: ties[row][step+1] means this step is sustained from step
    // Tie from step → step+1: set ties[row][step+1]
    if (step + 1 < this.stepCount()) {
      copy[trackIdx][row][step + 1] = !copy[trackIdx][row][step + 1];
    }
    this.ties.set(copy);
    this._persistAfterGridChange();
  }

  removeNode(id: string): void {
    const m = id.match(/^t(\d+)r(\d+)s(\d+)$/);
    if (!m) return;
    const [_, trackIdx, row, step] = m.map(Number);
    const gs = this.grids();
    if (!gs.length) return;
    const copy = gs.map(g => g.map(r => [...r]));
    copy[trackIdx][row][step] = 0;
    this.grids.set(copy);
    this._persistAfterGridChange();
  }
}
