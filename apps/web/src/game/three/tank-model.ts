import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector2,
  Vector3,
} from 'three';

import type { TankPlacement } from './battle-scene-model.js';
import { createTankTextures, type TankTextures } from './tank-textures.js';

let sharedTextures: TankTextures | null = null;

/** One set of painted textures is shared by every tank. */
function tankTextures(): TankTextures | null {
  if (typeof document === 'undefined') return null;
  sharedTextures ??= createTankTextures();
  return sharedTextures;
}

const TRACK_COLOR = 0x23282a;
const STEEL_COLOR = 0x4b5357;

interface TankMaterials {
  armor: MeshStandardMaterial;
  armorDark: MeshStandardMaterial;
  steel: MeshStandardMaterial;
  track: MeshStandardMaterial;
  rubber: MeshStandardMaterial;
  glass: MeshStandardMaterial;
}

function materialsFor(color: number): TankMaterials {
  const textures = tankTextures();
  return {
    armor: new MeshStandardMaterial({
      color,
      roughness: 0.58,
      metalness: 0.42,
      map: textures?.map ?? null,
      roughnessMap: textures?.roughnessMap ?? null,
      normalMap: textures?.normalMap ?? null,
      normalScale: new Vector2(0.7, 0.7),
    }),
    armorDark: new MeshStandardMaterial({
      color: new MeshStandardMaterial({ color }).color
        .clone()
        .multiplyScalar(0.72),
      roughness: 0.7,
      metalness: 0.36,
    }),
    steel: new MeshStandardMaterial({
      color: STEEL_COLOR,
      roughness: 0.45,
      metalness: 0.85,
    }),
    track: new MeshStandardMaterial({
      color: TRACK_COLOR,
      roughness: 0.82,
      metalness: 0.55,
      map: textures?.map ?? null,
      roughnessMap: textures?.roughnessMap ?? null,
      normalMap: textures?.normalMap ?? null,
      normalScale: new Vector2(1, 1),
    }),
    rubber: new MeshStandardMaterial({ color: 0x161a1b, roughness: 0.95 }),
    glass: new MeshStandardMaterial({
      color: 0x223038,
      roughness: 0.15,
      metalness: 0.9,
    }),
  };
}

/** Stadium-shaped track path, walked to place individual links. */
function trackPath(
  halfLength: number,
  radius: number,
  samples: number
): Array<{ x: number; y: number; angle: number }> {
  const straight = Math.max(0.2, halfLength - radius);
  const perimeter = straight * 4 + Math.PI * 2 * radius;
  const points: Array<{ x: number; y: number; angle: number }> = [];

  for (let index = 0; index < samples; index += 1) {
    const distance = (index / samples) * perimeter;
    if (distance < straight * 2) {
      points.push({ x: -straight + distance, y: -radius, angle: 0 });
      continue;
    }
    if (distance < straight * 2 + Math.PI * radius) {
      const phase = -Math.PI / 2 + (distance - straight * 2) / radius;
      points.push({
        x: straight + radius * Math.cos(phase),
        y: radius * Math.sin(phase),
        angle: phase + Math.PI / 2,
      });
      continue;
    }
    if (distance < straight * 4 + Math.PI * radius) {
      points.push({
        x: straight - (distance - straight * 2 - Math.PI * radius),
        y: radius,
        angle: Math.PI,
      });
      continue;
    }
    const phase =
      Math.PI / 2 + (distance - straight * 4 - Math.PI * radius) / radius;
    points.push({
      x: -straight + radius * Math.cos(phase),
      y: radius * Math.sin(phase),
      angle: phase + Math.PI / 2,
    });
  }
  return points;
}

function addRoadWheels(
  group: Group,
  materials: TankMaterials,
  hullDepth: number,
  trackOffset: number,
  wheelRadius: number
): Group[] {
  const wheelGeometry = new CylinderGeometry(
    wheelRadius,
    wheelRadius,
    0.5,
    20,
    1
  );
  const hubGeometry = new CylinderGeometry(
    wheelRadius * 0.55,
    wheelRadius * 0.55,
    0.54,
    14
  );
  const positions = [-2, -1, 0, 1, 2].map((index) => index * (hullDepth / 5.4));

  const wheels: Group[] = [];
  for (const z of [-trackOffset, trackOffset]) {
    for (const x of positions) {
      const holder = new Group();
      holder.position.set(x, wheelRadius + 0.04, z);
      wheels.push(holder);

      const wheel = new Mesh(wheelGeometry, materials.rubber);
      wheel.rotation.x = Math.PI / 2;
      wheel.castShadow = true;
      holder.add(wheel);

      const hub = new Mesh(hubGeometry, materials.steel);
      hub.rotation.x = Math.PI / 2;
      holder.add(hub);
      group.add(holder);
    }

    /* Sprocket at the back, idler at the front, return rollers on top. */
    const sprocket = new Mesh(
      new CylinderGeometry(wheelRadius * 0.92, wheelRadius * 0.92, 0.46, 12),
      materials.steel
    );
    sprocket.rotation.x = Math.PI / 2;
    sprocket.position.set(hullDepth / 2 - 0.2, wheelRadius + 0.02, z);
    sprocket.castShadow = true;
    group.add(sprocket);

    const idler = sprocket.clone();
    idler.position.x = -hullDepth / 2 + 0.2;
    group.add(idler);

    for (const x of [-hullDepth / 3.2, 0, hullDepth / 3.2]) {
      const roller = new Mesh(
        new CylinderGeometry(0.14, 0.14, 0.4, 10),
        materials.steel
      );
      roller.rotation.x = Math.PI / 2;
      roller.position.set(x, 0.72, z);
      group.add(roller);
    }
  }
  return wheels;
}

