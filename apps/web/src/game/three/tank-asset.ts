import {
  Box3,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import type { BufferGeometry, Object3D } from 'three';

/** Bump this when the GLB changes so cached copies are refetched. */
export const tankAssetVersion = 'v4-pivot';
export const tankAssetUrl = `/models/tank.glb?v=${tankAssetVersion}`;
const cacheName = `tankquest-models-${tankAssetVersion}`;

export interface TankAsset {
  /** Clean group: hull meshes plus a turret pivot group. */
  root: Group;
  /** Turret pivot, already centred on the rotation axis. */
  turret: Group;
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
  const baked = bake(gltf.scene);
  normalise(baked.root);
  return baked;
}

function inTurret(node: Object3D, scene: Object3D): boolean {
  let current: Object3D | null = node;
  while (current && current !== scene) {
    if (/turret|gun|barrel/i.test(current.name)) return true;
    current = current.parent;
  }
  return false;
}

/**
 * Flattens the imported hierarchy.
 *
 * Artist exports often carry wild nested transforms (this one has a 2117x2415x352
 * turret scale), which makes rotating a node in place tear the model apart. Every
 * mesh is re-created with its world matrix baked into the geometry, then the parts
 * are regrouped into a plain hull and a turret pivot.
 */
export function bake(scene: Object3D): TankAsset {
  scene.updateMatrixWorld(true);
  const hullMeshes: Mesh[] = [];
  const turretMeshes: Mesh[] = [];

  scene.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const geometry = node.geometry.clone();
    geometry.applyMatrix4(node.matrixWorld);
    const mesh = new Mesh(geometry, node.material);
    (inTurret(node, scene) ? turretMeshes : hullMeshes).push(mesh);
  });

  const root = new Group();
  const hull = new Group();
  hull.name = 'hull';
  hull.add(...hullMeshes);
  root.add(hull);

  const turret = new Group();
  turret.name = 'turret-pivot';
  if (turretMeshes.length > 0) {
    /* Pivot on the turret drum, not on the gun sticking out of it. */
    const drum = turretMeshes.filter(
      (mesh) =>
        !/gun|barrel/i.test(mesh.name) &&
        !/gun|barrel/i.test(mesh.parent?.name ?? '')
    );
    const box = new Box3();
    for (const mesh of drum.length > 0 ? drum : turretMeshes) {
      box.expandByObject(mesh);
    }
    const centre = box.getCenter(new Vector3());
    centre.y = 0;
    const shift = new Matrix4().makeTranslation(-centre.x, 0, -centre.z);
    for (const mesh of turretMeshes) mesh.geometry.applyMatrix4(shift);
    turret.position.set(centre.x, 0, centre.z);
    turret.add(...turretMeshes);
    root.add(turret);
  }

  return { root, turret };
}

/** Scales to the battle footprint, faces the barrel forward and rests on the ground. */
export function normalise(root: Object3D, length = 6): void {
  root.updateMatrixWorld(true);
  const box = new Box3().setFromObject(root);
  const size = box.getSize(new Vector3());
  const horizontal = Math.max(size.x, size.z) || 1;
  root.scale.multiplyScalar(length / horizontal);
  root.scale.y *= 1.35;
  root.rotation.y = Math.PI;
  root.updateMatrixWorld(true);

  const scaled = new Box3().setFromObject(root);
  const centre = scaled.getCenter(new Vector3());
  root.position.x -= centre.x;
  root.position.z -= centre.z;
  root.position.y -= scaled.min.y;
  root.updateMatrixWorld(true);
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

/** Clones the asset, tints the armour and hands back the turret pivot to spin. */
export function paintTank(asset: TankAsset, color: number): PaintedTank {
  const root = asset.root.clone(true);
  const turret = root.getObjectByName('turret-pivot') ?? root;
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const material = Array.isArray(child.material)
      ? child.material[0]
      : child.material;
    if (!(material instanceof MeshStandardMaterial)) return;
    const clone = material.clone();
    clone.vertexColors = (child.geometry as BufferGeometry).hasAttribute(
      'color'
    );
    if (/^main$/i.test(material.name ?? '')) clone.color.setHex(color);
    child.material = clone;
  });
  return { root, turret };
}
