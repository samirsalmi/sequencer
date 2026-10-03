import { Injectable } from '@angular/core';

export interface DistortionParams {
  distortion?: number;
  drive?: number;
  filterCutoff?: number;
  filterResonance?: number;
  detune?: number;
  envelope?: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
}

const DEFAULTS: Required<DistortionParams> = {
  distortion: 0.7,
  drive: 0.6,
  filterCutoff: 3500,
  filterResonance: 1,
  detune: 10,
  envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.1 },
};

@Injectable({ providedIn: 'root' })
export class DistortionSynthService {

  triggerNote(
    ctx: AudioContext,
    frequency: number,
    destination: AudioNode,
    time?: number,
    velocity = 1,
    duration?: number,
    previousFrequency?: number,
    portamentoTime?: number,
    params?: DistortionParams,
  ): void {
    if (ctx.state === 'suspended') ctx.resume();

    const now = time ?? ctx.currentTime;
    const dur = duration ?? 0.28;

    const p = { ...DEFAULTS, ...params };
    const { distortion, drive, filterCutoff, filterResonance, detune } = p;
    const env = { ...DEFAULTS.envelope, ...p.envelope };

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const saturator = ctx.createWaveShaper();
    const masterGain = ctx.createGain();
    const noiseGate = ctx.createGain();

    // Dual oscillators: main sawtooth + detuned/square blend
    osc1.type = 'sawtooth';
    const rampFreq = (prev: number | undefined, target: number, osc: OscillatorNode) => {
      if (prev !== undefined && portamentoTime && prev !== target && prev > 0) {
        osc.frequency.setValueAtTime(prev, now);
        osc.frequency.exponentialRampToValueAtTime(target, now + portamentoTime);
      } else {
        osc.frequency.setValueAtTime(target, now);
      }
    };
    rampFreq(previousFrequency, frequency, osc1);
    gain1.gain.value = 0.55;

    osc2.type = 'sawtooth';
    rampFreq(previousFrequency, frequency, osc2);
    osc2.detune.value = detune;
    gain2.gain.value = 0.45;

    // Lowpass filter — cabinet simulation with envelope tracking
    filter.type = 'lowpass';
    filter.Q.value = filterResonance;
    const driveGain = ctx.createGain();
    driveGain.gain.value = 1 + drive * 0.5;

    const samples = 256;
    const curve = new Float32Array(samples);
    const asymmetry = 0.3 + distortion * 0.4;
    for (let i = 0; i < samples; i++) {
      const x = (i / samples) * 2 - 1;
      if (x >= 0) {
        curve[i] = x / (1 + x * distortion * 1.8);
      } else {
        curve[i] = x / (1 - x * distortion * (2.2 + asymmetry));
      }
    }
    saturator.curve = curve;
    saturator.oversample = '4x';

    // ADSR envelope
    const v = velocity;
    const a = env.attack;
    const d = env.decay;
    const s = env.sustain;
    const r = env.release;

    // Filter envelope — briefly opens on attack for percussive bite, then settles
    const peakingFreq = Math.min(filterCutoff * 4, 18000);
    filter.frequency.setValueAtTime(peakingFreq, now);
    filter.frequency.linearRampToValueAtTime(filterCutoff, now + a + d);

    const susStart = Math.min(now + a + d, now + dur - r);
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(1.0 * v, now + a);
    masterGain.gain.linearRampToValueAtTime(s * v, susStart);
    masterGain.gain.setValueAtTime(s * v, now + dur - r);
    masterGain.gain.linearRampToValueAtTime(0, now + dur);

    // Noise gate — cleanly chops between palm-muted notes
    noiseGate.gain.setValueAtTime(0, now);
    noiseGate.gain.linearRampToValueAtTime(1, now + 0.001);
    noiseGate.gain.setValueAtTime(1, now + dur - 0.003);
    noiseGate.gain.linearRampToValueAtTime(0, now + dur);

    osc1.connect(gain1).connect(driveGain);
    osc2.connect(gain2).connect(driveGain);
    driveGain.connect(saturator);
    saturator.connect(filter);
    filter.connect(masterGain).connect(noiseGate).connect(destination);

    osc1.start(now); osc1.stop(now + dur);
    osc2.start(now); osc2.stop(now + dur);
  }
}
