import { Injectable, inject, signal } from '@angular/core';
import { MasterMixerService } from '../master-mixer.service';
import { SAMPLE_SETS, getDrumSamplePath, sampleUrl, samplesByDistance } from '../../data/sample-manifests';
import { noteToMidi } from '../../utils/music-theory';

const CACHE_NAME = 'loomin-samples-v1';
/** Furthest a sample is re-pitched to cover a missing note (semitones). */
const MAX_REPITCH = 7;
/** Release tail for sustained instruments after the grid note ends. */
const SUSTAIN_RELEASE = 0.25;

@Injectable({ providedIn: 'root' })
export class SampleEngineService {
  private readonly mixer = inject(MasterMixerService);

  private readonly bufferCache = new Map<string, AudioBuffer>();
  /** URLs that 404'd or failed to decode (e.g. Git LFS pointer files) — never refetched this session. */
  private readonly failedUrls = new Set<string>();
  private readonly inFlight = new Map<string, Promise<AudioBuffer | null>>();

  readonly isLoading = signal(false);
  readonly loadProgress = signal(0);
  readonly loadedSets = signal<Set<string>>(new Set());

  get ctx(): AudioContext {
    return this.mixer.ctx;
  }

  async preloadSampleSet(setName: string): Promise<void> {
    const set = SAMPLE_SETS[setName];
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
  playNote(note: string, velocity: number, destination: AudioNode, sampleSetName: string, time?: number, duration?: number): boolean {
    const set = SAMPLE_SETS[sampleSetName];
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
      let stop = start + Math.min(set.releaseSeconds ?? buffer.duration, buffer.duration);
      if (set.sustained && duration != null) stop = Math.min(stop, start + duration + SUSTAIN_RELEASE);
      this._playBuffer(buffer, velocity, destination, start, stop, (targetMidi - midi) * 100);
      return true;
    }
    return false;
  }

  /** For click-to-preview: waits for the nearest sample to load, then plays it immediately. */
  async previewNote(note: string, velocity: number, destination: AudioNode, sampleSetName: string): Promise<boolean> {
    if (this.playNote(note, velocity, destination, sampleSetName)) return true;
    const set = SAMPLE_SETS[sampleSetName];
    if (!set) return false;
    let targetMidi: number;
    try { targetMidi = noteToMidi(note); } catch { return false; }
    await Promise.all(samplesByDistance(set, targetMidi, MAX_REPITCH).slice(0, 2).map(m => this._load(sampleUrl(set, m)!)));
    return this.playNote(note, velocity, destination, sampleSetName);
  }

  /** Returns false when the drum has no sample or it is not decoded yet (caller should use the synth drum). */
  playDrum(drumName: string, velocity: number, destination: AudioNode, time?: number): boolean {
    const url = getDrumSamplePath(drumName);
    if (!url || this.failedUrls.has(url)) return false;
    const buffer = this.bufferCache.get(url);
    if (!buffer) {
      this._load(url);
      return false;
    }
    const start = time ?? this.ctx.currentTime;
    this._playBuffer(buffer, velocity, destination, start, start + buffer.duration, 0);
    return true;
  }

  /** Loads every drum sample so the first bar of a drum track doesn't fall back to the synth kit. */
  preloadDrums(names: string[]): Promise<unknown> {
    return Promise.all(names.map(getDrumSamplePath).filter((u): u is string => !!u).map(u => this._load(u)));
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

  private _playBuffer(buffer: AudioBuffer, velocity: number, destination: AudioNode, start: number, stop: number, detuneCents: number): void {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.detune.value = detuneCents;

    const gain = this.ctx.createGain();
    const level = Math.max(0, Math.min(1, velocity)) * 0.8;
    const fade = Math.min(0.05, (stop - start) / 2);
    gain.gain.setValueAtTime(level, start);
    gain.gain.setValueAtTime(level, stop - fade);
    gain.gain.linearRampToValueAtTime(0.0001, stop);

    source.connect(gain).connect(destination);
    source.start(start);
    source.stop(stop);
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
