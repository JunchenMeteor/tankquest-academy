import { Mesh, MeshStandardMaterial } from 'three';
import type { Group, Object3D, Texture, Vector3 } from 'three';

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
  recoil: Object3D;
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
        if (!texture) continue;
        texture.userData.scrollAxis =
          node.name === 'Tracks_420' && material.name === 'Track' ? 'x' : 'y';
        textures.add(texture);
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
  const recoil = root.getObjectByName('RecoilPivot') ?? gun;
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
    recoil,
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

export function addRoadWheelFaceMarkers(root: Group): void {
  root.traverse((node) => {
    if (!(node instanceof Mesh) || !/^Wheel_[LR]_0[1-5]$/.test(node.name)) {
      return;
    }
    node.geometry.computeBoundingBox();
    const size = node.geometry.boundingBox?.getSize(node.position.clone());
    if (!size) return;
    const axle = size.x < size.y ? 'x' : 'y';
    const radius =
      axle === 'x'
        ? Math.max(size.y, size.z) / 2
        : Math.max(size.x, size.z) / 2;
    if (radius <= 0) return;
    const marker = new Mesh(
      node.geometry,
      new MeshStandardMaterial({
        color: 0x9aa3a8,
        metalness: 0.65,
        roughness: 0.45,
      })
    );
    marker.name = `WheelFaceMarker_${node.name.replace('Wheel_', '')}`;
    marker.scale.setScalar(0.18);
    const side = node.name.includes('_L_') ? -1 : 1;
    marker.position[axle] = side * (size[axle] / 2 + 0.001);
    marker.position.z = radius * 0.55;
    node.add(marker);
  });
}

function rollingRadius(node: Object3D, fallback: number): number {
  const radius = node.userData.rollingRadius;
  return typeof radius === 'number' && Number.isFinite(radius) && radius > 0
    ? radius
    : fallback;
}

export function applyGunRecoil(
  rig: TankRig,
  restPosition: Vector3,
  recoil: number
): void {
  const direction = rig.muzzle.position.clone().normalize();
  const recoilNode = rig.recoil ?? rig.gun;
  recoilNode.position.copy(restPosition).addScaledVector(direction, -recoil);
}

export function advanceRunningGear(rig: TankRig, travelled: number): void {
  const rotationDirection = rig.wheelAxis === 'x' ? 1 : -1;
  for (const wheel of rig.wheels) {
    const radius = rollingRadius(wheel, rig.wheelRadius * 0.85);
    wheel.rotation[rig.wheelAxis] += rotationDirection * (travelled / radius);
  }
  for (const idler of rig.idlers) {
    const radius = rollingRadius(idler, rig.wheelRadius * 0.65);
    idler.rotation[rig.wheelAxis] += rotationDirection * (travelled / radius);
  }
  for (const sprocket of rig.sprockets) {
    const radius = rollingRadius(sprocket, rig.wheelRadius * 0.9);
    sprocket.rotation[rig.wheelAxis] +=
      rotationDirection * (travelled / radius);
  }
  for (const roller of rig.returnRollers) {
    const radius = rollingRadius(roller, 0.14);
    roller.rotation[rig.wheelAxis] += rotationDirection * (travelled / radius);
  }
  for (const texture of rig.trackTextures) {
    const axis = texture.userData.scrollAxis === 'x' ? 'x' : 'y';
    texture.offset[axis] -= travelled * 0.25;
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
