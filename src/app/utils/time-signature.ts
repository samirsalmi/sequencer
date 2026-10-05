export interface ParsedTimeSig {
  numerator: number;
  denominator: number;
}

export function parseTimeSignature(timeSig: string): ParsedTimeSig {
  const parts = timeSig.split('/');
  return { numerator: parseInt(parts[0], 10) || 4, denominator: parseInt(parts[1], 10) || 4 };
}

/** Grid resolution: what one step is. '16th+triplet' (12 steps per beat) holds both straight 16ths and triplets. */
export type StepResolution = '16th' | '8th' | '32nd' | '8th-triplet' | '16th-triplet' | '16th+triplet';

/** Steps per whole note for each resolution. */
export const STEPS_PER_WHOLE: Record<StepResolution, number> = {
  '8th': 8, '16th': 16, '32nd': 32, '8th-triplet': 12, '16th-triplet': 24, '16th+triplet': 48,
};

export function stepsPerMeasure(timeSig: string, resolution: StepResolution): number {
  const { numerator, denominator } = parseTimeSignature(timeSig);
  const resolutionBase = STEPS_PER_WHOLE[resolution] ?? 16;
  return numerator * (resolutionBase / denominator);
}

export function stepsPerBeat(timeSig: string, resolution: StepResolution): number {
  const spm = stepsPerMeasure(timeSig, resolution);
  const beats = beatsPerMeasure(timeSig);
  return spm / beats;
}

export function beatsPerMeasure(timeSig: string): number {
  const { numerator, denominator } = parseTimeSignature(timeSig);
  if (denominator === 8 && numerator >= 6 && numerator % 3 === 0) {
    return numerator / 3;
  }
  return numerator;
}

export function getBeatStepIndices(timeSig: string, resolution: StepResolution, stepCount: number): number[] {
  const spm = stepsPerMeasure(timeSig, resolution);
  const spb = stepsPerBeat(timeSig, resolution);
  const beats: number[] = [];
  for (let step = 0; step < stepCount; step++) {
    const measureOffset = step % spm;
    if (measureOffset % spb === 0) beats.push(step);
  }
  return beats;
}

export function getMeasureStepIndices(timeSig: string, resolution: StepResolution, stepCount: number): number[] {
  const spm = stepsPerMeasure(timeSig, resolution);
  const measures: number[] = [];
  for (let step = 0; step < stepCount; step += spm) measures.push(step);
  return measures;
}

export function isMeasureStart(step: number, timeSig: string, resolution: StepResolution): boolean {
  if (step === 0) return true;
  const spm = stepsPerMeasure(timeSig, resolution);
  return step % spm === 0;
}

export function isBeatStart(step: number, timeSig: string, resolution: StepResolution): boolean {
  const spm = stepsPerMeasure(timeSig, resolution);
  const spb = stepsPerBeat(timeSig, resolution);
  const measureOffset = step % spm;
  return measureOffset % spb === 0;
}

export interface StepValidation {
  valid: boolean;
  stepsPerMeasure: number;
  measures: number;
  message: string;
}

export function validateStepAlignment(stepCount: number, timeSig: string, resolution: StepResolution): StepValidation {
  const spm = stepsPerMeasure(timeSig, resolution);
  const measures = stepCount / spm;
  const valid = Number.isInteger(measures);
  return {
    valid,
    stepsPerMeasure: spm,
    measures: valid ? measures : Math.floor(measures),
    message: valid
      ? `${stepCount} steps = ${measures} ${measures === 1 ? 'measure' : 'measures'} (${timeSig} · ${resolution}-note grid)`
      : `${stepCount} steps (not a multiple of ${spm} for ${timeSig})`,
  };
}
