/* eslint-disable no-undef */
/**
 * Builds the GLB tank asset used by the medium and high quality tiers.
 *
 * The geometry is generated here instead of being downloaded so the repository
 * carries no third-party model licence. Swap `out` for an artist-made file later
 * and the runtime loader picks it up unchanged.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BoxGeometry,
  BufferAttribute,
  CylinderGeometry,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const out = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../apps/web/public/models/tank.glb'
);

/** Places a geometry with a translation and optional Euler rotation. */
function place(geometry, translate, rotate = [0, 0, 0]) {
  const matrix = new Matrix4();
  const rotation = new Quaternion();
  const [rx, ry, rz] = rotate;
  if (rx || ry || rz) {
    const sx = Math.sin(rx / 2);
    const cx = Math.cos(rx / 2);
    const sy = Math.sin(ry / 2);
    const cy = Math.cos(ry / 2);
    const sz = Math.sin(rz / 2);
    const cz = Math.cos(rz / 2);
    rotation.set(
      sx * cy * cz + cx * sy * sz,
      cx * sy * cz - sx * cy * sz,
      cx * cy * sz + sx * sy * cz,
      cx * cy * cz - sx * sy * sz
    );
  }
  matrix.compose(
    new Vector3(translate[0], translate[1], translate[2]),
    rotation,
    new Vector3(1, 1, 1)
  );
  const cloned = geometry.clone();
  cloned.applyMatrix4(matrix);
  cloned.deleteAttribute('uv');
  return cloned;
}

/* Hull matches PLAYER_HULL: 3.6 long (x), 1.05 tall, 2.1 wide (z). */
const hullLength = 3.6;
const hullWidth = 2.1;
const hullHeight = 1.05;
const floor = 0.34;

const hullArmorParts = [];
const hullSteelParts = [];
const trackParts = [];
const turretArmorParts = [];
const turretSteelParts = [];

/* Lower hull, upper hull and sloped front and rear plates. */
hullArmorParts.push(
  place(
    new BoxGeometry(hullLength * 0.9, hullHeight * 0.45, hullWidth * 0.92),
    [0, floor + hullHeight * 0.22, 0]
  ),
  place(new BoxGeometry(hullLength, hullHeight * 0.55, hullWidth), [
    0,
    floor + hullHeight * 0.72,
    0,
  ]),
  place(
    new BoxGeometry(0.16, hullHeight * 0.8, hullWidth * 0.99),
    [hullLength / 2 + 0.04, floor + hullHeight * 0.66, 0],
    [0, 0, -0.62]
  ),
  place(
    new BoxGeometry(0.14, hullHeight * 0.82, hullWidth * 0.96),
    [-hullLength / 2 - 0.03, floor + hullHeight * 0.62, 0],
    [0, 0, 0.5]
  )
);

/* Fenders over the tracks. */
for (const side of [-1, 1]) {
  hullArmorParts.push(
    place(new BoxGeometry(hullLength * 0.92, 0.07, 0.4), [
      0,
      floor + hullHeight * 0.9,
      side * (hullWidth / 2 + 0.16),
    ])
  );
}

/* Turret: tapered drum, roof, collar, mantlet, cupola and stowage basket. */
const turretY = floor + hullHeight * 1.02 + 0.26;
turretArmorParts.push(
  place(new CylinderGeometry(0.92, 1.06, 0.5, 22), [0, turretY, 0]),
  place(new CylinderGeometry(0.84, 0.94, 0.16, 22), [0, turretY + 0.32, 0]),
  place(new CylinderGeometry(0.66, 0.74, 0.14, 18), [0, turretY - 0.3, 0]),
  place(new BoxGeometry(0.34, 0.36, 0.46), [0.92, turretY + 0.01, 0]),
  place(new CylinderGeometry(0.2, 0.22, 0.22, 14), [
    -0.3,
    turretY + 0.44,
    0.22,
  ]),
  place(new BoxGeometry(0.44, 0.3, 0.5), [-0.86, turretY + 0.06, -0.3])
);

