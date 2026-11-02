import { Box3, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { Object3D } from 'three';

/** Bump this when the GLB changes so cached copies are refetched. */
export const tankAssetVersion = 'v2-quaternius';
export const tankAssetUrl = `/models/tank.glb?v=${tankAssetVersion}`;
const cacheName = `tankquest-models-${tankAssetVersion}`;

export interface TankAsset {
  /** Whole scene, already scaled and centred; used as the hull root. */
  hull: Object3D;
  /** Turret node inside the scene, or the scene itself when there is none. */
  turret: Object3D;
  /** Turret node name, so clones can find their own. */
  turretName: string | null;
}

export interface PaintedTank {
  root: Group;
  turret: Object3D;
}

let pending: Promise<TankAsset> | null = null;

export function loadTankAsset(): Promise<TankAsset> {
  pending ??= fetchTankAsset().catch((error: unknown) => {
    pending = null;
    throw error;
  });
  return pending;
}

async function fetchTankAsset(): Promise<TankAsset> {
  const { GLTFLoader } =
    await import('three/examples/jsm/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  const data = await readCached(tankAssetUrl);
  const gltf = await loader.parseAsync(data, '');
  normalise(gltf.scene);
  const turret = findNode(gltf.scene, /turret|tower/i);
  return {
    hull: gltf.scene,
    turret: turret ?? gltf.scene,
    turretName: turret ? turret.name : null,
  };
}

function findNode(root: Object3D, pattern: RegExp): Object3D | null {
  let match: Object3D | null = null;
  root.traverse((child) => {
    if (!match && child.name && pattern.test(child.name)) match = child;
  });
  return match;
}

/** Scales the scene so the tank is `length` units long and rests on the ground. */
export function normalise(scene: Object3D, length = 6): void {
  /* The artist exports the barrel toward -X; the game drives along +X. */
  scene.rotation.y = Math.PI;
  scene.updateMatrixWorld(true);
  /* Match the procedural footprint, barrel included. */
  const box = new Box3().setFromObject(scene);
  const size = box.getSize(new Vector3());
  const horizontal = Math.max(size.x, size.z) || 1;
  scene.scale.multiplyScalar(length / horizontal);
  /* A gentle lift: the raw model is flatter than the procedural hull. */
  scene.scale.y *= 1.35;
  scene.updateMatrixWorld(true);

  const scaled = new Box3().setFromObject(scene);
  const centre = scaled.getCenter(new Vector3());
  scene.position.x -= centre.x;
  scene.position.z -= centre.z;
  scene.position.y -= scaled.min.y;
  scene.updateMatrixWorld(true);
}

async function readCached(url: string): Promise<ArrayBuffer> {
  try {
    if (typeof caches !== 'undefined') {
      const cache = await caches.open(cacheName);
      const hit = await cache.match(url);
      if (hit) return hit.arrayBuffer();
      const response = await fetch(url);
      if (!response.ok) throw new Error(`tank asset ${response.status}`);
      await cache.put(url, response.clone());
      return response.arrayBuffer();
    }
  } catch {
    /* Private mode or a blocked cache still gets a plain fetch below. */
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`tank asset ${response.status}`);
  return response.arrayBuffer();
}

/** Clones the asset, tints armour materials and hands back the turret to spin. */
export function paintTank(asset: TankAsset, color: number): PaintedTank {
  const root = asset.hull.clone(true);
  const turret = asset.turretName
    ? (root.getObjectByName(asset.turretName) ?? root)
    : root;
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const material = Array.isArray(child.material)
      ? child.material[0]
      : child.material;
    if (!(material instanceof MeshStandardMaterial)) return;
    const clone = material.clone();
    clone.vertexColors = child.geometry.hasAttribute('color');
    if (/^main$/i.test(material.name ?? '')) {
      clone.color.setHex(color);
    }
    child.material = clone;
  });
  const group = new Group();
  group.add(root);
  return { root: group, turret };
}
