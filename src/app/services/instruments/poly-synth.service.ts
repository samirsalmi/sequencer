import { Injectable } from '@angular/core';
import { InstrumentPreset } from '../../data/playlist-presets';

@Injectable({ providedIn: 'root' })
export class PolySynthService {

  triggerNote(ctx: AudioContext, frequency: number, destination: AudioNode, type: OscillatorType = 'sine', time?: number, velocity = 1, duration?: number, previousFrequency?: number, portamentoTime?: number, instrumentPreset?: InstrumentPreset): void {
    if (ctx.state === 'suspended') ctx.resume();

    const now = time ?? ctx.currentTime;
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
    const fe = instrumentPreset?.filterEnvelope;
    const vib = instrumentPreset?.vibrato;
    const dist = instrumentPreset?.distortion;
    const hp = instrumentPreset?.highPassFilter;

    if (fe) {
      filter.frequency.setValueAtTime(fe.initialCutoff, now);
      filter.frequency.exponentialRampToValueAtTime(fe.finalCutoff, now + fe.rampDuration);
      filter.Q.value = fe.Q;
    } else if (isSaw) {
      filter.frequency.setValueAtTime(8000, now);
      filter.frequency.exponentialRampToValueAtTime(filterHz, now + 0.08);
    } else if (isTriangle) {
      filter.frequency.setValueAtTime(5500, now);
      filter.frequency.exponentialRampToValueAtTime(filterHz, now + 0.12);
    }

    let actualDur = dur;

    if (instrumentPreset) {
      const { ampAttack, ampDecay, ampSustain, ampRelease } = instrumentPreset;
      const vol = 0.3 * (1 + (v - 0.5) * instrumentPreset.velocitySensitivity);
      const attackEnd = now + ampAttack;
      const releaseStart = Math.max(attackEnd, now + dur);
      const decayEnd = Math.min(attackEnd + ampDecay, releaseStart);
      actualDur = (releaseStart - now) + ampRelease;

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol, attackEnd);
      gain.gain.linearRampToValueAtTime(vol * ampSustain, decayEnd);
      gain.gain.setValueAtTime(vol * ampSustain, releaseStart);
      gain.gain.linearRampToValueAtTime(0, releaseStart + ampRelease);
    } else if (isSaw) {
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

    let lfo: OscillatorNode | null = null;
    let lfoGain: GainNode | null = null;
    if (vib && vib.depth > 0 && vib.rate > 0) {
      lfo = ctx.createOscillator();
      lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = vib.rate;
      lfoGain.gain.value = vib.depth;
      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);
      lfoGain.connect(osc2.frequency);
      lfo.start(now);
    }

    osc1.connect(filter);
    osc2.connect(filter);

    let chain: AudioNode = filter;

    if (hp && hp.frequency > 0) {
      const hpFilter = ctx.createBiquadFilter();
      hpFilter.type = 'highpass';
      hpFilter.frequency.value = hp.frequency;
      chain.connect(hpFilter);
      chain = hpFilter;
    }

    if (dist && dist.amount > 0) {
      const shaper = ctx.createWaveShaper();
      const samples = 256;
      const curve = new Float32Array(samples);
      const k = Math.max(0.001, dist.amount * 10);
      for (let i = 0; i < samples; i++) {
        const x = (i / samples) * 2 - 1;
        curve[i] = Math.tanh(x * (1 + k)) / Math.tanh(1 + k);
      }
      shaper.curve = curve;
      if (dist.oversample) shaper.oversample = dist.oversample;
      chain.connect(shaper);
      chain = shaper;
    }

    chain.connect(gain).connect(destination);

    osc1.start(now); osc1.stop(now + actualDur);
    osc2.start(now); osc2.stop(now + actualDur);
    if (lfo) lfo.stop(now + actualDur);
  }
}