function addTrackBand(
  group: Group,
  materials: TankMaterials,
  hullDepth: number,
  trackOffset: number
): void {
  const radius = 0.34;
  const halfLength = hullDepth / 2 + 0.16;
  const links = 44;
  const linkGeometry = new BoxGeometry(0.19, 0.075, 0.56);
  for (const z of [-trackOffset, trackOffset]) {
    const path = trackPath(halfLength, radius, links);
    for (const point of path) {
      const link = new Mesh(linkGeometry, materials.track);
      link.position.set(point.x, point.y + radius * 0.02, z);
      link.rotation.z = point.angle;
      link.castShadow = true;
      group.add(link);
    }
  }
}

function addTurretGroups(
  placement: TankPlacement,
  materials: TankMaterials
): { turret: Group; gunGroup: Group } {
  const turretGroup = new Group();
  const radius = placement.turretRadius;

  /* Cast turret: a tapered drum with a rounded roof, like a real casting. */
  const drum = new Mesh(
    new CylinderGeometry(radius * 0.94, radius * 1.12, 0.5, 18),
    materials.armor
  );
  drum.castShadow = true;
  drum.receiveShadow = true;
  turretGroup.add(drum);

  const roof = new Mesh(
    new CylinderGeometry(radius * 0.86, radius * 0.96, 0.16, 18),
    materials.armor
  );
  roof.position.y = 0.32;
  roof.castShadow = true;
  turretGroup.add(roof);

  const collar = new Mesh(
    new CylinderGeometry(radius * 0.7, radius * 0.78, 0.14, 14),
    materials.armorDark
  );
  collar.position.y = -0.3;
  turretGroup.add(collar);

  /* Mantlet and gun: tube, reinforcing collar and a slotted muzzle brake. */
  const barrelLength = placement.barrelLength;
  const gunGroup = new Group();
  turretGroup.add(gunGroup);
  const mantlet = new Mesh(
    new BoxGeometry(0.34, 0.34, 0.46),
    materials.armorDark
  );
  mantlet.position.set(radius * 0.92, 0.02, 0);
  mantlet.castShadow = true;
  gunGroup.add(mantlet);

  const barrel = new Mesh(
    new CylinderGeometry(0.075, 0.095, barrelLength, 14),
    materials.steel
  );
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(radius * 0.92 + barrelLength / 2, 0.02, 0);
  barrel.castShadow = true;
  gunGroup.add(barrel);

  const brake = new Mesh(
    new CylinderGeometry(0.13, 0.13, 0.34, 12),
    materials.steel
  );
  brake.rotation.z = Math.PI / 2;
  brake.position.set(radius * 0.92 + barrelLength + 0.1, 0.02, 0);
  brake.castShadow = true;
  gunGroup.add(brake);

  /* Commander cupola, hatch, coax machine gun and a stowage basket. */
  const cupola = new Mesh(
    new CylinderGeometry(0.19, 0.21, 0.2, 12),
    materials.armor
  );
  cupola.position.set(-radius * 0.28, 0.44, radius * 0.22);
  cupola.castShadow = true;
  turretGroup.add(cupola);

  const hatch = new Mesh(
    new CylinderGeometry(0.16, 0.16, 0.04, 12),
    materials.armorDark
  );
  hatch.position.set(-radius * 0.28, 0.55, radius * 0.22);
  turretGroup.add(hatch);

  const periscope = new Mesh(
    new BoxGeometry(0.12, 0.06, 0.04),
    materials.glass
  );
  periscope.position.set(radius * 0.1, 0.46, radius * 0.3);
  turretGroup.add(periscope);

  const coax = new Mesh(
    new CylinderGeometry(0.03, 0.03, 0.42, 8),
    materials.steel
  );
  coax.rotation.z = Math.PI / 2;
  coax.position.set(radius * 0.9, 0.16, -0.2);
  gunGroup.add(coax);

  const basket = new Mesh(new BoxGeometry(0.44, 0.3, 0.5), materials.armorDark);
  basket.position.set(-radius * 0.86, 0.06, -0.3);
  basket.castShadow = true;
  turretGroup.add(basket);

  /* Smoke dischargers on the turret cheeks. */
  for (const side of [-1, 1]) {
    for (let index = 0; index < 3; index += 1) {
      const tube = new Mesh(
        new CylinderGeometry(0.045, 0.045, 0.2, 8),
        materials.steel
      );
      tube.rotation.z = Math.PI / 2.6;
      tube.position.set(
        radius * 0.4 + index * 0.09,
        0.2,
        side * (radius * 0.62 + index * 0.04)
      );
      turretGroup.add(tube);
    }
  }

  return { turret: turretGroup, gunGroup };
}

