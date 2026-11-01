import { Group, Mesh, MeshStandardMaterial, Object3D } from 'three';

/** Bump this when the GLB changes so cached copies are refetched. */
export const tankAssetVersion = 'v1';
export const tankAssetUrl = `/models/tank.glb?v=${tankAssetVersion}`;
const cacheName = `tankquest-models-${tankAssetVersion}`;

export interface TankAsset {
  hull: Object3D;
  turret: Object3D;
}

let pending: Promise<TankAsset> | null = null;

/**
 * Fetches the tank GLB once, keeps it in Cache Storage for repeat visits and
 * resolves to the two nodes the battle needs: hull and turret.
 */
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
  const hull = gltf.scene.getObjectByName('hull');
  const turret = gltf.scene.getObjectByName('turret');
  if (!hull || !turret) throw new Error('tank asset is missing its nodes');
  return { hull, turret };
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

export interface PaintedTank {
  root: Group;
  turret: Object3D;
}

/** Clones the asset and tints the armour, leaving tracks and steel alone. */
export function paintTank(asset: TankAsset, color: number): PaintedTank {
  const hull = asset.hull.clone(true);
  const turret = asset.turret.clone(true);
  for (const root of [hull, turret]) {
    root.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const material = Array.isArray(child.material)
        ? child.material[0]
        : child.material;
      if (!(material instanceof MeshStandardMaterial)) return;
      const clone = material.clone();
      if (material.name === 'armor') clone.color.setHex(color);
      child.material = clone;
    });
  }
  const root = new Group();
  root.add(hull, turret);
  return { root, turret };
}