/* Gun: barrel, reinforcing collar and a slotted muzzle brake. */
const barrelLength = 2.6;
turretSteelParts.push(
  place(
    new CylinderGeometry(0.075, 0.095, barrelLength, 16),
    [0.92 + barrelLength / 2, turretY + 0.01, 0],
    [0, 0, Math.PI / 2]
  ),
  place(
    new CylinderGeometry(0.14, 0.14, 0.34, 14),
    [0.92 + barrelLength + 0.12, turretY + 0.01, 0],
    [0, 0, Math.PI / 2]
  ),
  place(
    new CylinderGeometry(0.11, 0.11, 0.36, 12),
    [0.92 + barrelLength * 0.4, turretY + 0.01, 0],
    [0, 0, Math.PI / 2]
  ),
  place(
    new CylinderGeometry(0.032, 0.032, 0.4, 8),
    [0.8, turretY + 0.16, -0.2],
    [0, 0, Math.PI / 2]
  )
);

/* Smoke dischargers on the turret cheeks. */
for (const side of [-1, 1]) {
  for (let index = 0; index < 4; index += 1) {
    turretSteelParts.push(
      place(
        new CylinderGeometry(0.045, 0.045, 0.2, 8),
        [0.36 + index * 0.09, turretY + 0.2, side * (0.6 + index * 0.04)],
        [0, 0, Math.PI / 2.6]
      )
    );
  }
}

/* Running gear: five road wheels, a sprocket, an idler and return rollers. */
const wheelRadius = 0.29;
const trackOffset = hullWidth / 2 + 0.19;
for (const side of [-1, 1]) {
  for (let index = -2; index <= 2; index += 1) {
    hullSteelParts.push(
      place(
        new CylinderGeometry(wheelRadius, wheelRadius, 0.5, 20),
        [index * (hullLength / 5.6), wheelRadius + 0.1, side * trackOffset],
        [Math.PI / 2, 0, 0]
      )
    );
  }
  for (const x of [hullLength / 2 - 0.16, -hullLength / 2 + 0.16]) {
    hullSteelParts.push(
      place(
        new CylinderGeometry(wheelRadius * 0.9, wheelRadius * 0.9, 0.48, 16),
        [x, wheelRadius + 0.08, side * trackOffset],
        [Math.PI / 2, 0, 0]
      )
    );
  }
  for (const x of [-hullLength / 3.4, 0, hullLength / 3.4]) {
    hullSteelParts.push(
      place(
        new CylinderGeometry(0.13, 0.13, 0.4, 10),
        [x, 0.78, side * trackOffset],
        [Math.PI / 2, 0, 0]
      )
    );
  }
}

/* Track band: individual links walked along a stadium path. */
{
  const radius = 0.33;
  const straight = hullLength / 2 + 0.02 - radius;
  const perimeter = straight * 4 + Math.PI * 2 * radius;
  const links = 88;
  for (const side of [-1, 1]) {
    for (let index = 0; index < links; index += 1) {
      const distance = (index / links) * perimeter;
      let x;
      let y;
      let angle;
      if (distance < straight * 2) {
        x = -straight + distance;
        y = -radius;
        angle = 0;
      } else if (distance < straight * 2 + Math.PI * radius) {
        const phase = -Math.PI / 2 + (distance - straight * 2) / radius;
        x = straight + radius * Math.cos(phase);
        y = radius * Math.sin(phase);
        angle = phase + Math.PI / 2;
      } else if (distance < straight * 4 + Math.PI * radius) {
        x = straight - (distance - straight * 2 - Math.PI * radius);
        y = radius;
        angle = Math.PI;
      } else {
        const phase =
          Math.PI / 2 + (distance - straight * 4 - Math.PI * radius) / radius;
        x = -straight + radius * Math.cos(phase);
        y = radius * Math.sin(phase);
        angle = phase + Math.PI / 2;
      }
      trackParts.push(
        place(
          new BoxGeometry(0.19, 0.075, 0.54),
          [x, y + 0.4, side * trackOffset],
          [0, 0, angle]
        )
      );
    }
  }
}

