// Hand-written preset, stored as a note list (converted losslessly from the original grid format).
import type { SongDef } from './song-format';

export const HAPPY_BIRTHDAY_TO_YOU: SongDef = {
  name: "Happy Birthday to You",
  artist: "Traditional",
  bpm: 90,
  stepsPerBeat: 4,
  stepResolution: "16th",
  timeSignature: "3/4",
  stepCount: 108,
  scale: "major",
  rootNote: "C",
  swingPercentage: 0,
  tracks: [
    {
      trackName: "🎵 Right Hand — Melody",
      synthType: "triangle",
      instrumentPreset: "piano",
      playbackMode: "sample",
      sampleSet: "acoustic-piano",
      delaySend: 0.05,
      reverbSend: 0.3,
      rowNotes: ["G5", "F5", "E5", "D5", "C5", "B4", "A4", "G4"],
      notes: [
        [8,7,3,0.8], [11,7,1,0.6], [12,6,4,1], [16,7,4,0.8], [20,4,4,0.8], [24,5,8,1], [32,7,3,0.8], [35,7,1,0.6], [36,6,4,1], [40,7,4,0.8],
        [44,3,4,0.8], [48,4,8,1], [56,7,3,0.8], [59,7,1,0.6], [60,0,4,1], [64,2,4,0.8], [68,4,4,0.8], [72,5,4,1], [76,6,4,0.8], [80,1,3,0.8],
        [83,1,1,0.6], [84,2,4,1], [88,4,4,0.8], [92,3,4,0.8], [96,4,8,1],
      ],
    },
    {
      trackName: "🎹 Left Hand — Waltz",
      synthType: "triangle",
      instrumentPreset: "piano",
      playbackMode: "sample",
      sampleSet: "acoustic-piano",
      reverbSend: 0.3,
      rowNotes: ["C4", "B3", "A#3", "A3", "G3", "F3", "E3", "C3", "G2", "F2"],
      notes: [
        [12,7,4,0.7], [16,0,4,0.4], [16,4,4,0.4], [16,6,4,0.4], [20,0,4,0.4], [20,4,4,0.4], [20,6,4,0.4], [24,8,4,0.7], [28,1,4,0.4], [28,4,4,0.4],
        [28,5,4,0.4], [32,1,4,0.4], [32,4,4,0.4], [32,5,4,0.4], [36,8,4,0.7], [40,1,4,0.4], [40,4,4,0.4], [40,5,4,0.4], [44,1,4,0.4], [44,4,4,0.4],
        [44,5,4,0.4], [48,7,4,0.7], [52,0,4,0.4], [52,4,4,0.4], [52,6,4,0.4], [56,0,4,0.4], [56,4,4,0.4], [56,6,4,0.4], [60,7,4,0.7], [64,2,4,0.4],
        [64,4,4,0.4], [64,6,4,0.4], [68,2,4,0.4], [68,4,4,0.4], [68,6,4,0.4], [72,9,4,0.7], [76,0,4,0.4], [76,3,4,0.4], [76,5,4,0.4], [80,0,4,0.4],
        [80,3,4,0.4], [80,5,4,0.4], [84,7,4,0.7], [88,0,4,0.4], [88,4,4,0.4], [88,6,4,0.4], [92,1,4,0.4], [92,4,4,0.4], [92,5,4,0.4], [96,7,4,0.7],
        [100,0,8,0.4], [100,4,8,0.4], [100,6,8,0.4],
      ],
    },
  ],
};
