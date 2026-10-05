import { Injectable, inject, signal } from '@angular/core';
import { MasterMixerService } from '../master-mixer.service';
import { getSampleSet, getDrumSamplePath, getDrumLayerUrls, sampleUrl, samplesByDistance } from '../../data/sample-manifests';
import { noteToMidi } from '../../utils/music-theory';
import { driveCurve } from './poly-synth.service';

const CACHE_NAME = 'loomin-samples-v1';
/** Furthest a sample is re-pitched to cover a missing note (semitones). */
const MAX_REPITCH = 7;

export interface SampleVoiceOptions {
  /** Soft-clip drive 0–1 (e.g. metal guitar). */
  drive?: number;
}

@Injectable({ providedIn: 'root' })
export class SampleEngineService {
  private readonly mixer = inject(MasterMixerService);

  private readonly bufferCache = new Map<string, AudioBuffer>();
  /** URLs that 404'd or failed to decode (e.g. Git LFS pointer files) — never refetched this session. */
  private readonly failedUrls = new Set<string>();
  private readonly inFlight = new Map<string, Promise<AudioBuffer | null>>();
  /** Round-robin position per drum, so repeated hits alternate between takes. */
  private readonly drumRoundRobin = new Map<string, number>();
  /** Last open hi-hat per output, so a closed hi-hat can choke it like a real hi-hat. */
  private readonly openHats = new Map<AudioNode, GainNode>();

  readonly isLoading = signal(false);
  readonly loadProgress = signal(0);
  readonly loadedSets = signal<Set<string>>(new Set());

  get ctx(): AudioContext {
    return this.mixer.ctx;
  }

  async preloadSampleSet(setName: string): Promise<void> {
    const set = getSampleSet(setName);
    if (!set) return;
    if (this.loadedSets().has(setName)) return;

    this.isLoading.set(true);
    this.loadProgress.set(0);

    const midis = [...set.samples.keys()];
    let done = 0;
    await Promise.all(midis.map(midi =>
      this._load(sampleUrl(set, midi)!).then(() => {
        done++;
        this.loadProgress.set(Math.round((done / midis.length) * 100));
      })
    ));

    const updated = new Set(this.loadedSets());
    updated.add(setName);
    this.loadedSets.set(updated);
    this.isLoading.set(false);
  }

  /**
   * Schedules a sampled note. Returns false (and starts loading in the background) when no usable
   * sample is decoded yet, so the caller can fall back to the synth instead of playing late or not at all.
   * `duration` is the grid note length; sustained instruments stop there, plucked ones ring out.
   */
  playNote(note: string, velocity: number, destination: AudioNode, sampleSetName: string, time?: number, duration?: number, opts: SampleVoiceOptions = {}): boolean {
    const set = getSampleSet(sampleSetName);
    if (!set) return false;
    let targetMidi: number;
    try { targetMidi = noteToMidi(note); } catch { return false; }

    for (const midi of samplesByDistance(set, targetMidi, MAX_REPITCH)) {
      const url = sampleUrl(set, midi)!;
      if (this.failedUrls.has(url)) continue;
      const buffer = this.bufferCache.get(url);
      if (!buffer) {
        this._load(url);
        continue;
      }
      const start = time ?? this.ctx.currentTime;
      const rate = Math.pow(2, (targetMidi - midi) / 12);
      const ringEnd = start + Math.min(set.releaseSeconds ?? Infinity, buffer.duration / rate);
      // Preview clicks have no duration: let them ring like a held key
      const noteEnd = duration != null ? Math.min(start + duration, ringEnd) : ringEnd;
      const voice = set.distorted ? { ...opts, drive: undefined } : opts; // already distorted by a real amp
      this._playBuffer(buffer, velocity, destination, start, noteEnd, ringEnd, set.noteOffRelease, rate, true, voice, set.attackSeconds);
      return true;
    }
    return false;
  }

