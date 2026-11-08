import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface GltfNode {
  name?: string;
  mesh?: number;
  children?: number[];
}

interface GltfAsset {
  nodes: GltfNode[];
  meshes: { primitives: { indices: number }[] }[];
  accessors: { count: number }[];
  images: { mimeType?: string }[];
  extensionsRequired?: string[];
}

const data = readFileSync(
  new URL('../../../public/models/tank.glb', import.meta.url)
);
const jsonLength = data.readUInt32LE(12);
const gltf = JSON.parse(
  data.subarray(20, 20 + jsonLength).toString('utf8')
) as GltfAsset;
const parents = new Map<number, number>();
gltf.nodes.forEach((node, parent) => {
  for (const child of node.children ?? []) parents.set(child, parent);
});

function nodeIndex(name: string): number {
  const index = gltf.nodes.findIndex((node) => node.name === name);
  expect(index, `missing node ${name}`).toBeGreaterThanOrEqual(0);
  return index;
}

function regionOf(name: string): string {
  let current: number | undefined = nodeIndex(name);
  while (current !== undefined) {
    const node = gltf.nodes[current]!;
    if (node.name === 'GunPivot') return 'gun';
    if (node.name === 'TurretPivot') return 'turret';
    if (node.name === 'Hull') return 'hull';
    current = parents.get(current);
  }
  throw new Error(`${name} is outside the tank rig`);
}

function triangleCount(name: string): number {
  const node = gltf.nodes[nodeIndex(name)]!;
  const mesh = gltf.meshes[node.mesh!]!;
  return mesh.primitives.reduce(
    (total, primitive) => total + gltf.accessors[primitive.indices]!.count / 3,
    0
  );
}

describe('authored tank GLB regions', () => {
  it.each([
    ['Applique_Hull', 'hull'],
    ['Gear_Hull', 'hull'],
    ['Glass_Hull', 'hull'],
    ['Hull_477', 'hull'],
    ['SideSkirts_477', 'hull'],
    ['Tracks_420', 'hull'],
    ['Applique_Turret', 'turret'],
    ['Gear_Turret', 'turret'],
    ['Glass_Turret', 'turret'],
    ['Turret_229', 'turret'],
    ['Gear_24', 'turret'],
    ['Barrel_Cannon_13', 'gun'],
    ['Glass_Gun', 'gun'],
  ])('keeps %s on the %s joint', (name, region) => {
    expect(regionOf(name)).toBe(region);
  });

  it('does not retain unsplit mixed-region meshes', () => {
    for (const name of ['Applique_176', 'Gear_980', 'Glass_13']) {
      expect(gltf.nodes.some((node) => node.name === name)).toBe(false);
    }
  });

  it.each([
    ['Applique_Hull', 2899],
    ['Applique_Turret', 1960],
    ['Gear_Hull', 336],
    ['Gear_Turret', 1186],
    ['Glass_Hull', 103],
    ['Glass_Turret', 32],
    ['Glass_Gun', 6],
  ])('preserves every face in %s', (name, expected) => {
    expect(triangleCount(name)).toBe(expected);
  });

  it('keeps Draco geometry and WebP textures', () => {
    expect(gltf.extensionsRequired).toContain('KHR_draco_mesh_compression');
    expect(gltf.images.length).toBeGreaterThan(0);
    expect(gltf.images.every((image) => image.mimeType === 'image/webp')).toBe(
      true
    );
  });
});
