import { Injectable, inject, signal } from '@angular/core';
import { MasterMixerService } from '../master-mixer.service';
import { SAMPLE_SETS, resolveSampleUrl, getDrumSamplePath, SampleSet } from '../../data/sample-manifests';

@Injectable({ providedIn: 'root' })
export class SampleEngineService {
  private readonly mixer = inject(MasterMixerService);

  private bufferCache = new Map<string, AudioBuffer>();

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

    const [min, max] = set.noteRange;
    const total = max - min + 1;
    let done = 0;

    const promises: Promise<void>[] = [];

    for (let midi = min; midi <= max; midi++) {
      const note = midiToNote(midi);
      const url = resolveSampleUrl(set, note);
      if (!url) { done++; continue; }

      promises.push(
        this._fetchAndCache(url).then(() => {
          done++;
          this.loadProgress.set(Math.round((done / total) * 100));
        })
      );
    }

    await Promise.all(promises);

    const updated = new Set(this.loadedSets());
    updated.add(setName);
    this.loadedSets.set(updated);
    this.isLoading.set(false);
  }

  private async _fetchAndCache(url: string): Promise<void> {
    if (this.bufferCache.has(url)) return;
    const cache = await caches.open('loomin-samples-v1');
    let response = await cache.match(url);
    if (!response) {
      try {
        response = await fetch(url);
        if (!response.ok) return;
        await cache.put(url, response.clone());
      } catch {
        return;
      }
    }
    try {
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.bufferCache.set(url, audioBuffer);
    } catch {
      // silently skip decode errors
    }
  }

  private async _lazyLoadSingle(set: SampleSet, note: string): Promise<AudioBuffer | null> {
    const url = resolveSampleUrl(set, note);
    if (!url) return null;
    return this._fetchAndCacheSingle(url);
  }

  async playNote(
    note: string,
    velocity: number,
    destination: AudioNode,
    sampleSetName: string,
    time?: number,
  ): Promise<void> {
    const set = SAMPLE_SETS[sampleSetName];
    if (!set) return;

    let url = resolveSampleUrl(set, note);
    let buffer = url ? this.bufferCache.get(url) : null;
    let detuneCents = 0;

    if (!buffer) {
      // Try lazy-load the exact note first (file may exist on disk)
      if (url) {
        buffer = await this._lazyLoadSingle(set, note);
        if (buffer) {
          this._playBuffer(buffer, velocity, destination, time ?? this.ctx.currentTime, detuneCents, set.releaseSeconds);
          return;
        }
      }

      // Fallback: search cache outward for nearest loaded file
      const targetMidi = (() => { try { return noteToMidi(note); } catch { return -1; } })();
      const [min, max] = set.noteRange;

      for (let offset = 0; offset <= max - min; offset++) {
        for (const sign of (offset === 0 ? [0] : [-1, 1])) {
          const midi = targetMidi + sign * offset;
          if (midi < min || midi > max) continue;
          const candidateNote = midiToNote(midi);
          const candidateUrl = resolveSampleUrl(set, candidateNote);
          if (!candidateUrl) continue;
          const cached = this.bufferCache.get(candidateUrl);
          if (cached) {
            buffer = cached;
            detuneCents = (targetMidi - midi) * 100;
            break;
          }
        }
        if (buffer) break;
      }

      // Lazy load nearest available note as last resort
      if (!buffer) {
        const targetMidi = (() => { try { return noteToMidi(note); } catch { return -1; } })();
        const [min, max] = set.noteRange;
        if (targetMidi < 0) return;

        for (let offset = 0; offset <= max - min; offset++) {
          for (const sign of (offset === 0 ? [0] : [-1, 1])) {
            const midi = targetMidi + sign * offset;
            if (midi < min || midi > max) continue;
            const candidateNote = midiToNote(midi);
            buffer = await this._lazyLoadSingle(set, candidateNote);
            if (buffer) {
              detuneCents = (targetMidi - midi) * 100;
              break;
            }
          }
          if (buffer) break;
        }
        if (!buffer) return;
      }
    }

    this._playBuffer(buffer, velocity, destination, time ?? this.ctx.currentTime, detuneCents, set.releaseSeconds);
  }

  private _playBuffer(
    buffer: AudioBuffer,
    velocity: number,
    destination: AudioNode,
    time: number,
    detuneCents = 0,
    releaseSeconds?: number,
  ): void {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.detune.value = detuneCents;

    const gain = this.ctx.createGain();
    const clampedVel = Math.max(0, Math.min(1, velocity));
    gain.gain.setValueAtTime(clampedVel * 0.8, time);

    const stopTime = releaseSeconds != null
      ? time + Math.min(releaseSeconds, buffer.duration)
      : time + buffer.duration;

    gain.gain.setValueAtTime(clampedVel * 0.8, stopTime - 0.05);
    gain.gain.linearRampToValueAtTime(0.001, stopTime);

    source.connect(gain).connect(destination);
    source.start(time);
    source.stop(stopTime);
  }

  async playDrum(
    drumName: string,
    velocity: number,
    destination: AudioNode,
    time?: number,
  ): Promise<void> {
    const path = getDrumSamplePath(drumName);
    if (!path) return;

    let buffer = this.bufferCache.get(path) ?? null;
    if (!buffer) {
      buffer = await this._fetchAndCacheSingle(path);
      if (!buffer) return;
    }
    this._playBuffer(buffer, velocity, destination, time ?? this.ctx.currentTime);
  }

  private async _fetchAndCacheSingle(url: string): Promise<AudioBuffer | null> {
    if (this.bufferCache.has(url)) return this.bufferCache.get(url)!;
    const cache = await caches.open('loomin-samples-v1');
    let response = await cache.match(url);
    if (!response) {
      try {
        response = await fetch(url);
        if (!response.ok) return null;
        await cache.put(url, response.clone());
      } catch {
        return null;
      }
    }
    try {
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.bufferCache.set(url, audioBuffer);
      return audioBuffer;
    } catch {
      return null;
    }
  }

  isSampleSetLoaded(setName: string): boolean {
    return this.loadedSets().has(setName);
  }

  async clearCache(): Promise<void> {
    this.bufferCache.clear();
    this.loadedSets.set(new Set());
    await caches.delete('loomin-samples-v1');
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteToMidi(note: string): number {
  const m = note.match(/^([A-G]#?)(-?\d+)$/);
  if (!m) throw new Error(`Invalid note: ${note}`);
  const name = m[1];
  const octave = parseInt(m[2], 10);
  const idx = NOTE_NAMES.indexOf(name);
  if (idx === -1) throw new Error(`Invalid note name: ${name}`);
  return (octave + 1) * 12 + idx;
}

function midiToNote(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[midi % 12];
  return `${name}${octave}`;
}