  /** For click-to-preview: waits for the nearest sample to load, then plays it immediately. */
  async previewNote(note: string, velocity: number, destination: AudioNode, sampleSetName: string, opts: SampleVoiceOptions = {}): Promise<boolean> {
    if (this.playNote(note, velocity, destination, sampleSetName, undefined, undefined, opts)) return true;
    const set = getSampleSet(sampleSetName);
    if (!set) return false;
    let targetMidi: number;
    try { targetMidi = noteToMidi(note); } catch { return false; }
    await Promise.all(samplesByDistance(set, targetMidi, MAX_REPITCH).slice(0, 2).map(m => this._load(sampleUrl(set, m)!)));
    return this.playNote(note, velocity, destination, sampleSetName, undefined, undefined, opts);
  }

  /** Returns false when the drum has no sample or it is not decoded yet (caller should use the synth drum). */
  playDrum(drumName: string, velocity: number, destination: AudioNode, time?: number): boolean {
    const start = time ?? this.ctx.currentTime;
    if (drumName === 'Hi-Hat' || drumName === 'Open Hi-Hat') this._chokeOpenHat(destination, start);
    const layers = getDrumLayerUrls(drumName);
    if (layers && this._playDrumLayer(drumName, layers, velocity, destination, start)) return true;
    const url = getDrumSamplePath(drumName);
    if (!url || this.failedUrls.has(url)) return false;
    const buffer = this.bufferCache.get(url);
    if (!buffer) {
      this._load(url);
      return false;
    }
    const end = start + buffer.duration;
    const gain = this._playBuffer(buffer, velocity, destination, start, end, end, 0.02, 1, false);
    if (drumName === 'Open Hi-Hat') this.openHats.set(destination, gain);
    return true;
  }

  /**
   * Multi-velocity drum: the velocity picks the layer (soft hits sound soft, not just quieter), repeated hits
   * alternate round robins. Falls back to the nearest loaded layer; false if none is decoded yet.
   */
  private _playDrumLayer(drumName: string, layers: string[][], velocity: number, destination: AudioNode, start: number): boolean {
    const vel = Math.max(0, Math.min(1, velocity));
    const want = vel < 0.55 ? 0 : vel < 0.72 ? 1 : vel < 0.88 ? 2 : 3;
    const rr = this.drumRoundRobin.get(drumName) ?? 0;
    this.drumRoundRobin.set(drumName, rr + 1);
    const order = layers.map((_, i) => i).sort((a, b) => Math.abs(a - want) - Math.abs(b - want));
    for (const li of order) {
      const takes = layers[li];
      for (let k = 0; k < takes.length; k++) {
        const url = takes[(rr + k) % takes.length];
        const buffer = this.bufferCache.get(url);
        if (!buffer) { if (!this.failedUrls.has(url)) this._load(url); continue; }
        const end = start + buffer.duration;
        // The layer already carries most of the dynamics, so velocity only trims the level a little
        const gain = this._playBuffer(buffer, 0.6 + 0.4 * vel, destination, start, end, end, 0.02, 1, false);
        if (drumName === 'Open Hi-Hat') this.openHats.set(destination, gain);
        return true;
      }
    }
    return false;
  }

  /** A new hi-hat hit closes the hi-hat: fade out the open hat still ringing on this output. */
  private _chokeOpenHat(destination: AudioNode, at: number): void {
    const open = this.openHats.get(destination);
    if (!open) return;
    open.gain.cancelScheduledValues(at);
    open.gain.setTargetAtTime(0, at, 0.015);
    this.openHats.delete(destination);
  }

  /** Loads every drum sample so the first bar of a drum track doesn't fall back to the synth kit. */
  preloadDrums(names: string[]): Promise<unknown> {
    const urls = names.flatMap(n => [...(getDrumLayerUrls(n)?.flat() ?? []), getDrumSamplePath(n)]).filter((u): u is string => !!u);
    return Promise.all(urls.map(u => this._load(u)));
  }

  isSampleSetLoaded(setName: string): boolean {
    return this.loadedSets().has(setName);
  }

  async clearCache(): Promise<void> {
    this.bufferCache.clear();
    this.failedUrls.clear();
    this.loadedSets.set(new Set());
    await caches.delete(CACHE_NAME);
  }

