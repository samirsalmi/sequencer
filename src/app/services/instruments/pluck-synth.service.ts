import { Injectable } from '@angular/core';

export interface PluckParams {
  /** 0–1: how bright the pick attack is (lowpass on the excitation burst). */
  brightness: number;
  /** Seconds for the string to decay by 60 dB. */
  decay: number;
}

/**
 * Karplus–Strong plucked string. Each note is rendered once into an AudioBuffer
 * (noise burst → feedback delay line with an averaging filter) and cached, so
 * playback is just a buffer source: cheap, and it sounds like a real string.
 */
@Injectable({ providedIn: 'root' })
export class PluckSynthService {
  private readonly cache = new Map<string, AudioBuffer>();

  triggerNote(
    ctx: AudioContext,
    frequency: number,
    destination: AudioNode,
    params: PluckParams,
    time: number,
    level: number,
    duration: number,
    release: number,
  ): void {
    const { buffer, rate } = this._render(ctx, frequency, params);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;

    const gain = ctx.createGain();
    const ringEnd = time + buffer.duration / rate;
    const noteEnd = Math.min(time + Math.max(duration, 0.02), ringEnd);
    gain.gain.setValueAtTime(level, time);
    // Damp the string when the note ends (like lifting the fretting finger)
    gain.gain.setValueAtTime(level, noteEnd);
    gain.gain.setTargetAtTime(0, noteEnd, Math.max(release, 0.01) / 4);

    source.connect(gain).connect(destination);
    source.start(time);
    source.stop(Math.min(ringEnd, noteEnd + release * 1.5 + 0.02));
  }

  private _render(ctx: AudioContext, frequency: number, p: PluckParams): { buffer: AudioBuffer; rate: number } {
    const sr = ctx.sampleRate;
    const exactPeriod = sr / frequency;
    const period = Math.max(2, Math.round(exactPeriod));
    // Integer delay lengths detune high notes; correct the pitch with the playback rate
    const rate = period / exactPeriod;
    const key = `${period}|${p.brightness}|${p.decay}`;
    const cached = this.cache.get(key);
    if (cached) return { buffer: cached, rate };

    const seconds = Math.min(Math.max(p.decay * 1.1, 0.3), 4);
    const length = Math.ceil(seconds * sr);
    const buffer = ctx.createBuffer(1, length, sr);
    const out = buffer.getChannelData(0);

    // Loss per round trip so the string falls 60 dB in `decay` seconds
    const loopGain = Math.pow(0.001, 1 / (p.decay * (sr / period)));

    // Excitation: a period of noise, lowpassed for softer picks
    const delay = new Float32Array(period);
    const smooth = 0.05 + 0.9 * (1 - Math.min(1, Math.max(0, p.brightness)));
    let lp = 0;
    for (let i = 0; i < period; i++) {
      const noise = Math.random() * 2 - 1;
      lp = lp + (1 - smooth) * (noise - lp);
      delay[i] = lp;
    }
    // Remove DC so the string doesn't thump
    const mean = delay.reduce((a, b) => a + b, 0) / period;
    for (let i = 0; i < period; i++) delay[i] -= mean;

    let idx = 0;
    let prev = delay[period - 1];
    let peak = 0;
    for (let n = 0; n < length; n++) {
      const cur = delay[idx];
      const next = loopGain * 0.5 * (cur + prev);
      prev = cur;
      delay[idx] = next;
      out[n] = cur;
      const a = Math.abs(cur);
      if (a > peak) peak = a;
      idx = idx + 1 === period ? 0 : idx + 1;
    }
    if (peak > 0) for (let n = 0; n < length; n++) out[n] /= peak;

    // Short fade-out so the buffer end never clicks
    const fade = Math.min(length, Math.floor(sr * 0.02));
    for (let i = 0; i < fade; i++) out[length - 1 - i] *= i / fade;

    this.cache.set(key, buffer);
    return { buffer, rate };
  }
}
