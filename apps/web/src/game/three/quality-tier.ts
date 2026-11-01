export type QualityTier = 'low' | 'medium' | 'high';

export interface QualitySettings {
  /** Upper bound for the renderer pixel ratio. */
  dprCap: number;
  shadows: boolean;
  shadowMapSize: number;
  antialias: boolean;
  /** Distance the fog closes in, which hides draw distance on weak GPUs. */
  fogFar: number;
}

export const qualitySettings: Record<QualityTier, QualitySettings> = {
  low: {
    dprCap: 1,
    shadows: false,
    shadowMapSize: 512,
    antialias: false,
    fogFar: 90,
  },
  medium: {
    dprCap: 1.5,
    shadows: true,
    shadowMapSize: 1024,
    antialias: true,
    fogFar: 130,
  },
  high: {
    dprCap: 2,
    shadows: true,
    shadowMapSize: 2048,
    antialias: true,
    fogFar: 170,
  },
};

export const qualityStorageKey = 'tankquest-quality';
const tierOrder: QualityTier[] = ['low', 'medium', 'high'];

export interface DeviceSignals {
  cores: number;
  memoryGb: number;
  /** `navigator.connection.effectiveType`, e.g. `4g` or `2g`. */
  effectiveType: string;
  saveData: boolean;
}

/** Reads what the browser is willing to tell us; every field has a fallback. */
export function readDeviceSignals(): DeviceSignals {
  if (typeof navigator === 'undefined') {
    return { cores: 4, memoryGb: 8, effectiveType: '4g', saveData: false };
  }
  const connection = (
    navigator as Navigator & {
      connection?: { effectiveType?: string; saveData?: boolean };
      deviceMemory?: number;
    }
  ).connection;
  return {
    cores: navigator.hardwareConcurrency || 4,
    memoryGb:
      (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8,
    effectiveType: connection?.effectiveType ?? '4g',
    saveData: Boolean(connection?.saveData),
  };
}

/**
 * Picks a starting tier from device signals. Calibration on real frame times
 * overrides this after a couple of seconds, so a conservative guess is fine.
 */
export function chooseTier(signals: DeviceSignals): QualityTier {
  if (
    signals.saveData ||
    signals.effectiveType === '2g' ||
    signals.effectiveType === 'slow-2g'
  ) {
    return 'low';
  }
  const weak = signals.cores <= 4 || signals.memoryGb <= 4;
  const strong = signals.cores >= 8 && signals.memoryGb >= 8;
  if (weak) return 'low';
  if (strong && signals.effectiveType === '4g') return 'high';
  return 'medium';
}

/** Downgrades one step; never promotes, so the view cannot oscillate. */
export function downgrade(tier: QualityTier): QualityTier {
  const index = tierOrder.indexOf(tier);
  return tierOrder[Math.max(0, index - 1)]!;
}

export function tierFromQuery(search: string): QualityTier | null {
  const value = new URLSearchParams(search).get('quality');
  return value && tierOrder.includes(value as QualityTier)
    ? (value as QualityTier)
    : null;
}

export function readStoredTier(
  storage: Pick<Storage, 'getItem'> | null
): QualityTier | null {
  const value = storage?.getItem(qualityStorageKey);
  return value && tierOrder.includes(value as QualityTier)
    ? (value as QualityTier)
    : null;
}

export function storeTier(
  storage: Pick<Storage, 'setItem'> | null,
  tier: QualityTier
): void {
  storage?.setItem(qualityStorageKey, tier);
}

/** Averages frame times so a single slow frame does not trigger a downgrade. */
export function createFrameSampler(windowSize = 90) {
  let elapsed = 0;
  let frames = 0;
  return {
    add(deltaSeconds: number): void {
      elapsed += deltaSeconds;
      frames += 1;
    },
    get ready(): boolean {
      return frames >= windowSize;
    },
    get averageFps(): number {
      return elapsed > 0 ? frames / elapsed : 0;
    },
    reset(): void {
      elapsed = 0;
      frames = 0;
    },
  };
}

/** True when the measured frame rate is too low for the current tier. */
export function shouldDowngrade(
  tier: QualityTier,
  averageFps: number
): boolean {
  if (tier === 'low') return false;
  return averageFps > 0 && averageFps < 42;
}