const armorMaterial = {
  name: 'armor',
  color: [0.42, 0.52, 0.58, 1],
  roughness: 0.58,
  metallic: 0.42,
};
const steelMaterial = {
  name: 'steel',
  color: [0.26, 0.29, 0.3, 1],
  roughness: 0.45,
  metallic: 0.85,
};
const trackMaterial = {
  name: 'track',
  color: [0.13, 0.15, 0.15, 1],
  roughness: 0.82,
  metallic: 0.55,
};

/* Two nodes: the hull and the turret, so the gun can traverse at runtime. */
const nodes = [
  {
    name: 'hull',
    groups: [
      { ...armorMaterial, geometries: hullArmorParts },
      { ...steelMaterial, geometries: hullSteelParts },
      { ...trackMaterial, geometries: trackParts },
    ],
  },
  {
    name: 'turret',
    groups: [
      { ...armorMaterial, geometries: turretArmorParts },
      { ...steelMaterial, geometries: turretSteelParts },
    ],
  },
];

/* ---- glTF assembly -------------------------------------------------- */

const bufferChunks = [];
let byteLength = 0;

function align4(value) {
  return (value + 3) & ~3;
}

function pushBuffer(arrayBuffer) {
  const padding = align4(byteLength) - byteLength;
  if (padding > 0) {
    bufferChunks.push(Buffer.alloc(padding));
    byteLength += padding;
  }
  const chunk = Buffer.from(arrayBuffer);
  const offset = byteLength;
  bufferChunks.push(chunk);
  byteLength += chunk.length;
  return offset;
}

const accessors = [];
const bufferViews = [];
const meshes = [];
const materials = [];

