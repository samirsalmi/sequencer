import { Injectable, inject } from '@angular/core';
import { InstrumentPreset } from '../../data/playlist-presets';
import { PluckSynthService } from './pluck-synth.service';

const MIDDLE_C = 261.63;

@Injectable({ providedIn: 'root' })
export class PolySynthService {
  private readonly pluck = inject(PluckSynthService);
  private noiseBuffer: AudioBuffer | null = null;

  triggerNote(ctx: AudioContext, frequency: number, destination: AudioNode, type: OscillatorType = 'sine', time?: number, velocity = 1, duration?: number, previousFrequency?: number, portamentoTime?: number, instrumentPreset?: InstrumentPreset): void {
    if (ctx.state === 'suspended') ctx.resume();

    const now = time ?? ctx.currentTime;
    if (instrumentPreset) {
      this._playPatch(ctx, frequency, destination, now, velocity, duration ?? 0.5, previousFrequency, portamentoTime, instrumentPreset);
      return;
    }
    const isSaw = type === 'sawtooth';
    const isTriangle = type === 'triangle';

    const defaultDur = isSaw ? 0.22 : isTriangle ? 0.75 : 1.1;
    const dur = duration ?? defaultDur;
    const detune   = isSaw ? 16  : isTriangle ? 5    : 8;
    const filterHz = isSaw ? 5200 : isTriangle ? 3200 : 3500;
    const filterQ  = isSaw ? 2.2  : isTriangle ? 4.5  : 0.8;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc1.type = type;
    const rampFreq = (prev: number | undefined, target: number, osc: OscillatorNode) => {
      if (prev !== undefined && portamentoTime && prev !== target && prev > 0) {
        osc.frequency.setValueAtTime(prev, now);
        osc.frequency.exponentialRampToValueAtTime(target, now + portamentoTime);
      } else {
        osc.frequency.setValueAtTime(target, now);
      }
    };
    rampFreq(previousFrequency, frequency, osc1);
    osc2.type = type;
    rampFreq(previousFrequency, frequency, osc2);
    osc2.detune.value = detune;

    filter.type = 'lowpass';
    filter.frequency.value = filterHz;
    filter.Q.value = filterQ;

    const v = velocity;

    if (isSaw) {
      filter.frequency.setValueAtTime(8000, now);
      filter.frequency.exponentialRampToValueAtTime(filterHz, now + 0.08);
    } else if (isTriangle) {
      filter.frequency.setValueAtTime(5500, now);
      filter.frequency.exponentialRampToValueAtTime(filterHz, now + 0.12);
    }

    let actualDur = dur;

    if (isSaw) {
      const attackEnd = now + 0.006;
      const decayEnd = now + 0.05;
      const releaseStart = Math.max(decayEnd, now + dur);
      actualDur = releaseStart - now;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.32 * v, attackEnd);
      gain.gain.linearRampToValueAtTime(0.18 * v, decayEnd);
      gain.gain.setValueAtTime(0.18 * v, releaseStart);
      gain.gain.linearRampToValueAtTime(0, releaseStart);
    } else if (isTriangle) {
      const attackEnd = now + 0.008;
      const decayEnd = now + 0.06;
      const releaseStart = Math.max(decayEnd, now + dur);
      const actualRelease = 0.30;
      actualDur = (releaseStart - now) + actualRelease;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.28 * v, attackEnd);
      gain.gain.linearRampToValueAtTime(0.16 * v, decayEnd);
      gain.gain.setValueAtTime(0.16 * v, releaseStart);
      gain.gain.linearRampToValueAtTime(0, releaseStart + actualRelease);
    } else {
      const attackEnd = now + 0.12;
      const releaseStart = Math.max(attackEnd, now + dur);
      const actualRelease = 0.25;
      actualDur = (releaseStart - now) + actualRelease;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.22 * v, attackEnd);
      gain.gain.setValueAtTime(0.22 * v, releaseStart);
      gain.gain.linearRampToValueAtTime(0, releaseStart + actualRelease);
    }

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain).connect(destination);

    osc1.start(now); osc1.stop(now + actualDur);
    osc2.start(now); osc2.stop(now + actualDur);
  }

  /**
   * Instrument voice: two oscillators (+ optional breath noise) → key-tracked, velocity-sensitive
   * lowpass with envelope → exponential ADSR, with delayed vibrato. Plucked presets use Karplus–Strong.
   */
  private _playPatch(
    ctx: AudioContext, frequency: number, destination: AudioNode, now: number, velocity: number, dur: number,
    previousFrequency: number | undefined, portamentoTime: number | undefined, inst: InstrumentPreset,
  ): void {
    const vel = Math.max(0, Math.min(1, velocity));
    const sens = inst.velocitySensitivity;
    const level = 0.28 * (1 - sens + sens * vel);

    if (inst.engine === 'pluck' && inst.pluck) {
      this.pluck.triggerNote(ctx, frequency, destination, inst.pluck, now, level * 1.3, dur, inst.ampRelease);
      return;
    }

    const glide = (osc: OscillatorNode, target: number) => {
      if (previousFrequency && portamentoTime && previousFrequency !== frequency) {
        osc.frequency.setValueAtTime(previousFrequency * (target / frequency), now);
        osc.frequency.exponentialRampToValueAtTime(target, now + portamentoTime);
      } else {
        osc.frequency.setValueAtTime(target, now);
      }
    };

    const osc1 = ctx.createOscillator();
    osc1.type = inst.oscType;
    glide(osc1, frequency);
    const osc2 = ctx.createOscillator();
    osc2.type = inst.osc2Type ?? inst.oscType;
    glide(osc2, frequency * Math.pow(2, inst.osc2Octave ?? 0));
    osc2.detune.value = inst.detune ?? 6;
    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = inst.osc2Level ?? 0.7;

    // Filter: follows pitch (keyTracking) and opens with velocity, so high/soft notes aren't dull/harsh
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const keyRatio = Math.pow(frequency / MIDDLE_C, inst.keyTracking ?? 0.5);
    const velBright = 1 - sens * 0.45 + sens * 0.45 * vel;
    const cut = (hz: number) => Math.max(60, Math.min(18000, hz * keyRatio * velBright));
    const fe = inst.filterEnvelope;
    if (fe) {
      filter.Q.value = fe.Q;
      filter.frequency.setValueAtTime(cut(fe.initialCutoff), now);
      filter.frequency.exponentialRampToValueAtTime(cut(fe.finalCutoff), now + Math.max(fe.rampDuration, 0.005));
    } else {
      filter.frequency.value = cut(6000);
    }

    osc1.connect(filter);
    osc2.connect(osc2Gain).connect(filter);

    // Exponential ADSR (sounds natural, unlike linear decays)
    const attackEnd = now + Math.max(inst.ampAttack, 0.001);
    const releaseStart = Math.max(attackEnd, now + dur);
    const sustainLevel = level * inst.ampSustain;
    const tau = Math.max(inst.ampDecay, 0.01) / 4;
    const levelAt = (t: number) => sustainLevel + (level - sustainLevel) * Math.exp(-(t - attackEnd) / tau);
    const release = Math.max(inst.ampRelease, 0.01);
    const end = releaseStart + release * 1.5 + 0.02;

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, now);
    amp.gain.linearRampToValueAtTime(level, attackEnd);
    amp.gain.setTargetAtTime(sustainLevel, attackEnd, tau);
    amp.gain.setValueAtTime(levelAt(releaseStart), releaseStart);
    amp.gain.setTargetAtTime(0, releaseStart, release / 4);

    const sources: AudioScheduledSourceNode[] = [osc1, osc2];

    // Breath / bow noise: band-passed around the note, strongest during the attack
    if (inst.noise) {
      const noise = ctx.createBufferSource();
      noise.buffer = this._noise(ctx);
      noise.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = Math.min(12000, frequency * 3);
      bp.Q.value = 0.8;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0, now);
      ng.gain.linearRampToValueAtTime(inst.noise, attackEnd);
      ng.gain.setTargetAtTime(inst.noise * 0.35, attackEnd, 0.08);
      noise.connect(bp).connect(ng).connect(filter);
      sources.push(noise);
    }

    // Vibrato in cents, fading in after the attack
    const vib = inst.vibrato;
    if (vib && vib.depth > 0 && vib.rate > 0) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = vib.rate;
      const depth = ctx.createGain();
      const onset = now + (vib.delay ?? 0.2);
      depth.gain.setValueAtTime(0, now);
      depth.gain.setValueAtTime(0, onset);
      depth.gain.linearRampToValueAtTime(vib.depth, onset + 0.25);
      lfo.connect(depth);
      depth.connect(osc1.detune);
      depth.connect(osc2.detune);
      sources.push(lfo);
    }

    let chain: AudioNode = filter;
    if (inst.highPassFilter && inst.highPassFilter.frequency > 0) {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = inst.highPassFilter.frequency;
      chain.connect(hp);
      chain = hp;
    }
    if (inst.distortion && inst.distortion.amount > 0) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = driveCurve(inst.distortion.amount);
      shaper.oversample = inst.distortion.oversample ?? '4x';
      const pre = ctx.createGain();
      pre.gain.value = 3;
      chain.connect(pre).connect(shaper);
      chain = shaper;
    }
    chain.connect(amp).connect(destination);

    for (const src of sources) { src.start(now); src.stop(end); }
  }

  private _noise(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) return this.noiseBuffer;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
    return buf;
  }
}

/** Soft-clipping curve shared by synth and sample voices. amount 0–1. */
export function driveCurve(amount: number): Float32Array<ArrayBuffer> {
  const samples = 1024;
  const curve = new Float32Array(samples);
  const k = Math.max(0.001, amount * 10);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * (1 + k)) / Math.tanh(1 + k);
  }
  return curve;
}
