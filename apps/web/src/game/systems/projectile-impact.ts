import type { ArmorProfile, ArmorZone } from '../runtime/types.js';

export type ProjectileImpactOutcome = 'ricochet' | 'blocked' | 'penetrated';

export interface ProjectileImpactInput {
  armor: ArmorProfile;
  baseDamage: number;
  impactOffsetX: number;
  impactOffsetY: number;
  penetration: number;
  projectileVelocityX: number;
  projectileVelocityY: number;
  targetRotation: number;
}

export interface ProjectileImpactResult {
  outcome: ProjectileImpactOutcome;
  zone: ArmorZone;
  impactAngleDegrees: number;
  baseArmor: number;
  effectiveArmor: number;
  penetration: number;
  damage: number;
}

const ricochetAngleDegrees = 70;
const minimumArmorCosine = 0.5;

export function classifyArmorZone(
  impactOffsetX: number,
  impactOffsetY: number,
  targetRotation: number
): ArmorZone {
  const rotation = finiteOr(targetRotation, 0);
  const offsetX = finiteOr(impactOffsetX, 0);
  const offsetY = finiteOr(impactOffsetY, 0);
  const localX = offsetX * Math.cos(rotation) + offsetY * Math.sin(rotation);
  const localY = -offsetX * Math.sin(rotation) + offsetY * Math.cos(rotation);

  if (Math.abs(localX) >= Math.abs(localY)) {
    return localX < 0 ? 'rear' : 'front';
  }
  return 'side';
}

export function calculateProjectileImpact(
  input: ProjectileImpactInput
): ProjectileImpactResult {
  const targetRotation = finiteOr(input.targetRotation, 0);
  const zone = classifyArmorZone(
    input.impactOffsetX,
    input.impactOffsetY,
    targetRotation
  );
  const baseArmor = positiveOr(input.armor[zone], 1);
  const penetration = nonNegativeOr(input.penetration, 0);
  const baseDamage = nonNegativeOr(input.baseDamage, 0);
  const normalAngle = armorNormalAngle(
    zone,
    input.impactOffsetX,
    input.impactOffsetY,
    targetRotation
  );
  const impactAngleDegrees = calculateImpactAngle(
    input.projectileVelocityX,
    input.projectileVelocityY,
    normalAngle
  );
  const cosine = Math.cos((impactAngleDegrees * Math.PI) / 180);
  const effectiveArmor = Math.round(
    baseArmor / Math.max(minimumArmorCosine, cosine)
  );

  if (impactAngleDegrees >= ricochetAngleDegrees) {
    return result('ricochet', 0);
  }
  if (penetration < effectiveArmor || baseDamage === 0) {
    return result('blocked', 0);
  }

  const penetrationMargin = penetration - effectiveArmor;
  const damageMultiplier = Math.min(1, 0.65 + penetrationMargin / 100);
  return result(
    'penetrated',
    Math.max(1, Math.round(baseDamage * damageMultiplier))
  );

  function result(
    outcome: ProjectileImpactOutcome,
    damage: number
  ): ProjectileImpactResult {
    return {
      outcome,
      zone,
      impactAngleDegrees,
      baseArmor,
      effectiveArmor,
      penetration,
      damage,
    };
  }
}

function armorNormalAngle(
  zone: ArmorZone,
  impactOffsetX: number,
  impactOffsetY: number,
  targetRotation: number
) {
  if (zone === 'front') return targetRotation;
  if (zone === 'rear') return targetRotation + Math.PI;

  const localY =
    -finiteOr(impactOffsetX, 0) * Math.sin(targetRotation) +
    finiteOr(impactOffsetY, 0) * Math.cos(targetRotation);
  return targetRotation + (localY < 0 ? -Math.PI / 2 : Math.PI / 2);
}

function calculateImpactAngle(
  projectileVelocityX: number,
  projectileVelocityY: number,
  normalAngle: number
) {
  const velocityX = finiteOr(projectileVelocityX, 0);
  const velocityY = finiteOr(projectileVelocityY, 0);
  const speed = Math.hypot(velocityX, velocityY);
  if (speed === 0) return 0;

  const sourceX = -velocityX / speed;
  const sourceY = -velocityY / speed;
  const cosine = Math.min(
    1,
    Math.max(
      0,
      sourceX * Math.cos(normalAngle) + sourceY * Math.sin(normalAngle)
    )
  );
  return Math.round((Math.acos(cosine) * 1800) / Math.PI) / 10;
}

function finiteOr(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function nonNegativeOr(value: number, fallback: number) {
  return Math.max(0, finiteOr(value, fallback));
}

function positiveOr(value: number, fallback: number) {
  return Math.max(1, finiteOr(value, fallback));
}
