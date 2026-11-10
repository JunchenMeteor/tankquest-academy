import { aimPitch, aimYaw, rotateTowards, stepGunPitch } from './battle-aim.js';
import { normaliseAngle } from './battle-input.js';

export interface EnemyAimState {
  turret: number;
  pitch: number;
}

export function aimEnemyWeapon(
  current: EnemyAimState,
  turretOrigin: { x: number; y: number; z: number },
  gunOrigin: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
  hullHeading: number,
  traverseStep: number,
  elevationStep: number
): EnemyAimState {
  return {
    turret: rotateTowards(
      current.turret,
      normaliseAngle(aimYaw(turretOrigin, target) - hullHeading),
      traverseStep
    ),
    pitch: stepGunPitch(
      current.pitch,
      aimPitch(gunOrigin, target),
      elevationStep
    ),
  };
}