for (const node of nodes) {
  const nodeMeshes = [];
  const pivot = node.name === 'turret' ? turretY : 0;
  for (const group of node.groups) {
    const merged = mergeGeometries(group.geometries, false);
    if (!merged) throw new Error(`could not merge ${node.name}/${group.name}`);
    if (pivot !== 0) {
      const shift = new Matrix4().makeTranslation(0, -pivot, 0);
      merged.applyMatrix4(shift);
    }

    /* Bake a little grime per vertex: darker near the ground, mottled overall. */
    const positions = merged.getAttribute('position');
    const colors = new Float32Array(positions.count * 3);
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const y = positions.getY(index);
      const z = positions.getZ(index);
      const noise =
        Math.sin(x * 4.1 + z * 2.7) * Math.cos(y * 5.3 - x * 1.9) * 0.5 + 0.5;
      const dirt = 0.78 + noise * 0.16 + Math.min(0.1, y * 0.03);
      colors[index * 3] = dirt;
      colors[index * 3 + 1] = dirt;
      colors[index * 3 + 2] = dirt;
    }
    merged.setAttribute('color', new BufferAttribute(colors, 3));
    merged.computeVertexNormals();
    merged.computeBoundingBox();

    const position = merged.getAttribute('position');
    const normal = merged.getAttribute('normal');
    const index = merged.getIndex();

    const positionView = pushBuffer(position.array.buffer.slice(0));
    bufferViews.push({
      buffer: 0,
      byteOffset: positionView,
      byteLength: position.array.byteLength,
      target: 34962,
    });
    accessors.push({
      bufferView: bufferViews.length - 1,
      componentType: 5126,
      count: position.count,
      type: 'VEC3',
      min: [
        merged.boundingBox.min.x,
        merged.boundingBox.min.y,
        merged.boundingBox.min.z,
      ],
      max: [
        merged.boundingBox.max.x,
        merged.boundingBox.max.y,
        merged.boundingBox.max.z,
      ],
    });
    const positionAccessor = accessors.length - 1;

    const color = merged.getAttribute('color');
    const colorView = pushBuffer(color.array.buffer.slice(0));
    bufferViews.push({
      buffer: 0,
      byteOffset: colorView,
      byteLength: color.array.byteLength,
      target: 34962,
    });
    accessors.push({
      bufferView: bufferViews.length - 1,
      componentType: 5126,
      count: color.count,
      type: 'VEC3',
    });
    const colorAccessor = accessors.length - 1;

    const normalView = pushBuffer(normal.array.buffer.slice(0));
    bufferViews.push({
      buffer: 0,
      byteOffset: normalView,
      byteLength: normal.array.byteLength,
      target: 34962,
    });
    accessors.push({
      bufferView: bufferViews.length - 1,
      componentType: 5126,
      count: normal.count,
      type: 'VEC3',
    });
    const normalAccessor = accessors.length - 1;

    const indexView = pushBuffer(index.array.buffer.slice(0));
    bufferViews.push({
      buffer: 0,
      byteOffset: indexView,
      byteLength: index.array.byteLength,
      target: 34963,
    });
    accessors.push({
      bufferView: bufferViews.length - 1,
      componentType: 5123,
      count: index.count,
      type: 'SCALAR',
    });
    const indexAccessor = accessors.length - 1;

    const materialIndex =
      materials.push({
        name: group.name,
        pbrMetallicRoughness: {
          baseColorFactor: group.color,
          metallicFactor: group.metallic,
          roughnessFactor: group.roughness,
        },
      }) - 1;

    nodeMeshes.push(meshes.length);
    meshes.push({
      name: `${node.name}-${group.name}`,
      primitives: [
        {
          attributes: {
            POSITION: positionAccessor,
            NORMAL: normalAccessor,
            COLOR_0: colorAccessor,
          },
          indices: indexAccessor,
          material: materialIndex,
        },
      ],
    });
  }
  node.meshes = nodeMeshes;
}

/** The turret pivot height, baked out of its geometry above. */
function pivotOf(node) {
  return node.name === 'turret' ? turretY : 0;
}

/* glTF node references are indices: group nodes first, then mesh nodes. */
const groupNodes = [];
const meshNodes = [];
let nextIndex = nodes.length;
for (const node of nodes) {
  const children = [];
  for (const meshIndex of node.meshes) {
    children.push(nextIndex);
    meshNodes.push({ name: `mesh-${meshIndex}`, mesh: meshIndex });
    nextIndex += 1;
  }
  groupNodes.push(
    pivotOf(node) === 0
      ? { name: node.name, children }
      : { name: node.name, children, translation: [0, pivotOf(node), 0] }
  );
}

const gltf = {
  asset: { version: '2.0', generator: 'tankquest-tank-builder' },
  scene: 0,
  scenes: [{ nodes: groupNodes.map((_, index) => index) }],
  nodes: [...groupNodes, ...meshNodes],
  meshes,
  materials,
  accessors,
  bufferViews,
  buffers: [{ byteLength }],
};

const json = Buffer.from(JSON.stringify(gltf), 'utf8');
const jsonPadding = align4(json.length) - json.length;
const jsonChunk = Buffer.concat([json, Buffer.alloc(jsonPadding, 0x20)]);
const binPadding = align4(byteLength) - byteLength;
const binChunk = Buffer.concat([...bufferChunks, Buffer.alloc(binPadding, 0)]);

const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);

const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(jsonChunk.length, 0);
jsonHeader.writeUInt32LE(0x4e4f534a, 4);

const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(binChunk.length, 0);
binHeader.writeUInt32LE(0x004e4942, 4);

const glb = Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]);
await mkdir(dirname(out), { recursive: true });
await writeFile(out, glb);
console.log(`wrote ${out} (${(glb.length / 1024).toFixed(1)} KB)`);
