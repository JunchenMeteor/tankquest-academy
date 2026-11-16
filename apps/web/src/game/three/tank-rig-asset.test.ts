import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface GltfNode {
  name?: string;
  mesh?: number;
  children?: number[];
}

interface GltfAsset {
  nodes: GltfNode[];
  meshes: { primitives: { indices: number }[] }[];
  images: { mimeType?: string }[];
  extensionsRequired?: string[];
}

function load(role: 'scout' | 'medium' | 'heavy') {
  const path = new URL(
    `../../../public/models/tank-${role}.glb`,
    import.meta.url
  );
  const data = readFileSync(path);
  const jsonLength = data.readUInt32LE(12);
  const gltf = JSON.parse(
    data.subarray(20, 20 + jsonLength).toString('utf8')
  ) as GltfAsset;
  const parents = new Map<number, number>();
  gltf.nodes.forEach((node, parent) => {
    for (const child of node.children ?? []) parents.set(child, parent);
  });
  return { gltf, parents, bytes: statSync(path).size };
}

function nodeIndex(asset: GltfAsset, name: string): number {
  const index = asset.nodes.findIndex((node) => node.name === name);
  expect(index, `missing node ${name}`).toBeGreaterThanOrEqual(0);
  return index;
}

function regionOf(
  asset: GltfAsset,
  parents: Map<number, number>,
  name: string
): string {
  let current: number | undefined = nodeIndex(asset, name);
  while (current !== undefined) {
    const node = asset.nodes[current]!;
    if (node.name === 'GunPivot') return 'gun';
    if (node.name === 'TurretPivot') return 'turret';
    if (node.name === 'Hull') return 'hull';
    current = parents.get(current);
  }
  throw new Error(`${name} is outside the tank rig`);
}

describe.each(['scout', 'medium', 'heavy'] as const)(
  '%s tank asset',
  (role) => {
    const { gltf, parents, bytes } = load(role);

    it('keeps the articulated rig and one uniquely named wheel set', () => {
      for (const name of ['Hull', 'TurretPivot', 'GunPivot', 'Muzzle']) {
        nodeIndex(gltf, name);
      }
      expect(regionOf(gltf, parents, 'Turret_229')).toBe('turret');
      expect(regionOf(gltf, parents, 'Barrel_Cannon_13')).toBe('gun');
      const wheels = gltf.nodes.filter((node) =>
        /^Wheel_[LR]_\d\d$/.test(node.name ?? '')
      );
      expect(wheels).toHaveLength(14);
      expect(new Set(wheels.map((node) => node.name)).size).toBe(14);
      for (const wheel of wheels) {
        expect(regionOf(gltf, parents, wheel.name!)).toBe('hull');
      }
    });

    it('uses Draco geometry within the 3 MB budget', () => {
      expect(gltf.extensionsRequired).toContain('KHR_draco_mesh_compression');
      expect(bytes).toBeLessThanOrEqual(3 * 1024 * 1024);
    });

    if (role !== 'scout') {
      it('retains WebP PBR maps', () => {
        expect(gltf.images.length).toBeGreaterThan(0);
        expect(
          gltf.images.every((image) => image.mimeType === 'image/webp')
        ).toBe(true);
      });
    }
  }
);
