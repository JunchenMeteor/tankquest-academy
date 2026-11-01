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
  BufferGeometry,
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

const armorParts = [];
const steelParts = [];
const trackParts = [];

const hullWidth = 3.6;
const hullDepth = 6.4;
const floor = 0.34;

/* Hull: lower box, upper box and sloped front and rear plates. */
armorParts.push(
  place(new BoxGeometry(hullWidth * 0.94, 0.62, hullDepth * 0.94), [
    0,
    floor + 0.31,
    0,
  ]),
  place(new BoxGeometry(hullWidth, 0.72, hullDepth), [0, floor + 0.98, 0]),
  place(
    new BoxGeometry(hullWidth * 0.99, 0.8, 0.18),
    [0, floor + 1.02, hullDepth / 2 + 0.02],
    [-0.62, 0, 0]
  ),
  place(
    new BoxGeometry(hullWidth * 0.96, 0.92, 0.16),
    [0, floor + 1.0, -hullDepth / 2 - 0.03],
    [0.52, 0, 0]
  )
);

/* Fenders and engine deck. */
for (const side of [-1, 1]) {
  armorParts.push(
    place(new BoxGeometry(0.46, 0.08, hullDepth * 0.94), [
      side * (hullWidth / 2 + 0.2),
      floor + 1.28,
      0,
    ])
  );
}

/* Turret: tapered drum, roof, collar, mantlet, cupola and basket. */
const turretY = floor + 1.34 + 0.28;
const turretArmorParts = [];
const turretSteelParts = [];
const hullArmorParts = armorParts;
const hullSteelParts = steelParts;
turretArmorParts.push(
  place(new CylinderGeometry(1.0, 1.2, 0.56, 24), [0, turretY, 0]),
  place(new CylinderGeometry(0.92, 1.02, 0.18, 24), [0, turretY + 0.36, 0]),
  place(new CylinderGeometry(0.72, 0.8, 0.16, 20), [0, turretY - 0.34, 0]),
  place(new BoxGeometry(0.4, 0.42, 0.5), [1.02, turretY + 0.02, 0]),
  place(new CylinderGeometry(0.22, 0.24, 0.24, 16), [
    -0.34,
    turretY + 0.5,
    0.26,
  ]),
  place(new BoxGeometry(0.5, 0.34, 0.56), [-0.98, turretY + 0.08, -0.34])
);

/* Gun: barrel, reinforcing collar and a slotted muzzle brake. */
const barrelLength = 2.6;
turretSteelParts.push(
  place(
    new CylinderGeometry(0.085, 0.1, barrelLength, 16),
    [1.02 + barrelLength / 2, turretY + 0.02, 0],
    [0, 0, Math.PI / 2]
  ),
  place(
    new CylinderGeometry(0.16, 0.16, 0.36, 14),
    [1.02 + barrelLength + 0.12, turretY + 0.02, 0],
    [0, 0, Math.PI / 2]
  ),
  place(
    new CylinderGeometry(0.12, 0.12, 0.4, 12),
    [1.02 + barrelLength * 0.35, turretY + 0.02, 0],
    [0, 0, Math.PI / 2]
  ),
  place(
    new CylinderGeometry(0.035, 0.035, 0.44, 8),
    [0.9, turretY + 0.18, -0.22],
    [0, 0, Math.PI / 2]
  )
);

/* Smoke dischargers. */
for (const side of [-1, 1]) {
  for (let index = 0; index < 4; index += 1) {
    turretSteelParts.push(
      place(
        new CylinderGeometry(0.05, 0.05, 0.22, 8),
        [0.42 + index * 0.1, turretY + 0.22, side * (0.66 + index * 0.05)],
        [0, 0, Math.PI / 2.6]
      )
    );
  }
}

/* Running gear: road wheels, sprockets, idlers and return rollers. */
const wheelRadius = 0.3;
const trackOffset = hullWidth / 2 + 0.2;
for (const side of [-1, 1]) {
  for (let index = -2; index <= 2; index += 1) {
    steelParts.push(
      place(
        new CylinderGeometry(wheelRadius, wheelRadius, 0.52, 20),
        [index * (hullDepth / 5.4), wheelRadius + 0.12, side * trackOffset],
        [Math.PI / 2, 0, 0]
      )
    );
  }
  for (const x of [hullDepth / 2 - 0.24, -hullDepth / 2 + 0.24]) {
    steelParts.push(
      place(
        new CylinderGeometry(wheelRadius * 0.92, wheelRadius * 0.92, 0.5, 16),
        [x, wheelRadius + 0.1, side * trackOffset],
        [Math.PI / 2, 0, 0]
      )
    );
  }
  for (const x of [-hullDepth / 3.2, 0, hullDepth / 3.2]) {
    steelParts.push(
      place(
        new CylinderGeometry(0.14, 0.14, 0.42, 10),
        [x, 0.86, side * trackOffset],
        [Math.PI / 2, 0, 0]
      )
    );
  }
}

/* Track band: individual links walked along a stadium path. */
{
  const radius = 0.36;
  const straight = hullDepth / 2 + 0.02 - radius;
  const perimeter = straight * 4 + Math.PI * 2 * radius;
  const links = 96;
  for (const side of [-1, 1]) {
    for (let index = 0; index < links; index += 1) {
      const distance = (index / links) * perimeter;
      let x = 0;
      let y = 0;
      let angle = 0;
      if (distance < straight * 2) {
        x = -straight + distance;
        y = -radius;
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
          new BoxGeometry(0.2, 0.08, 0.58),
          [x, y + 0.42, side * trackOffset],
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
const sceneNodes = [];

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
          attributes: { POSITION: positionAccessor, NORMAL: normalAccessor },
          indices: indexAccessor,
          material: materialIndex,
        },
      ],
    });
  }
  sceneNodes.push(sceneNodes.length);
  sceneNodes.length = sceneNodes.length;
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
