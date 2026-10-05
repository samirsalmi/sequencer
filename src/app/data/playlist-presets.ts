import { SONG_CATALOG } from './songs';
import { expandSong } from './songs/song-format';

export type PlaybackMode = 'synth' | 'sample' | 'layer';

export type { StepResolution } from '../utils/time-signature';
import type { StepResolution } from '../utils/time-signature';

export interface SequencePreset {
  name: string;
  artist: string;
  /** Playlist category of a built-in song ('Main', 'Draft'); the user's own songs are listed under 'My Songs'. */
  category?: string;
  bpm: number;
  scale: string;
  rootNote: string;
  stepCount?: number;
  swingPercentage?: number;
  timeSignature?: string;
  stepResolution?: StepResolution;
  /**
   * Grid steps per quarter note. When set, `bpm` is the real tempo (e.g. 4 = 16th-note grid).
   * Older songs leave it out: one step then lasts 30 / bpm seconds.
   */
  stepsPerBeat?: number;
  /** Built-in songs load their notes on demand: `tracks` stays empty until `load()` resolves. */
  load?: () => Promise<SequencePreset>;
  /** Number of tracks, known before the notes are loaded. */
  trackCount?: number;
  /** 0–1: random timing drift (up to ±12 ms per track) and velocity variation (up to ±12%) so parts don't sound machine-perfect. */
  humanize?: number;
  tracks: {
    trackName: string;
    synthType: 'sine' | 'square' | 'sawtooth' | 'triangle' | 'distortion';
    /** Stereo position, -1 (left) to 1 (right). */
    pan?: number;
    /** Track fader level 0–1.5 (defaults depend on track position, kept for older songs). */
    volume?: number;
    distortion?: number;
    drive?: number;
    filterCutoff?: number;
    filterResonance?: number;
    detune?: number;
    envelope?: { attack: number; decay: number; sustain: number; release: number };
    rowNotes: string[];
    grid: number[][];
    ties?: boolean[][];
    delaySend?: number;
    reverbSend?: number;
    arpEnabled?: boolean;
    arpPattern?: 'up' | 'down' | 'updown' | 'random';
    portamento?: number;
    instrumentPreset?: string;
    playbackMode?: PlaybackMode;
    sampleSet?: string;
    sampleBlend?: number;
  }[];
}

export interface FilterEnvelope {
  initialCutoff: number;
  finalCutoff: number;
  rampDuration: number;
  Q: number;
}

export interface VibratoConfig {
  /** Pitch depth in cents (±). */
  depth: number;
  rate: number;
  /** Seconds before vibrato fades in (players add it after the attack). */
  delay?: number;
}

export interface DistortionConfig {
  amount: number;
  oversample?: 'none' | '2x' | '4x';
}

export interface HighPassConfig {
  frequency: number;
}

export interface InstrumentPreset {
  name: string;
  label: string;
  oscType: OscillatorType;
  /** Second oscillator: waveform (defaults to oscType), octave offset, level 0–1 and detune in cents. */
  osc2Type?: OscillatorType;
  osc2Octave?: number;
  osc2Level?: number;
  detune?: number;
  /** Attack pitch drop: start `semitones` sharp and settle over `time` seconds (pluck / strike feel). */
  pitchDrop?: { semitones: number; time: number };
  /** Output level trim for the retro voice (default 1), to balance it against the samples. */
  level?: number;
  /** 0 = fixed filter cutoff, 1 = cutoff follows pitch fully (default 0.5). */
  keyTracking?: number;
  ampAttack: number;
  ampDecay: number;
  ampSustain: number;
  ampRelease: number;
  velocitySensitivity: number;
  filterEnvelope?: FilterEnvelope;
  vibrato?: VibratoConfig;
  distortion?: DistortionConfig;
  highPassFilter?: HighPassConfig;
  sampleSet?: string;
  /** A synthesizer: its real sound is the synth voice, so it has no sample set. */
  synthOnly?: boolean;
}