/** Builds a detailed tank: sloped hull, running gear and a cast turret. */
export function buildTankModel(
  placement: TankPlacement,
  isPlayer: boolean
): { root: Group; turret: Group } {
  const group = new Group();
  const materials = materialsFor(placement.color);
  const [hullWidth, hullHeight, hullDepth] = placement.hull;
  const trackOffset = hullWidth / 2 + 0.16;
  const floor = 0.34;

  /* Lower hull and belly. */
  const lower = new Mesh(
    new BoxGeometry(hullWidth * 0.94, hullHeight * 0.45, hullDepth * 0.94),
    materials.armorDark
  );
  lower.position.y = floor + hullHeight * 0.22;
  lower.castShadow = true;
  lower.receiveShadow = true;
  group.add(lower);

  /* Upper hull with sloped front and rear plates. */
  const upper = new Mesh(
    new BoxGeometry(hullWidth, hullHeight * 0.5, hullDepth),
    materials.armor
  );
  upper.position.y = floor + hullHeight * 0.45 + hullHeight * 0.25;
  upper.castShadow = true;
  upper.receiveShadow = true;
  group.add(upper);

  const glacis = new Mesh(
    new BoxGeometry(hullWidth * 0.99, hullHeight * 0.58, 0.16),
    materials.armor
  );
  glacis.position.set(0, floor + hullHeight * 0.72, hullDepth / 2 + 0.02);
  glacis.rotation.x = -0.62;
  glacis.castShadow = true;
  group.add(glacis);

  const rearPlate = new Mesh(
    new BoxGeometry(hullWidth * 0.96, hullHeight * 0.66, 0.14),
    materials.armorDark
  );
  rearPlate.position.set(0, floor + hullHeight * 0.7, -hullDepth / 2 - 0.02);
  rearPlate.rotation.x = 0.5;
  group.add(rearPlate);

  /* Fenders over the tracks, plus engine deck louvers. */
  for (const side of [-1, 1]) {
    const fender = new Mesh(
      new BoxGeometry(0.42, 0.06, hullDepth * 0.92),
      materials.armorDark
    );
    fender.position.set(
      side * (hullWidth / 2 + 0.16),
      floor + hullHeight * 0.9,
      0
    );
    fender.castShadow = true;
    group.add(fender);
  }

  for (let index = 0; index < 4; index += 1) {
    const louver = new Mesh(
      new BoxGeometry(hullWidth * 0.72, 0.03, 0.1),
      materials.steel
    );
    louver.position.set(
      0,
      floor + hullHeight * 0.93,
      -hullDepth * 0.18 - index * 0.16
    );
    group.add(louver);
  }

  /* Tow hooks, headlights and a spare track link on the glacis. */
  for (const side of [-1, 1]) {
    const hook = new Mesh(new BoxGeometry(0.12, 0.12, 0.22), materials.steel);
    hook.position.set(
      side * hullWidth * 0.32,
      floor + 0.1,
      hullDepth / 2 + 0.12
    );
    group.add(hook);

    const lamp = new Mesh(
      new CylinderGeometry(0.1, 0.1, 0.12, 10),
      materials.glass
    );
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(
      side * hullWidth * 0.34,
      floor + hullHeight * 0.9,
      hullDepth / 2 + 0.06
    );
    group.add(lamp);
  }

  for (let index = 0; index < 3; index += 1) {
    const spare = new Mesh(new BoxGeometry(0.5, 0.08, 0.2), materials.track);
    spare.position.set(
      -hullWidth * 0.2,
      floor + hullHeight * 0.68 - index * 0.09,
      hullDepth / 2 + 0.16
    );
    spare.rotation.x = -0.62;
    group.add(spare);
  }

  const wheels = addRoadWheels(group, materials, hullDepth, trackOffset, 0.3);
  group.userData.wheels = wheels;
  group.userData.wheelRadius = 0.3;
  addTrackBand(group, materials, hullDepth, trackOffset);

  const { turret, gunGroup } = addTurretGroups(placement, materials);
  turret.userData.gun = gunGroup;
  turret.position.y = floor + hullHeight * 0.92 + 0.24;
  group.add(turret);

  group.position.set(
    placement.position.x,
    placement.position.y,
    placement.position.z
  );
  group.rotation.y = placement.heading;
  group.userData.isPlayer = isPlayer;
  return { root: group, turret };
}

export const tankModelForward = new Vector3(1, 0, 0);
