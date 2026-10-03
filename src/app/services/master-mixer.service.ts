import { Injectable } from '@angular/core';

export interface MasterChannel {
  fader: GainNode;
  panner: StereoPannerNode;
  label: string;
  delaySend: GainNode;
  reverbSend: GainNode;
  trackFilter: BiquadFilterNode;
}

@Injectable({ providedIn: 'root' })
export class MasterMixerService {
  readonly ctx = new AudioContext();

  private readonly masterFilter: BiquadFilterNode;
  private readonly lfoFilter: BiquadFilterNode;
  private readonly compressor: DynamicsCompressorNode;
  private readonly masterGain: GainNode;
  private readonly limiter: DynamicsCompressorNode;

  // FX Bus
  private readonly fxReturn: GainNode;
  private readonly delayInput: GainNode;
  private readonly delayNode: DelayNode;
  private readonly delayFeedback: GainNode;
  private readonly delayTone: BiquadFilterNode;
  private readonly reverbInput: GainNode;
  private readonly reverbConvolver: ConvolverNode;

  // LFO modulation
  private readonly lfoOsc: OscillatorNode;
  private readonly lfoGain: GainNode;

  readonly channels: MasterChannel[] = [];

  constructor() {
    // Master chain
    this.masterFilter = this.ctx.createBiquadFilter();
    this.masterFilter.type = 'lowpass';
    this.masterFilter.frequency.value = 16000;

    // LFO-modulated filter insert
    this.lfoFilter = this.ctx.createBiquadFilter();
    this.lfoFilter.type = 'lowpass';
    this.lfoFilter.frequency.value = 20000;
    this.lfoFilter.Q.value = 1;

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 10;
    this.compressor.ratio.value = 3.5;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.15;

    // LFO oscillator → gain → lfoFilter.frequency
    this.lfoOsc = this.ctx.createOscillator();
    this.lfoOsc.type = 'sine';
    this.lfoOsc.frequency.value = 3;
    this.lfoGain = this.ctx.createGain();
    this.lfoGain.gain.value = 0;

    this.lfoOsc.connect(this.lfoGain);
    this.lfoGain.connect(this.lfoFilter.frequency);
    this.lfoOsc.start();

    // FX Return → Master Filter → LFO Filter → Compressor → Destination
    this.fxReturn = this.ctx.createGain();
    this.fxReturn.gain.value = 0.5;

    // Stereo Delay: input → delay → feedback loop → fxReturn
    this.delayInput = this.ctx.createGain();
    this.delayNode = this.ctx.createDelay(1.0);
    this.delayNode.delayTime.value = 0.25;
    this.delayFeedback = this.ctx.createGain();
    this.delayFeedback.gain.value = 0.3;

    // Lowpass inside the feedback loop: each repeat gets darker, like tape / analog delays
    this.delayTone = this.ctx.createBiquadFilter();
    this.delayTone.type = 'lowpass';
    this.delayTone.frequency.value = 4500;

    this.delayInput.connect(this.delayNode);
    this.delayNode.connect(this.delayTone);
    this.delayTone.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    this.delayNode.connect(this.fxReturn);

    // Reverb: input → convolver (synthetic IR) → fxReturn
    this.reverbInput = this.ctx.createGain();
    this.reverbConvolver = this.ctx.createConvolver();
    this.reverbConvolver.buffer = this._generateReverbIR(2.6);
    // Keep low end out of the reverb so it doesn't muddy bass and piano left hands
    const reverbHp = this.ctx.createBiquadFilter();
    reverbHp.type = 'highpass';
    reverbHp.frequency.value = 180;

    this.reverbInput.connect(reverbHp).connect(this.reverbConvolver);
    this.reverbConvolver.connect(this.fxReturn);

    // Tie FX return into master chain
    this.fxReturn.connect(this.masterFilter);
    this.masterFilter.connect(this.lfoFilter);
    // Glue compressor → headroom → brickwall-style limiter so stacked voices never clip
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8;
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -2;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.1;
    this.lfoFilter.connect(this.compressor);
    this.compressor.connect(this.masterGain).connect(this.limiter).connect(this.ctx.destination);
  }

  setLfoRate(value: number): void {
    this.lfoOsc.frequency.setValueAtTime(value, this.ctx.currentTime);
  }

  setLfoDepth(value: number): void {
    this.lfoGain.gain.setValueAtTime(value, this.ctx.currentTime);
  }

