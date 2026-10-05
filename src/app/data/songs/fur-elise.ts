// Hand-written preset, stored as a note list (converted losslessly from the original grid format).
import type { SongDef } from './song-format';

export const FUR_ELISE: SongDef = {
  name: "Für Elise (Easy Piano)",
  artist: "Ludwig van Beethoven",
  bpm: 62.5,
  stepsPerBeat: 4,
  stepResolution: "16th",
  timeSignature: "4/4",
  stepCount: 50,
  scale: "naturalMinor",
  rootNote: "A",
  swingPercentage: 0,
  tracks: [
    {
      trackName: "🎵 Right Hand — Melody",
      synthType: "triangle",
      instrumentPreset: "piano",
      playbackMode: "sample",
      sampleSet: "acoustic-piano",
      delaySend: 0.08,
      reverbSend: 0.35,
      rowNotes: ["E5", "D#5", "D5", "C5", "B4", "A4", "G#4", "E4"],
      notes: [
        [0,0,1,1], [1,1,1,1], [2,0,1,1], [3,1,1,1], [4,0,1,1], [5,4,1,1], [6,2,1,1], [7,3,1,1], [8,5,2,1], [11,7,1,1],
        [12,5,1,1], [13,3,1,1], [14,4,2,1], [17,7,1,1], [18,6,1,1], [19,4,1,1], [20,3,2,1], [24,0,1,1], [25,1,1,1], [26,0,1,1],
        [27,1,1,1], [28,0,1,1], [29,4,1,1], [30,2,1,1], [31,3,1,1], [32,5,2,1], [35,7,1,1], [36,5,1,1], [37,3,1,1], [38,4,2,1],
        [41,7,1,1], [42,6,1,1], [43,4,1,1], [44,5,4,1], [48,0,1,1], [49,1,1,1],
      ],
    },
    {
      trackName: "🎹 Left Hand — Accompaniment",
      synthType: "sine",
      instrumentPreset: "piano",
      playbackMode: "sample",
      sampleSet: "acoustic-piano",
      delaySend: 0.05,
      reverbSend: 0.25,
      rowNotes: ["B3", "A3", "G#3", "E3", "A2", "E2"],
      notes: [
        [8,4,1,1], [9,3,1,1], [10,1,1,1], [14,5,1,1], [15,2,1,1], [16,0,1,1], [20,4,1,1], [21,3,1,1], [22,1,1,1], [32,4,1,1],
        [33,3,1,1], [34,1,1,1], [38,5,1,1], [39,2,1,1], [40,0,1,1], [44,4,1,1], [45,3,1,1], [46,1,2,1],
      ],
    },
  ],
};