// Each instrument has two voices:
//  • realistic: `sampleSet`, recorded samples from public/samples (used in 'sample' / 'layer' playback mode)
//  • retro:     the synth patch below, built only from the four basic waves (sine / square / triangle / sawtooth),
//               used in 'synth' mode, RETRO mode, and as fallback when a sample is missing.
// Retro patch = 2 oscillators → key-tracked lowpass with envelope → exponential ADSR (+ optional pitch drop / vibrato).
// Vibrato depth is in cents.
export const INSTRUMENT_PRESETS: Record<string, InstrumentPreset> = {

  // ── Keys ──────────────────────────────────────────────────────────────
  piano: {
    name: 'piano',
    label: '🎹 Piano',
    sampleSet: 'acoustic-piano',
    oscType: 'square',                        // hollow 8-bit body
    osc2Type: 'triangle', osc2Level: 0.7, detune: 0,
    ampAttack: 0.002, ampDecay: 0.9, ampSustain: 0.12, ampRelease: 0.2,
    velocitySensitivity: 0.7,
    keyTracking: 0.8,                         // low notes mellow, high notes bright
    filterEnvelope: { initialCutoff: 5000, finalCutoff: 1800, rampDuration: 0.25, Q: 0.5 },
  },

  uprightPiano: {
    name: 'uprightPiano',
    label: '🎹 Upright Piano',
    sampleSet: 'upright-piano',
    oscType: 'square',
    osc2Type: 'square', osc2Level: 0.7, detune: 12, // two slightly out-of-tune strings = honky-tonk
    ampAttack: 0.002, ampDecay: 0.7, ampSustain: 0.1, ampRelease: 0.2,
    velocitySensitivity: 0.7,
    keyTracking: 0.8,
    filterEnvelope: { initialCutoff: 4500, finalCutoff: 1500, rampDuration: 0.2, Q: 0.6 },
  },

  // ── Guitars & bass ────────────────────────────────────────────────────
  guitar: {
    name: 'guitar',
    label: '🎸 Electric Guitar',
    sampleSet: 'electric-guitar',
    oscType: 'square',
    osc2Type: 'sawtooth', osc2Level: 0.5, detune: 4,
    ampAttack: 0.002, ampDecay: 0.6, ampSustain: 0.3, ampRelease: 0.15,
    level: 0.75,
    velocitySensitivity: 0.6,
    keyTracking: 0.6,
    pitchDrop: { semitones: 0.3, time: 0.03 },
    filterEnvelope: { initialCutoff: 4000, finalCutoff: 1400, rampDuration: 0.15, Q: 1.0 },
  },

  classicalGuitar: {
    name: 'classicalGuitar',
    label: '🏛️ Classical Guitar',
    sampleSet: 'nylon-guitar',
    oscType: 'triangle',                      // soft nylon
    osc2Type: 'square', osc2Level: 0.25, detune: 3,
    ampAttack: 0.003, ampDecay: 1.0, ampSustain: 0.0, ampRelease: 0.25,
    level: 1.35,
    velocitySensitivity: 0.7,
    keyTracking: 0.6,
    pitchDrop: { semitones: 0.2, time: 0.03 },
    filterEnvelope: { initialCutoff: 3000, finalCutoff: 900, rampDuration: 0.2, Q: 0.7 },
  },

  acousticGuitar: {
    name: 'acousticGuitar',
    label: '🎸 Acoustic Guitar',
    sampleSet: 'acoustic-guitar',
    oscType: 'sawtooth',                      // bright steel strings
    osc2Type: 'triangle', osc2Level: 0.6, detune: 5,
    ampAttack: 0.002, ampDecay: 1.2, ampSustain: 0.0, ampRelease: 0.25,
    level: 1.6,
    velocitySensitivity: 0.8,
    keyTracking: 0.6,
    pitchDrop: { semitones: 0.25, time: 0.025 },
    filterEnvelope: { initialCutoff: 5000, finalCutoff: 1100, rampDuration: 0.15, Q: 1.2 },
  },

  karoryferGuitar: {
    name: 'karoryferGuitar',
    label: '🎸 Emily Guitar (Warm)',
    sampleSet: 'emily-guitar',
    oscType: 'sawtooth',
    osc2Type: 'triangle', osc2Level: 0.7, detune: 4,
    ampAttack: 0.003, ampDecay: 0.7, ampSustain: 0.25, ampRelease: 0.2,
    velocitySensitivity: 0.6,
    keyTracking: 0.6,
    pitchDrop: { semitones: 0.2, time: 0.03 },
    filterEnvelope: { initialCutoff: 3500, finalCutoff: 900, rampDuration: 0.18, Q: 0.9 },
  },

  bjamGuitar: {
    name: 'bjamGuitar',
    label: '🎸 BJAM Bridge (Aggressive)',
    sampleSet: 'bjam-guitar',
    oscType: 'sawtooth',
    osc2Type: 'square', osc2Level: 0.6, detune: 6,
    ampAttack: 0.002, ampDecay: 0.7, ampSustain: 0.3, ampRelease: 0.15,
    velocitySensitivity: 0.7,
    keyTracking: 0.5,
    pitchDrop: { semitones: 0.3, time: 0.025 },
    filterEnvelope: { initialCutoff: 7000, finalCutoff: 1800, rampDuration: 0.12, Q: 1.6 },
  },

  metalGuitar: {
    name: 'metalGuitar',
    label: '🤘 Metal Guitar (Distortion)',
    sampleSet: 'bjam-guitar', // samples are driven through the same distortion
    oscType: 'sawtooth',
    osc2Type: 'sawtooth', osc2Level: 0.8, detune: 14, // double-tracked rhythm guitar
    ampAttack: 0.002, ampDecay: 0.4, ampSustain: 0.65, ampRelease: 0.08,
    velocitySensitivity: 0.6,
    keyTracking: 0.3,
    distortion: { amount: 0.75, oversample: '4x' },
    highPassFilter: { frequency: 90 },
    filterEnvelope: { initialCutoff: 5500, finalCutoff: 2600, rampDuration: 0.08, Q: 1.8 },
  },

  // Real amp-distorted recordings (the app's own distortion is skipped for these sets).
  // Retro voice / fallback = the metal-guitar patch.
  powerChords: {
    name: 'powerChords',
    label: '🤘 Power Chords (Real Amp)',
    sampleSet: 'dist-power', // one grid note = the whole power chord on that root
    oscType: 'sawtooth',
    osc2Type: 'sawtooth', osc2Level: 0.8, detune: 14,
    ampAttack: 0.002, ampDecay: 0.4, ampSustain: 0.65, ampRelease: 0.08,
    velocitySensitivity: 0.6,
    keyTracking: 0.3,
    distortion: { amount: 0.75, oversample: '4x' },
    highPassFilter: { frequency: 90 },
    filterEnvelope: { initialCutoff: 5500, finalCutoff: 2600, rampDuration: 0.08, Q: 1.8 },
  },

  distGuitar: {
    name: 'distGuitar',
    label: '🤘 Distorted Guitar (Real Amp)',
    sampleSet: 'dist-guitar',
    oscType: 'sawtooth',
    osc2Type: 'sawtooth', osc2Level: 0.8, detune: 10,
    ampAttack: 0.002, ampDecay: 0.4, ampSustain: 0.65, ampRelease: 0.1,
    velocitySensitivity: 0.6,
    keyTracking: 0.4,
    distortion: { amount: 0.7, oversample: '4x' },
    highPassFilter: { frequency: 90 },
    filterEnvelope: { initialCutoff: 5500, finalCutoff: 2800, rampDuration: 0.08, Q: 1.5 },
  },

  bass: {
    name: 'bass',
    label: '🎸 Electric Bass',
    sampleSet: 'electric-bass',
    oscType: 'triangle',                      // classic console bass
    osc2Type: 'square', osc2Level: 0.25, detune: 0,
    ampAttack: 0.003, ampDecay: 0.5, ampSustain: 0.45, ampRelease: 0.1,
    velocitySensitivity: 0.6,
    keyTracking: 0.3,
    pitchDrop: { semitones: 0.2, time: 0.02 },
    filterEnvelope: { initialCutoff: 1800, finalCutoff: 600, rampDuration: 0.12, Q: 0.8 },
  },

  // ── Strings ───────────────────────────────────────────────────────────
  violin: {
    name: 'violin',
    label: '🎻 Violin',
    sampleSet: 'violin',
    oscType: 'sawtooth',
    osc2Type: 'sawtooth', osc2Level: 0.7, detune: 7,
    ampAttack: 0.1, ampDecay: 0.3, ampSustain: 0.8, ampRelease: 0.25,
    velocitySensitivity: 0.5,
    keyTracking: 0.5,
    vibrato: { depth: 15, rate: 5.5, delay: 0.25 },
    filterEnvelope: { initialCutoff: 3000, finalCutoff: 4500, rampDuration: 0.25, Q: 0.5 },
  },

  cello: {
    name: 'cello',
    label: '🎻 Cello',
    sampleSet: 'cello',
    // Square (odd harmonics) + saw (evens) under a gentle filter: tuned against the real cello's harmonic
    // profile (weak 2nd, strong 3rd/4th, overtones fading by the 8th) instead of a raw, buzzy sawtooth.
    oscType: 'square',
    osc2Type: 'sawtooth', osc2Level: 1.0, detune: 3,
    ampAttack: 0.14, ampDecay: 0.3, ampSustain: 0.9, ampRelease: 0.3, // slow bow attack
    velocitySensitivity: 0.5,
    keyTracking: 0.9,
    vibrato: { depth: 10, rate: 5.5, delay: 0.35 },
    filterEnvelope: { initialCutoff: 1100, finalCutoff: 1700, rampDuration: 0.3, Q: 0.9 },
  },

  // ── Winds & brass ─────────────────────────────────────────────────────
  orchestralFlute: {
    name: 'orchestralFlute',
    label: '🎵 Flute',
    sampleSet: 'flute',
    oscType: 'triangle',
    osc2Type: 'sine', osc2Octave: 1, osc2Level: 0.25, detune: 0,
    ampAttack: 0.05, ampDecay: 0.2, ampSustain: 0.8, ampRelease: 0.12,
    level: 1.45,
    velocitySensitivity: 0.4,
    keyTracking: 0.6,
    vibrato: { depth: 12, rate: 5.2, delay: 0.25 },
    filterEnvelope: { initialCutoff: 8000, finalCutoff: 6000, rampDuration: 0.1, Q: 0.5 },
  },

  trumpet: {
    name: 'trumpet',
    label: '🎺 Trumpet',
    sampleSet: 'trumpet',
    oscType: 'sawtooth',
    osc2Type: 'square', osc2Level: 0.35, detune: 3,
    ampAttack: 0.025, ampDecay: 0.2, ampSustain: 0.8, ampRelease: 0.1,
    velocitySensitivity: 0.7,
    keyTracking: 0.6,
    vibrato: { depth: 8, rate: 5.5, delay: 0.3 },
    filterEnvelope: { initialCutoff: 900, finalCutoff: 4000, rampDuration: 0.06, Q: 1.2 }, // brassy swell
  },

  frenchHorn: {
    name: 'frenchHorn',
    label: '📯 French Horn',
    sampleSet: 'french-horn',
    oscType: 'triangle',
    osc2Type: 'sawtooth', osc2Level: 0.35, detune: 4,
    ampAttack: 0.06, ampDecay: 0.3, ampSustain: 0.85, ampRelease: 0.2,
    velocitySensitivity: 0.5,
    keyTracking: 0.5,
    vibrato: { depth: 5, rate: 5.0, delay: 0.4 },
    filterEnvelope: { initialCutoff: 600, finalCutoff: 1800, rampDuration: 0.12, Q: 0.7 }, // mellow, covered tone
  },

  // ── Folk / Celtic ─────────────────────────────────────────────────────
  bagpipe: {
    name: 'bagpipe',
    label: '🎶 Bagpipe',
    sampleSet: 'bagpipe',
    oscType: 'sawtooth',                      // reedy, nasal chanter
    osc2Type: 'square', osc2Level: 0.5, detune: 6,
    ampAttack: 0.01, ampDecay: 0.1, ampSustain: 0.95, ampRelease: 0.1,
    velocitySensitivity: 0.1,                 // the bag gives one steady volume
    keyTracking: 0.5,
    filterEnvelope: { initialCutoff: 3500, finalCutoff: 3500, rampDuration: 0.05, Q: 2.0 },
  },

  bagpipeDrone: {
    name: 'bagpipeDrone',
    label: '🎶 Bagpipe Drones',
    sampleSet: 'bagpipe-drone',
    oscType: 'sawtooth',
    osc2Type: 'sawtooth', osc2Octave: -1, osc2Level: 0.6, detune: 4,
    ampAttack: 0.15, ampDecay: 0.2, ampSustain: 0.9, ampRelease: 0.3,
    level: 0.7,
    velocitySensitivity: 0.1,
    keyTracking: 0.3,
    filterEnvelope: { initialCutoff: 1500, finalCutoff: 1500, rampDuration: 0.1, Q: 1.0 },
  },

  hurdyGurdy: {
    name: 'hurdyGurdy',
    label: '🎻 Hurdy-Gurdy',
    sampleSet: 'hurdy-gurdy',
    oscType: 'sawtooth',                      // bowed by a rosined wheel: bright and buzzy
    osc2Type: 'square', osc2Level: 0.4, detune: 9,
    ampAttack: 0.04, ampDecay: 0.2, ampSustain: 0.9, ampRelease: 0.2,
    velocitySensitivity: 0.3,
    keyTracking: 0.5,
    filterEnvelope: { initialCutoff: 2800, finalCutoff: 2800, rampDuration: 0.1, Q: 1.5 },
  },

  tinWhistle: {
    name: 'tinWhistle',
    label: '🎵 Tin Whistle',
    sampleSet: 'recorder',
    oscType: 'triangle',
    osc2Type: 'sine', osc2Octave: 1, osc2Level: 0.15, detune: 0,
    ampAttack: 0.02, ampDecay: 0.1, ampSustain: 0.85, ampRelease: 0.08,
    level: 1.3,
    velocitySensitivity: 0.4,
    keyTracking: 0.5,
    vibrato: { depth: 8, rate: 5.5, delay: 0.35 },
    filterEnvelope: { initialCutoff: 7000, finalCutoff: 6000, rampDuration: 0.08, Q: 0.5 },
  },

  strumstick: {
    name: 'strumstick',
    label: '🪕 Folk Lute (Mandola)',
    sampleSet: 'strumstick',
    oscType: 'sawtooth',                      // bright metal strings
    osc2Type: 'sawtooth', osc2Level: 0.5, detune: 8, // paired courses
    ampAttack: 0.002, ampDecay: 0.8, ampSustain: 0.0, ampRelease: 0.2,
    level: 1.4,
    velocitySensitivity: 0.7,
    keyTracking: 0.6,
    pitchDrop: { semitones: 0.2, time: 0.02 },
    filterEnvelope: { initialCutoff: 6000, finalCutoff: 1500, rampDuration: 0.12, Q: 1.0 },
  },

  // ── Synthesizers (80s pop / rock keys) — the synth voice is the real sound ──
  polySynth: {
    name: 'polySynth',
    label: '🎛️ Poly Synth (80s)',
    synthOnly: true,
    oscType: 'sawtooth',
    osc2Type: 'sawtooth', osc2Level: 0.9, detune: 14,        // two detuned saws = classic Oberheim / Prophet stab
    ampAttack: 0.004, ampDecay: 0.35, ampSustain: 0.45, ampRelease: 0.25,
    velocitySensitivity: 0.5,
    keyTracking: 0.4,
    filterEnvelope: { initialCutoff: 5000, finalCutoff: 1400, rampDuration: 0.25, Q: 1.2 },
  },

  synthLead: {
    name: 'synthLead',
    label: '🎛️ Synth Lead',
    synthOnly: true,
    oscType: 'square',
    osc2Type: 'sawtooth', osc2Level: 0.45, detune: 6,
    ampAttack: 0.01, ampDecay: 0.2, ampSustain: 0.8, ampRelease: 0.15,
    velocitySensitivity: 0.5,
    keyTracking: 0.5,
    vibrato: { depth: 12, rate: 5.5, delay: 0.3 },
    filterEnvelope: { initialCutoff: 4500, finalCutoff: 3000, rampDuration: 0.1, Q: 0.7 },
  },

  synthBrass: {
    name: 'synthBrass',
    label: '🎺 Synth Brass',
    synthOnly: true,
    oscType: 'sawtooth',
    osc2Type: 'sawtooth', osc2Level: 0.9, detune: 9,
    ampAttack: 0.03, ampDecay: 0.25, ampSustain: 0.8, ampRelease: 0.2,
    velocitySensitivity: 0.6,
    keyTracking: 0.5,
    vibrato: { depth: 6, rate: 5.0, delay: 0.4 },
    filterEnvelope: { initialCutoff: 700, finalCutoff: 3800, rampDuration: 0.09, Q: 1.4 }, // brassy swell
  },

  synthPad: {
    name: 'synthPad',
    label: '🌫️ Synth Pad',
    synthOnly: true,
    oscType: 'sawtooth',
    osc2Type: 'triangle', osc2Level: 0.8, detune: 10,
    ampAttack: 0.35, ampDecay: 0.6, ampSustain: 0.85, ampRelease: 0.7,
    velocitySensitivity: 0.3,
    keyTracking: 0.4,
    vibrato: { depth: 4, rate: 4.0, delay: 0.5 },
    filterEnvelope: { initialCutoff: 1200, finalCutoff: 2200, rampDuration: 0.8, Q: 0.5 },
  },

  synthBass: {
    name: 'synthBass',
    label: '🎛️ Synth Bass',
    synthOnly: true,
    oscType: 'square',
    osc2Type: 'sawtooth', osc2Level: 0.7, detune: 0,
    ampAttack: 0.003, ampDecay: 0.25, ampSustain: 0.5, ampRelease: 0.08,
    velocitySensitivity: 0.6,
    keyTracking: 0.2,
    filterEnvelope: { initialCutoff: 1800, finalCutoff: 500, rampDuration: 0.15, Q: 2.0 },
  },

  ePiano: {
    name: 'ePiano',
    label: '🎹 Electric Piano',
    synthOnly: true,
    oscType: 'sine',
    osc2Type: 'triangle', osc2Octave: 1, osc2Level: 0.35, detune: 3, // bell-like tine on top of a round body
    ampAttack: 0.002, ampDecay: 1.2, ampSustain: 0.25, ampRelease: 0.35,
    velocitySensitivity: 0.7,
    keyTracking: 0.6,
    filterEnvelope: { initialCutoff: 4000, finalCutoff: 2000, rampDuration: 0.3, Q: 0.5 },
  },

  // ── Percussion ────────────────────────────────────────────────────────
  drums: {
    name: 'drums',
    label: '🥁 Drums',
    oscType: 'sine',
    ampAttack: 0.001, ampDecay: 0.3, ampSustain: 0.0, ampRelease: 0.1,
    velocitySensitivity: 0.5,
  },
};

/** Every built-in song (src/app/data/songs): listed up front, notes downloaded when the song is selected. */
export const PLAYLIST_PRESETS: SequencePreset[] = [
  ...SONG_CATALOG.map(({ load, ...meta }): SequencePreset => {
    let full: Promise<SequencePreset> | null = null;
    return { ...meta, tracks: [], load: () => (full ??= load().then(expandSong)) };
  }),
];
