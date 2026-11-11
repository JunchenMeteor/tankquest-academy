import { Mesh, MeshStandardMaterial } from 'three';
import type { Group, Object3D, Texture } from 'three';

import { sampleTrackPath, type TrackPath } from './running-gear-layout.js';

export interface TrackLoop extends TrackPath {
  links: Object3D[];
  baseY: number;
  travelled: number;
}

export interface TankRig {
  root: Group;
  turret: Object3D;
  gun: Object3D;
  muzzle: Object3D;
  wheels: Object3D[];
  idlers: Object3D[];
  sprockets: Object3D[];
  returnRollers: Object3D[];
  wheelAxis: 'x' | 'z';
  wheelRadius: number;
  trackTextures: Texture[];
  trackLoops: TrackLoop[];
}

const textureSlots = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'emissiveMap',
] as const;

export function texturesForTracks(root: Object3D): Texture[] {
  const textures = new Set<Texture>();
  root.traverse((node) => {
    if (!(node instanceof Mesh) || !node.name.startsWith('Tracks_')) return;
    const materials = Array.isArray(node.material)
      ? node.material
      : [node.material];
    for (const material of materials) {
      if (!(material instanceof MeshStandardMaterial)) continue;
      for (const slot of textureSlots) {
        const texture = material[slot];
        if (texture) textures.add(texture);
      }
    }
  });
  return [...textures];
}

export function tankRigFromScene(root: Group): TankRig {
  const turret = root.getObjectByName('TurretPivot');
  const gun = root.getObjectByName('GunPivot');
  const muzzle = root.getObjectByName('Muzzle');
  if (!turret || !gun || !muzzle) {
    throw new Error('Tank rig requires explicit turret, gun, and muzzle nodes');
  }
  gun.userData.pitchAxis = 'x';
  const wheels: Object3D[] = [];
  const idlers: Object3D[] = [];
  const sprockets: Object3D[] = [];
  const returnRollers: Object3D[] = [];
  root.traverse((node) => {
    if (/^Wheel_[LR]_00$/.test(node.name)) idlers.push(node);
    else if (/^Wheel_[LR]_06$/.test(node.name)) sprockets.push(node);
    else if (/^Wheel_[LR]_\d\d$/.test(node.name)) wheels.push(node);
    else if (/^ReturnRoller_[LR]_\d\d$/.test(node.name)) {
      returnRollers.push(node);
    }
  });
  return {
    root,
    turret,
    gun,
    muzzle,
    wheels,
    idlers,
    sprockets,
    returnRollers,
    wheelAxis: 'x',
    wheelRadius: 0.38,
    trackTextures: texturesForTracks(root),
    trackLoops: [],
  };
}

function rollingRadius(node: Object3D, fallback: number): number {
  const radius = node.userData.rollingRadius;
  return typeof radius === 'number' && Number.isFinite(radius) && radius > 0
    ? radius
    : fallback;
}

export function advanceRunningGear(rig: TankRig, travelled: number): void {
  for (const wheel of rig.wheels) {
    const radius = rollingRadius(wheel, rig.wheelRadius * 0.85);
    wheel.rotation[rig.wheelAxis] -= travelled / radius;
  }
  for (const idler of rig.idlers) {
    const radius = rollingRadius(idler, rig.wheelRadius * 0.65);
    idler.rotation[rig.wheelAxis] -= travelled / radius;
  }
  for (const sprocket of rig.sprockets) {
    const radius = rollingRadius(sprocket, rig.wheelRadius * 0.9);
    sprocket.rotation[rig.wheelAxis] -= travelled / radius;
  }
  for (const roller of rig.returnRollers) {
    const radius = rollingRadius(roller, 0.14);
    roller.rotation[rig.wheelAxis] -= travelled / radius;
  }
  for (const texture of rig.trackTextures) {
    texture.offset.y -= travelled * 0.25;
  }
  for (const loop of rig.trackLoops) {
    loop.travelled += travelled;
    for (const [index, link] of loop.links.entries()) {
      const distance =
        (index / loop.links.length) * loop.perimeter + loop.travelled;
      const point = sampleTrackPath(loop, distance);
      link.position.x = point.x;
      link.position.y = point.y + loop.baseY;
      link.rotation.z = point.angle;
    }
  }
}
