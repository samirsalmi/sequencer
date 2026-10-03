import { Injectable } from '@angular/core';

const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

const SCALE_INTERVALS: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  naturalMinor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  pentatonic: [0, 2, 4, 7, 9],
};

const CHORD_INTERVALS: Record<string, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6],
  augmented: [0, 4, 8],
  major7: [0, 4, 7, 11],
  minor7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
};

export function noteToMidi(note: string): number {
  const m = note.match(/^([A-G]#?)(\d)$/);
  if (!m) throw new Error(`Invalid note name: ${note}`);
  return (parseInt(m[2]) + 1) * 12 + NOTES.indexOf(m[1]);
}

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function getScaleNotes(rootNote: string, scale: string): string[] {
  const idx = NOTES.indexOf(rootNote);
  if (idx === -1) return [];
  const intervals = SCALE_INTERVALS[scale] ?? SCALE_INTERVALS['major'];
  return intervals.map(i => {
    const halfSteps = idx + i;
    return `${NOTES[halfSteps % 12]}${Math.floor(halfSteps / 12) + 3}`;
  });
}

export function getChordNotes(rootNote: string, scale: string, degree: number, seventh = false): string[] {
  const scaleNotes = getScaleNotes(rootNote, scale);
  if (!scaleNotes.length) return [];
  const rootIdx = degree - 1;
  const root = scaleNotes[rootIdx % scaleNotes.length];
  const rootMidi = noteToMidi(root);
  const rootPc = rootMidi % 12;

  // Determine chord quality from scale degree
  const isMinor = [2, 3, 6].includes(degree);
  const isDim = degree === 7 && (scale === 'major');
  const isMin7Flat5 = degree === 7 && (scale === 'naturalMinor' || scale === 'dorian');
  const isDim7 = degree === 7 && scale === 'harmonicMinor';
  let chordType: string;
  if (seventh) {
    if (isDim || isMin7Flat5) chordType = 'm7b5';
    else if (isDim7) chordType = 'dim7';
    else if (degree === 5 && scale === 'major') chordType = 'dom7';
    else if (isMinor) chordType = 'minor7';
    else chordType = 'major7';
  } else {
    if (isDim && scale === 'major') chordType = 'diminished';
    else if (isMinor) chordType = 'minor';
    else chordType = 'major';
  }

  const intervals = CHORD_INTERVALS[chordType] ?? CHORD_INTERVALS['major'];
  return intervals.map(i => {
    const halfSteps = rootPc + i;
    const octaveOffset = Math.floor(halfSteps / 12);
    return `${NOTES[halfSteps % 12]}${4 + octaveOffset}`;
  });
}

@Injectable({ providedIn: 'root' })
export class SynthEngineService {

  triggerVoice(noteName: string, synthType: string, ctx: AudioContext, dest: AudioNode, duration?: number): void {
    if (ctx.state === 'suspended') ctx.resume();

    switch (synthType) {
      case 'square':
        this.triggerBass(noteName, ctx, dest, duration);
        break;
      case 'sine':
        this.triggerLead(noteName, ctx, dest);
        break;
      case 'triangle':
        this.triggerPercussion(noteName, ctx, dest);
        break;
    }
  }

  private triggerBass(noteName: string, ctx: AudioContext, dest: AudioNode, duration?: number): void {
    let freq = 0;
    try { freq = midiToFrequency(noteToMidi(noteName)); } catch {}
    if (!freq) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'square';
    osc.frequency.value = freq;

    filter.type = 'lowpass';
    filter.frequency.value = 600;

    const end = duration ?? 0.29;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.02);
    gain.gain.setValueAtTime(0.4, now + 0.14);
    gain.gain.linearRampToValueAtTime(0, now + end);

    osc.connect(filter).connect(gain).connect(dest);
    osc.start(now);
    osc.stop(now + end);
  }

  private triggerLead(noteName: string, ctx: AudioContext, dest: AudioNode): void {
    let freq = 0;
    try { freq = midiToFrequency(noteToMidi(noteName)); } catch {}
    if (!freq) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.02);
    gain.gain.setValueAtTime(0.35, now + 0.25);
    gain.gain.linearRampToValueAtTime(0, now + 0.55);

    osc.connect(gain).connect(dest);
    osc.start(now);
    osc.stop(now + 0.55);
  }

  private triggerPercussion(noteName: string, ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;

    switch (noteName) {
      case 'Kick':
        this.playKick(now, ctx, dest);
        break;
      case 'Snare':
        this.playSnare(now, ctx, dest);
        break;
      case 'Hi-Hat':
        this.playHiHat(now, ctx, dest);
        break;
    }
  }

  private playKick(now: number, ctx: AudioContext, dest: AudioNode): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);
    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain).connect(dest);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  private playSnare(now: number, ctx: AudioContext, dest: AudioNode): void {
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 180;
    oscGain.gain.setValueAtTime(0.6, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(oscGain);

    const len = Math.ceil(ctx.sampleRate * 0.15);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    noise.buffer = buf;
    noiseGain.gain.setValueAtTime(0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    noise.connect(noiseGain);

    const mix = ctx.createGain();
    oscGain.connect(mix);
    noiseGain.connect(mix);
    mix.connect(dest);
    osc.start(now);
    osc.stop(now + 0.15);
    noise.start(now);
    noise.stop(now + 0.15);
  }

  private playHiHat(now: number, ctx: AudioContext, dest: AudioNode): void {
    const len = Math.ceil(ctx.sampleRate * 0.04);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    noise.buffer = buf;
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    noise.connect(filter).connect(gain).connect(dest);
    noise.start(now);
    noise.stop(now + 0.04);
  }
}
