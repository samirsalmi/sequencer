import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BassSynthService {

  triggerNote(ctx: AudioContext, frequency: number, destination: AudioNode, time?: number, velocity = 1, duration?: number, previousFrequency?: number, portamentoTime?: number): void {
    if (ctx.state === 'suspended') ctx.resume();

    const now = time ?? ctx.currentTime;
    const dur = duration ?? 0.22; // Breathe — long enough to groove, short enough to be punchy

    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    const gainA = ctx.createGain();
    const gainB = ctx.createGain();
    const masterGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const saturator = ctx.createWaveShaper();

    // Main sawtooth body
    oscA.type = 'sawtooth';
    if (previousFrequency !== undefined && portamentoTime && previousFrequency !== frequency && previousFrequency > 0) {
      oscA.frequency.setValueAtTime(previousFrequency, now);
      oscA.frequency.exponentialRampToValueAtTime(frequency, now + portamentoTime);
    } else {
      oscA.frequency.setValueAtTime(frequency, now);
    }
    gainA.gain.value = 0.65;

    // Sub-octave square for low-end weight
    oscB.type = 'square';
    if (previousFrequency !== undefined && portamentoTime && previousFrequency !== frequency && previousFrequency > 0) {
      oscB.frequency.setValueAtTime(previousFrequency / 2, now);
      oscB.frequency.exponentialRampToValueAtTime(frequency / 2, now + portamentoTime);
    } else {
      oscB.frequency.setValueAtTime(frequency / 2, now);
    }
    oscB.detune.value = -6;
    gainB.gain.value = 0.35;

    // Filter opens then closes — gives the classic "wah" bass pluck
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(380, now + 0.18);
    filter.Q.value = 3;

    // Soft clip saturation for warmth
    const samples = 256;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i / samples) * 2 - 1;
      curve[i] = (3 / 2) * x * (1 - (x * x) / 3);
    }
    saturator.curve = curve;
    saturator.oversample = '4x';

    const v = velocity;

    const attackEnd = now + 0.012;
    const decayEnd = now + 0.06;
    const releaseStart = Math.max(decayEnd, now + dur);
    const actualDur = releaseStart - now;

    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(0.5 * v, attackEnd);
    masterGain.gain.linearRampToValueAtTime(0.35 * v, decayEnd);
    masterGain.gain.setValueAtTime(0.35 * v, releaseStart);
    masterGain.gain.linearRampToValueAtTime(0, releaseStart);

    oscA.connect(gainA).connect(filter);
    oscB.connect(gainB).connect(filter);
    filter.connect(saturator).connect(masterGain).connect(destination);

    oscA.start(now); oscA.stop(now + actualDur);
    oscB.start(now); oscB.stop(now + actualDur);
  }
}
