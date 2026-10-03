import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DrumEngineService {

  triggerNote(ctx: AudioContext, noteName: string, destination: AudioNode, time?: number, velocity = 1): void {
    if (ctx.state === 'suspended') ctx.resume();

    const now = time ?? ctx.currentTime;
    // Kit bus: brings the synth kit to the same level as the sample kit and the instruments
    const bus = ctx.createGain();
    bus.gain.value = 0.55;
    bus.connect(destination);
    destination = bus;

    switch (noteName) {
      case 'Kick':        this.playKick(now, ctx, destination, velocity);    break;
      case 'Snare':       this.playSnare(now, ctx, destination, velocity);   break;
      case 'Hi-Hat':      this.playHiHat(now, ctx, destination, velocity);   break;
      case 'Open Hi-Hat': this.playOpenHat(now, ctx, destination, velocity); break;
      case 'Clap':        this.playClap(now, ctx, destination, velocity);    break;
      case 'Tom Low':     this.playTom(now, ctx, destination, velocity, 90);  break;
      case 'Tom Mid':     this.playTom(now, ctx, destination, velocity, 130); break;
      case 'Tom High':    this.playTom(now, ctx, destination, velocity, 180); break;
      case 'Ride':        this.playCymbal(now, ctx, destination, velocity, 1.4, 5200, 0.35, true); break;
      case 'Crash':       this.playCymbal(now, ctx, destination, velocity, 1.9, 3800, 0.45, false); break;
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
    gain.gain.setValueAtTime(0.6 * v, now);
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
    gain.gain.setValueAtTime(0.5 * v, now);
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

  private playTom(now: number, ctx: AudioContext, dest: AudioNode, v: number, pitch: number): void {
    // Pitched membrane: sine dropping from ~1.6x to the tuned pitch, plus a short stick click
    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = 'sine';
    body.frequency.setValueAtTime(pitch * 1.6, now);
    body.frequency.exponentialRampToValueAtTime(pitch, now + 0.06);
    const decay = 0.35 + (180 - pitch) / 300;
    bodyGain.gain.setValueAtTime(0.9 * v, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + decay);
    body.connect(bodyGain).connect(dest);

    const clickLen = Math.ceil(ctx.sampleRate * 0.012);
    const clickBuf = ctx.createBuffer(1, clickLen, ctx.sampleRate);
    const data = clickBuf.getChannelData(0);
    for (let i = 0; i < clickLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / clickLen);
    const click = ctx.createBufferSource();
    click.buffer = clickBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = pitch * 8;
    const clickGain = ctx.createGain();
    clickGain.gain.value = 0.35 * v;
    click.connect(bp).connect(clickGain).connect(dest);

    body.start(now); body.stop(now + decay + 0.02);
    click.start(now); click.stop(now + 0.015);
  }

  private playCymbal(now: number, ctx: AudioContext, dest: AudioNode, v: number, dur: number, hpHz: number, level: number, bell: boolean): void {
    // Metallic partials (inharmonic squares) + noise wash through a highpass
    const mix = ctx.createGain();
    const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21];
    for (const r of ratios) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 340 * r * (bell ? 1.25 : 1);
      const g = ctx.createGain();
      g.gain.value = 0.5 / ratios.length;
      osc.connect(g).connect(mix);
      osc.start(now);
      osc.stop(now + dur);
    }
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const ng = ctx.createGain();
    ng.gain.value = bell ? 0.4 : 0.8;
    noise.connect(ng).connect(mix);

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = hpHz;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, now);
    out.gain.linearRampToValueAtTime(level * v, now + 0.003);
    out.gain.exponentialRampToValueAtTime(0.001, now + dur);
    mix.connect(hp).connect(out).connect(dest);
    noise.start(now); noise.stop(now + dur);

    if (bell) {
      // Ride "ping": a clear bell partial on top
      const ping = ctx.createOscillator();
      ping.frequency.value = 3150;
      const pg = ctx.createGain();
      pg.gain.setValueAtTime(0.06 * v, now);
      pg.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      ping.connect(pg).connect(dest);
      ping.start(now); ping.stop(now + 0.62);
    }
  }
}
