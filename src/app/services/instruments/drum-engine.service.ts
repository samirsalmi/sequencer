import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DrumEngineService {

  triggerNote(ctx: AudioContext, noteName: string, destination: AudioNode, time?: number, velocity = 1): void {
    if (ctx.state === 'suspended') ctx.resume();

    const now = time ?? ctx.currentTime;

    switch (noteName) {
      case 'Kick':        this.playKick(now, ctx, destination, velocity);    break;
      case 'Snare':       this.playSnare(now, ctx, destination, velocity);   break;
      case 'Hi-Hat':      this.playHiHat(now, ctx, destination, velocity);   break;
      case 'Open Hi-Hat': this.playOpenHat(now, ctx, destination, velocity); break;
      case 'Clap':        this.playClap(now, ctx, destination, velocity);    break;
    }
  }

  private playKick(now: number, ctx: AudioContext, dest: AudioNode, v = 1): void {
    // Sub body — deep sine sweep, LinnDrum thump
    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = 'sine';
    body.frequency.setValueAtTime(160, now);
    body.frequency.exponentialRampToValueAtTime(38, now + 0.075);
    bodyGain.gain.setValueAtTime(1.1 * v, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    body.connect(bodyGain);

    // Sub-punch oscillator for weight
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(60, now);
    sub.frequency.exponentialRampToValueAtTime(30, now + 0.05);
    subGain.gain.setValueAtTime(0.6 * v, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    sub.connect(subGain);

    // Transient click for snap
    const clickLen = Math.ceil(ctx.sampleRate * 0.009);
    const clickBuf = ctx.createBuffer(1, clickLen, ctx.sampleRate);
    const clickData = clickBuf.getChannelData(0);
    for (let i = 0; i < clickLen; i++) clickData[i] = (Math.random() * 2 - 1) * (1 - i / clickLen);
    const click = ctx.createBufferSource();
    const clickGain = ctx.createGain();
    click.buffer = clickBuf;
    clickGain.gain.setValueAtTime(0.75 * v, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.009);
    click.connect(clickGain);

    const mix = ctx.createGain();
    bodyGain.connect(mix);
    subGain.connect(mix);
    clickGain.connect(mix);
    mix.connect(dest);

    body.start(now); body.stop(now + 0.34);
    sub.start(now);  sub.stop(now + 0.20);
    click.start(now); click.stop(now + 0.012);
  }

  private playSnare(now: number, ctx: AudioContext, dest: AudioNode, v = 1): void {
    // Body — two pitched oscillators for snap
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.value = 230;
    osc2.type = 'sine';
    osc2.frequency.value = 185;
    oscGain.gain.setValueAtTime(0.6 * v, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.10);
    osc1.connect(oscGain);
    osc2.connect(oscGain);

    // Noise — sharp crack with a high-snap EQ curve
    const snareLen = Math.ceil(ctx.sampleRate * 0.20);
    const snareBuf = ctx.createBuffer(1, snareLen, ctx.sampleRate);
    const snareData = snareBuf.getChannelData(0);
    for (let i = 0; i < snareLen; i++) {
      // Taper the tail for more crack, less wash
      snareData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / snareLen, 0.4);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = snareBuf;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1200;

    const peak = ctx.createBiquadFilter();
    peak.type = 'peaking';
    peak.frequency.value = 4500;
    peak.gain.value = 9;
    peak.Q.value = 1.2;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.72 * v, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    noise.connect(hp).connect(peak).connect(noiseGain);

    const mix = ctx.createGain();
    oscGain.connect(mix);
    noiseGain.connect(mix);
    mix.connect(dest);

    osc1.start(now); osc1.stop(now + 0.11);
    osc2.start(now); osc2.stop(now + 0.11);
    noise.start(now); noise.stop(now + 0.20);
  }

  private playHiHat(now: number, ctx: AudioContext, dest: AudioNode, v = 1): void {
    // Six detuned square oscillators — TR-909 metallic closed hat
    const freqs = [40, 63.5, 84.9, 100.7, 127.1, 159.2].map(f => f * 40);
    const mix = ctx.createGain();

    for (const freq of freqs) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      g.gain.value = 1 / freqs.length;
      osc.connect(g).connect(mix);
      osc.start(now);
      osc.stop(now + 0.055);
    }

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.32 * v, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    mix.connect(hp).connect(gain).connect(dest);
  }

  private playOpenHat(now: number, ctx: AudioContext, dest: AudioNode, v = 1): void {
    const freqs = [40, 63.5, 84.9, 100.7, 127.1, 159.2].map(f => f * 40);
    const mix = ctx.createGain();
    const dur = 0.32;

    for (const freq of freqs) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      g.gain.value = 1 / freqs.length;
      osc.connect(g).connect(mix);
      osc.start(now);
      osc.stop(now + dur);
    }

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6500;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.28 * v, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    mix.connect(hp).connect(gain).connect(dest);
  }

  private playClap(now: number, ctx: AudioContext, dest: AudioNode, v = 1): void {
    // Layered noise bursts — classic 808/LinnDrum clap
    const offsets = [0, 0.008, 0.016];

    for (const offset of offsets) {
      const t = now + offset;
      const clapLen = Math.ceil(ctx.sampleRate * 0.06);
      const clapBuf = ctx.createBuffer(1, clapLen, ctx.sampleRate);
      const clapData = clapBuf.getChannelData(0);
      for (let i = 0; i < clapLen; i++) {
        clapData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / clapLen, 0.6);
      }
      const clap = ctx.createBufferSource();
      clap.buffer = clapBuf;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800;
      bp.Q.value = 0.9;

      const peak = ctx.createBiquadFilter();
      peak.type = 'peaking';
      peak.frequency.value = 1200;
      peak.gain.value = 6;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.7 * v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

      clap.connect(bp).connect(peak).connect(g).connect(dest);
      clap.start(t);
      clap.stop(t + 0.07);
    }
  }
}