  /**
   * Plays a buffer re-pitched by `rate`. Holds until `noteEnd`, then dies away over `release`
   * (never past `ringEnd`). `velocityTone` darkens soft notes like a real instrument.
   * `attack` fades the note in (capped at half its length) to round off harsh onsets.
   */
  private _playBuffer(
    buffer: AudioBuffer, velocity: number, destination: AudioNode, start: number, noteEnd: number, ringEnd: number,
    release: number, rate: number, velocityTone: boolean, opts: SampleVoiceOptions = {}, attack = 0,
  ): GainNode {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;

    const vel = Math.max(0, Math.min(1, velocity));
    const level = vel * 0.8;
    const stop = Math.min(ringEnd, noteEnd + release * 1.5);
    const gain = this.ctx.createGain();
    const fadeIn = Math.min(attack, (noteEnd - start) / 2);
    if (fadeIn > 0) {
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(level, start + fadeIn);
    } else {
      gain.gain.setValueAtTime(level, start);
    }
    if (stop > noteEnd + 0.005) {
      gain.gain.setValueAtTime(level, noteEnd);
      gain.gain.setTargetAtTime(0, noteEnd, Math.max(release, 0.01) / 4);
    } else {
      const fade = Math.min(0.03, (stop - start) / 2);
      gain.gain.setValueAtTime(level, stop - fade);
      gain.gain.linearRampToValueAtTime(0.0001, stop);
    }

    let node: AudioNode = source;
    if (velocityTone) {
      const tone = this.ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 3000 + 17000 * vel;
      tone.Q.value = 0.5;
      node = node.connect(tone);
    }
    if (opts.drive) {
      // Amp-style chain: tighten the lows before clipping, then a speaker-cabinet rolloff to tame the fizz
      const tighten = this.ctx.createBiquadFilter();
      tighten.type = 'highpass';
      tighten.frequency.value = 110;
      const pre = this.ctx.createGain();
      pre.gain.value = 1 + opts.drive * 6;
      const shaper = this.ctx.createWaveShaper();
      shaper.curve = driveCurve(opts.drive);
      shaper.oversample = '4x';
      const cab = this.ctx.createBiquadFilter();
      cab.type = 'lowpass';
      cab.frequency.value = 5000;
      cab.Q.value = 0.7;
      const post = this.ctx.createGain();
      post.gain.value = 0.35;
      node = node.connect(tighten).connect(pre).connect(shaper).connect(cab).connect(post);
    }
    node.connect(gain).connect(destination);
    source.start(start);
    source.stop(stop);
    return gain;
  }

  /** Fetch (via Cache API) and decode once; concurrent callers share the same promise. */
  private _load(url: string): Promise<AudioBuffer | null> {
    const cached = this.bufferCache.get(url);
    if (cached) return Promise.resolve(cached);
    if (this.failedUrls.has(url)) return Promise.resolve(null);
    let pending = this.inFlight.get(url);
    if (!pending) {
      pending = this._fetchAndDecode(url).then(buffer => {
        this.inFlight.delete(url);
        if (buffer) this.bufferCache.set(url, buffer);
        else this.failedUrls.add(url);
        return buffer;
      });
      this.inFlight.set(url, pending);
    }
    return pending;
  }

  private async _fetchAndDecode(url: string): Promise<AudioBuffer | null> {
    try {
      const cache = typeof caches !== 'undefined' ? await caches.open(CACHE_NAME) : null;
      let response = await cache?.match(url);
      if (!response) {
        response = await fetch(url);
        if (!response.ok) return null;
        await cache?.put(url, response.clone());
      }
      const decoded = await this.ctx.decodeAudioData(await response.arrayBuffer());
      return decoded;
    } catch {
      // Network failure, or a file that isn't audio (e.g. a Git LFS pointer) — evict so a fixed file is refetched later
      try { await (await caches.open(CACHE_NAME)).delete(url); } catch {}
      return null;
    }
  }
}
