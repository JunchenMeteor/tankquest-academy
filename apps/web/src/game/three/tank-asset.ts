import { Box3, Color, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { BufferGeometry, Object3D } from 'three';
import {
  addRoadWheelFaceMarkers,
  tankRigFromScene,
  type TankRig,
} from './tank-rig.js';

export type TankModelRole = 'scout' | 'medium' | 'heavy';

/** Bump this when the GLB changes so cached copies are refetched. */
export const tankAssetVersion = 'v4';
const cacheName = `tankquest-models-${tankAssetVersion}`;
const pendingRigs = new Map<TankModelRole, Promise<TankRig>>();

export function pruneRedundantCombinedTank(root: Group): void {
  const combined = root.getObjectByName('Tank_body');
  if (
    combined &&
    root.getObjectByName('Hull_477') &&
    root.getObjectByName('Wheel_L_01')
  ) {
    combined.removeFromParent();
  }
}

export function loadTankRig(role: TankModelRole = 'medium'): Promise<TankRig> {
  let pending = pendingRigs.get(role);
  if (!pending) {
    pending = fetchTankRig(role).catch((error: unknown) => {
      pendingRigs.delete(role);
      throw error;
    });
    pendingRigs.set(role, pending);
  }
  return pending;
}

async function fetchTankRig(role: TankModelRole): Promise<TankRig> {
  const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
    import('three/examples/jsm/loaders/GLTFLoader.js'),
    import('three/examples/jsm/loaders/DRACOLoader.js'),
  ]);
  const draco = new DRACOLoader().setDecoderPath('/draco/');
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const data = await readCached(
    `/models/tank-${role}.glb?v=${tankAssetVersion}`
  );
  try {
    const gltf = await loader.parseAsync(data, '');
    pruneRedundantCombinedTank(gltf.scene);
    addRoadWheelFaceMarkers(gltf.scene);
    normalise(gltf.scene, gltf.scene.userData.l);
    return tankRigFromScene(gltf.scene);
  } finally {
    draco.dispose();
  }
}

/** Scales to the battle footprint and places the hull centre on the ground. */
export function normalise(root: Object3D, length = 6): void {
  const scaledWheelRadii = new Map<Object3D, number>();
  root.traverse((node) => {
    if (typeof node.userData.rollingRadius === 'number') {
      scaledWheelRadii.set(node, node.userData.rollingRadius);
    }
  });
  root.updateMatrixWorld(true);
  const box = new Box3().setFromObject(root);
  const size = box.getSize(new Vector3());
  const horizontal = Math.max(size.x, size.z) || 1;
  const normalised = new Group();
  normalised.name = 'model-normalised';
  normalised.add(...root.children);
  root.add(normalised);
  normalised.scale.multiplyScalar(length / horizontal);
  normalised.rotation.y = Math.PI / 2;
  for (const [node, radius] of scaledWheelRadii) {
    node.userData.rollingRadius = radius * normalised.scale.x;
  }
  root.updateMatrixWorld(true);

  const scaled = new Box3().setFromObject(root);
  const hull = root.getObjectByName('Hull') ?? root;
  const centre = new Box3().setFromObject(hull).getCenter(new Vector3());
  normalised.position.x -= centre.x;
  normalised.position.z -= centre.z;
  normalised.position.y -= scaled.min.y;
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

const cloneTextureSlots = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'emissiveMap',
] as const;

export function paintTankRig(
  asset: TankRig,
  color: number,
  secondaryColor = color
): TankRig {
  const root = asset.root.clone(true);
  const paintMaterial = (
    material: MeshStandardMaterial,
    vertexColors: boolean
  ) => {
    const clone = material.clone();
    clone.vertexColors = vertexColors;
    for (const slot of cloneTextureSlots) {
      const texture = clone[slot];
      if (texture) {
        clone[slot] = texture.clone();
        clone[slot].needsUpdate = true;
      }
    }
    const tint = (hex: number) => {
      if (clone.map) clone.color.lerp(new Color(hex), 0.2);
      else clone.color.setHex(hex);
    };
    if (
      /^(Hull_477|Turret_229|Applique_176|Cannon_13|SideSkirts_477|Material|Main|Body|body_lod1|turret_ring_lod1|ZenUV_Generic_Material.001|Turret|Gun)$/i.test(
        material.name
      )
    ) {
      tint(color);
    } else if (/^(Gear_980|Gear_24)$/i.test(material.name)) {
      tint(secondaryColor);
    }
    return clone;
  };
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const vertexColors = (child.geometry as BufferGeometry).hasAttribute(
      'color'
    );
    if (Array.isArray(child.material)) {
      child.material = child.material.map((material) =>
        paintMaterial(material, vertexColors)
      );
    } else if (child.material instanceof MeshStandardMaterial) {
      child.material = paintMaterial(child.material, vertexColors);
    }
  });
  return tankRigFromScene(root);
}
