import { readFileSync, statSync } from 'node:fs';
import { Object3D, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

interface GltfNode {
  name?: string;
  mesh?: number;
  children?: number[];
  translation?: [number, number, number];
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
}

interface GltfAsset {
  nodes: GltfNode[];
  meshes: {
    primitives: { indices: number; attributes: { POSITION: number } }[];
  }[];
  accessors: { min?: number[]; max?: number[] }[];
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

function worldPosition(asset: GltfAsset, name: string): Vector3 {
  const scene = new Object3D();
  const nodes = asset.nodes.map((node) => {
    const object = new Object3D();
    object.name = node.name ?? '';
    if (node.translation) object.position.fromArray(node.translation);
    if (node.rotation) object.quaternion.fromArray(node.rotation);
    if (node.scale) object.scale.fromArray(node.scale);
    return object;
  });
  asset.nodes.forEach((node, index) => {
    for (const child of node.children ?? []) nodes[index]!.add(nodes[child]!);
  });
  nodes.forEach((node, index) => {
    if (!asset.nodes.some((parent) => parent.children?.includes(index))) {
      scene.add(node);
    }
  });
  scene.updateMatrixWorld(true);
  return scene.getObjectByName(name)!.getWorldPosition(new Vector3());
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
        /^Wheel_[LR]_\d\d(?:[AB])?$/.test(node.name ?? '')
      );
      const expectedWheelNodes = role === 'heavy' ? 20 : 14;
      expect(wheels).toHaveLength(expectedWheelNodes);
      expect(new Set(wheels.map((node) => node.name)).size).toBe(
        expectedWheelNodes
      );
      for (const wheel of wheels) {
        expect(regionOf(gltf, parents, wheel.name!)).toBe('hull');
      }
    });

    it('places the gun pivot at the turret connection and the muzzle at the tip', () => {
      const turret = worldPosition(gltf, 'TurretPivot');
      const gun = worldPosition(gltf, 'GunPivot');
      const muzzle = worldPosition(gltf, 'Muzzle');
      expect(gun.distanceTo(muzzle)).toBeGreaterThan(0.1);
      expect(gun.distanceTo(turret)).toBeLessThan(muzzle.distanceTo(turret));
      expect(muzzle.z).toBeGreaterThan(gun.z);
    });

    it('uses Draco geometry within the 3 MB budget', () => {
      expect(gltf.extensionsRequired).toContain('KHR_draco_mesh_compression');
      expect(bytes).toBeLessThanOrEqual(3 * 1024 * 1024);
    });

    if (role === 'scout') {
      it('uses the M24 running gear without a static combined tank', () => {
        expect(gltf.nodes.findIndex((node) => node.name === 'Tank_body')).toBe(
          -1
        );
        for (const side of ['L', 'R']) {
          for (let index = 0; index <= 6; index += 1) {
            nodeIndex(gltf, `Wheel_${side}_0${index}`);
          }
          for (let index = 0; index <= 2; index += 1) {
            nodeIndex(gltf, `ReturnRoller_${side}_0${index}`);
          }
        }
        const wheels = gltf.nodes.filter((node) =>
          /^(Wheel|ReturnRoller)_[LR]_\d\d$/.test(node.name ?? '')
        );
        expect(wheels).toHaveLength(20);
        for (const wheel of wheels) {
          expect(Math.abs(wheel.translation![0])).toBeGreaterThan(1);
          expect(Math.abs(wheel.translation![0])).toBeLessThan(1.5);
        }
      });

      it('keeps every M24 wheel mesh centred on its own axle', () => {
        const wheels = gltf.nodes.filter((node) =>
          /^Wheel_[LR]_\d\d$/.test(node.name ?? '')
        );
        for (const wheel of wheels) {
          const primitive = gltf.meshes[wheel.mesh!]!.primitives[0]!;
          const accessor = gltf.accessors[primitive.attributes.POSITION]!;
          const centre = accessor.min!.map(
            (value, index) => (value + accessor.max![index]!) / 2
          );
          expect(Math.hypot(...centre), wheel.name).toBeLessThan(0.0001);
        }
      });
    }

    if (role === 'medium') {
      it('keeps track-material fuel drums and fenders out of track animation', () => {
        expect(regionOf(gltf, parents, 'Gear_Hull_TrackMaterial')).toBe('hull');
        expect(
          gltf.nodes.findIndex((node) => node.name === 'Tracks_420_Hull')
        ).toBe(-1);
      });
    }

    if (role === 'heavy') {
      it('keeps every wheel mesh centred on its own axle', () => {
        const wheels = gltf.nodes.filter((node) =>
          /^Wheel_[LR]_\d\d(?:[AB])?$/.test(node.name ?? '')
        );
        for (const wheel of wheels) {
          const primitive = gltf.meshes[wheel.mesh!]!.primitives[0]!;
          const accessor = gltf.accessors[primitive.attributes.POSITION]!;
          const centre = accessor.min!.map(
            (value, index) => (value + accessor.max![index]!) / 2
          );
          expect(Math.hypot(...centre), wheel.name).toBeLessThan(0.0001);
        }
      });

      it('separates every interleaved road wheel onto its own axle', () => {
        for (const side of ['L', 'R']) {
          for (const suffix of [
            '01',
            '02A',
            '02B',
            '03A',
            '03B',
            '04A',
            '04B',
            '05',
          ]) {
            nodeIndex(gltf, `Wheel_${side}_${suffix}`);
          }
          for (const group of ['02', '03', '04']) {
            expect(
              gltf.nodes.findIndex(
                (node) => node.name === `Wheel_${side}_${group}`
              )
            ).toBe(-1);
          }
        }
      });

      it('articulates the outer mantlet and barrel around the trunnion axis', () => {
        expect(regionOf(gltf, parents, 'Gear_Gun_Mantlet')).toBe('gun');
        expect(regionOf(gltf, parents, 'Barrel_Cannon_13')).toBe('gun');
        expect(
          gltf.nodes.findIndex((node) => node.name === 'Gear_Turret_Mantlet')
        ).toBe(-1);
        const trunnion = worldPosition(gltf, 'GunPivot');
        expect(trunnion.x).toBeCloseTo(0, 4);
        expect(trunnion.y).toBeCloseTo(2.2748733, 5);
        expect(trunnion.z).toBeCloseTo(1.4601427, 5);
      });

      it('keeps the smoke launcher components on the rotating turret', () => {
        const launchers = gltf.nodes.filter((node) =>
          node.name?.startsWith('Gear_Turret_Smoke')
        );
        expect(launchers.length).toBeGreaterThan(0);
        for (const launcher of launchers) {
          expect(regionOf(gltf, parents, launcher.name!)).toBe('turret');
        }
      });

      it('recoils only the barrel and muzzle without translating the mantlet', () => {
        const recoil = nodeIndex(gltf, 'RecoilPivot');
        expect(parents.get(nodeIndex(gltf, 'Barrel_Cannon_13'))).toBe(recoil);
        expect(parents.get(nodeIndex(gltf, 'Muzzle'))).toBe(recoil);
        expect(parents.get(nodeIndex(gltf, 'Gear_Gun_Mantlet'))).toBe(
          nodeIndex(gltf, 'GunPivot')
        );
      });
    }

    it('retains WebP PBR maps', () => {
      expect(gltf.images.length).toBeGreaterThan(0);
      expect(
        gltf.images.every((image) => image.mimeType === 'image/webp')
      ).toBe(true);
    });
  }
);