  setLfoFilterFreq(value: number): void {
    this.lfoFilter.frequency.setValueAtTime(value, this.ctx.currentTime);
  }

  /** `register: false` creates a channel outside the track-indexed list (e.g. for note previews). */
  createChannel(label: string, gain = 0.8, register = true): GainNode {
    const fader = this.ctx.createGain();
    fader.gain.value = gain;

    const trackFilter = this.ctx.createBiquadFilter();
    trackFilter.type = 'lowpass';
    trackFilter.frequency.value = 20000;
    trackFilter.Q.value = 0;

    const panner = this.ctx.createStereoPanner();

    fader.connect(trackFilter);
    trackFilter.connect(panner);
    panner.connect(this.masterFilter);

    // Sends are post-pan so a track's echoes and reverb sit on its side of the stereo field
    const delaySend = this.ctx.createGain();
    delaySend.gain.value = 0;
    panner.connect(delaySend);
    delaySend.connect(this.delayInput);

    const reverbSend = this.ctx.createGain();
    reverbSend.gain.value = 0;
    panner.connect(reverbSend);
    reverbSend.connect(this.reverbInput);

    if (register) this.channels.push({ fader, panner, label, delaySend, reverbSend, trackFilter });
    return fader;
  }

  /** Disconnects and removes one channel; later channels shift down so indexes keep matching track indexes. */
  removeChannel(trackIndex: number): void {
    const ch = this.channels[trackIndex];
    if (!ch) return;
    this._disconnect(ch);
    this.channels.splice(trackIndex, 1);
  }

  /** Disconnects and removes every channel (used when a new song is loaded). */
  clearChannels(): void {
    this.channels.forEach(ch => this._disconnect(ch));
    this.channels.length = 0;
  }

  private _disconnect(ch: MasterChannel): void {
    ch.fader.disconnect();
    ch.trackFilter.disconnect();
    ch.panner.disconnect();
    ch.delaySend.disconnect();
    ch.reverbSend.disconnect();
  }

  setTrackFilterFreq(trackIndex: number, freq: number): void {
    const ch = this.channels[trackIndex];
    if (ch) ch.trackFilter.frequency.setValueAtTime(freq, this.ctx.currentTime);
  }

  setPan(trackIndex: number, value: number): void {
    const ch = this.channels[trackIndex];
    if (ch) ch.panner.pan.setValueAtTime(Math.max(-1, Math.min(1, value)), this.ctx.currentTime);
  }

  setDelaySend(trackIndex: number, value: number): void {
    const ch = this.channels[trackIndex];
    if (ch) ch.delaySend.gain.setValueAtTime(value, this.ctx.currentTime);
  }

  setReverbSend(trackIndex: number, value: number): void {
    const ch = this.channels[trackIndex];
    if (ch) ch.reverbSend.gain.setValueAtTime(value, this.ctx.currentTime);
  }

  setDelayTime(value: number): void {
    this.delayNode.delayTime.setValueAtTime(value, this.ctx.currentTime);
  }

  setDelayFeedback(value: number): void {
    this.delayFeedback.gain.setValueAtTime(value, this.ctx.currentTime);
  }

  setReverbMix(value: number): void {
    this.fxReturn.gain.setValueAtTime(value, this.ctx.currentTime);
  }

  /**
   * Synthetic hall impulse response: stereo-decorrelated noise with a short pre-delay, sparse early
   * reflections and an exponential tail whose high frequencies die faster (air absorption).
   */
  private _generateReverbIR(duration: number): AudioBuffer {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * duration);
    const preDelay = Math.floor(sr * 0.018);
    const buffer = this.ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let lp = 0;
      for (let i = preDelay; i < len; i++) {
        const t = (i - preDelay) / sr;
        const env = Math.exp(-6.9 * t / duration);                 // -60 dB at `duration`
        const damping = Math.min(0.97, 0.15 + 0.82 * (t / duration)); // darker as it decays
        lp = lp + (1 - damping) * ((Math.random() * 2 - 1) - lp);
        data[i] = lp * env;
      }
      // Early reflections: a few discrete taps in the first 80 ms, different per side
      for (let k = 0; k < 8; k++) {
        const at = preDelay + Math.floor(sr * (0.006 + Math.random() * 0.075));
        if (at < len) data[at] += (Math.random() < 0.5 ? -1 : 1) * (0.5 - k * 0.04);
      }
    }
    return buffer;
  }

  resume(): void {
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
}
