import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector2,
  Vector3,
} from 'three';

import type { TankPlacement } from './battle-scene-model.js';
import {
  createTrackPath,
  layoutRoadWheels,
  trackContactHeights,
} from './running-gear-layout.js';
import type { TankRig, TrackLoop } from './tank-rig.js';
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

function addRoadWheels(
  group: Group,
  materials: TankMaterials,
  hullDepth: number,
  trackOffset: number,
  wheelRadius: number,
  floor: number
): {
  wheels: Group[];
  idlers: Mesh[];
  sprockets: Mesh[];
  returnRollers: Mesh[];
} {
  const layout = layoutRoadWheels(hullDepth, wheelRadius);
  const contact = trackContactHeights(floor);
  const wheelGeometry = new CylinderGeometry(
    layout.roadRadius,
    layout.roadRadius,
    0.5,
    20,
    1
  );
  const hubGeometry = new CylinderGeometry(
    layout.roadRadius * 0.55,
    layout.roadRadius * 0.55,
    0.54,
    14
  );
  const wheels: Group[] = [];
  const idlers: Mesh[] = [];
  const sprockets: Mesh[] = [];
  const returnRollers: Mesh[] = [];
  for (const [side, z] of [
    ['L', -trackOffset],
    ['R', trackOffset],
  ] as const) {
    for (const [index, x] of layout.roadPositions.entries()) {
      const holder = new Group();
      holder.name = `Wheel_${side}_${String(index + 1).padStart(2, '0')}`;
      holder.position.set(x, contact.lower + layout.roadRadius, z);
      holder.userData.rollingRadius = layout.roadRadius;
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

    const endWheel = (name: string, x: number, radius: number) => {
      const mesh = new Mesh(
        new CylinderGeometry(radius, radius, 0.46, 16),
        materials.steel
      );
      mesh.name = name;
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(x, contact.lower + radius, z);
      mesh.userData.rollingRadius = radius;
      mesh.castShadow = true;
      group.add(mesh);
      return mesh;
    };
    sprockets.push(
      endWheel(`Wheel_${side}_06`, layout.sprocketX, layout.sprocketRadius)
    );
    idlers.push(
      endWheel(`Wheel_${side}_00`, layout.idlerX, layout.idlerRadius)
    );

    for (const [index, x] of [-hullDepth / 3.2, 0, hullDepth / 3.2].entries()) {
      const roller = new Mesh(
        new CylinderGeometry(0.14, 0.14, 0.4, 10),
        materials.steel
      );
      roller.name = `ReturnRoller_${side}_${String(index + 1).padStart(2, '0')}`;
      roller.rotation.x = Math.PI / 2;
      roller.position.set(x, contact.returnRoller, z);
      roller.userData.rollingRadius = 0.14;
      group.add(roller);
      returnRollers.push(roller);
    }
  }
  return { wheels, idlers, sprockets, returnRollers };
}

function addTrackBand(
  group: Group,
  materials: TankMaterials,
  hullDepth: number,
  trackOffset: number,
  floor: number
): TrackLoop[] {
  const radius = 0.34;
  const track = createTrackPath(hullDepth / 2 + 0.16, radius, 0.26);
  const linkGeometry = new BoxGeometry(0.26, 0.085, 0.62);
  const loops: TrackLoop[] = [];
  for (const [side, z] of [
    ['L', -trackOffset],
    ['R', trackOffset],
  ] as const) {
    const loop: TrackLoop = {
      ...track,
      links: [],
      baseY: floor + radius * 0.02,
      travelled: 0,
    };
    for (const [index, point] of track.points.entries()) {
      const link = new Mesh(linkGeometry, materials.track);
      link.name = `Tracks_${side}_${String(index).padStart(3, '0')}`;
      link.position.set(point.x, point.y + loop.baseY, z);
      link.rotation.z = point.angle;
      link.castShadow = true;
      group.add(link);
      loop.links.push(link);
    }
    loops.push(loop);
  }
  return loops;
}

function addTurretGroups(
  placement: TankPlacement,
  materials: TankMaterials
): { turret: Group; gunGroup: Group; muzzle: Object3D } {
  const turretGroup = new Group();
  const radius = placement.turretRadius;

  /* Cast turret: a tapered drum with a rounded roof, like a real casting. */
  const drum = new Mesh(
    new CylinderGeometry(radius * 0.94, radius * 1.15, 0.72, 18),
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
    new CylinderGeometry(0.11, 0.13, barrelLength, 14),
    materials.steel
  );
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(radius * 0.92 + barrelLength / 2, 0.02, 0);
  barrel.castShadow = true;
  gunGroup.add(barrel);

  const sleeve = new Mesh(
    new CylinderGeometry(0.15, 0.15, barrelLength * 0.45, 12),
    materials.armorDark
  );
  sleeve.rotation.z = Math.PI / 2;
  sleeve.position.set(radius * 0.92 + barrelLength * 0.55, 0.02, 0);
  sleeve.castShadow = true;
  gunGroup.add(sleeve);

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

  const muzzle = new Object3D();
  muzzle.name = 'Muzzle';
  muzzle.position.set(radius * 0.92 + barrelLength + 0.27, 0.02, 0);
  gunGroup.add(muzzle);
  return { turret: turretGroup, gunGroup, muzzle };
}

/** Builds a detailed tank: sloped hull, running gear and a cast turret. */
export function buildTankModel(
  placement: TankPlacement,
  isPlayer: boolean
): TankRig {
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
  glacis.position.set(0, floor + hullHeight * 0.66, hullDepth / 2 - 0.12);
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

  /* Stowage boxes and tow cables along the fenders. */
  for (const side of [-1, 1]) {
    const box = new Mesh(new BoxGeometry(0.62, 0.24, 0.3), materials.armorDark);
    box.position.set(
      -hullDepth * 0.22,
      floor + hullHeight * 1.02,
      side * (hullWidth / 2 + 0.16)
    );
    box.castShadow = true;
    group.add(box);

    const cable = new Mesh(
      new CylinderGeometry(0.03, 0.03, hullDepth * 0.5, 8),
      materials.steel
    );
    cable.rotation.z = Math.PI / 2;
    cable.position.set(
      hullDepth * 0.24,
      floor + hullHeight * 0.98,
      side * (hullWidth / 2 + 0.1)
    );
    group.add(cable);
  }

  for (const side of [-1, 1]) {
    const skirt = new Mesh(
      new BoxGeometry(1.9, 0.34, 0.08),
      materials.armorDark
    );
    skirt.position.set(
      0,
      floor + hullHeight * 0.52,
      side * (hullWidth / 2 + 0.34)
    );
    skirt.castShadow = true;
    group.add(skirt);
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

  const { wheels, idlers, sprockets, returnRollers } = addRoadWheels(
    group,
    materials,
    hullDepth,
    trackOffset,
    0.3,
    floor
  );
  group.userData.wheels = wheels;
  group.userData.wheelRadius = 0.3;
  const trackLoops = addTrackBand(
    group,
    materials,
    hullDepth,
    trackOffset,
    floor
  );

  const { turret, gunGroup, muzzle } = addTurretGroups(placement, materials);
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
  return {
    root: group,
    turret,
    gun: gunGroup,
    muzzle,
    wheels,
    idlers,
    sprockets,
    returnRollers,
    wheelAxis: 'z',
    wheelRadius: 0.3,
    trackTextures: [],
    trackLoops,
  };
}

export const tankModelForward = new Vector3(1, 0, 0);
