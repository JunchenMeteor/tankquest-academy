import {
  BoxGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import type { Object3D } from 'three';

export type TankModelRole = 'scout' | 'medium' | 'heavy';

const roleScales = {
  scout: { root: [0.86, 0.9, 0.88], turret: 0.88 },
  medium: { root: [1, 1, 1], turret: 1 },
  heavy: { root: [1.12, 1.08, 1.14], turret: 1.1 },
} as const;

export function applyTankRoleVariant(
  root: Group,
  role: TankModelRole,
  color: number
): void {
  root.userData.tankRole = role;
  if (role === 'medium') return;

  const material = new MeshStandardMaterial({
    color,
    metalness: role === 'heavy' ? 0.32 : 0.18,
    roughness: role === 'heavy' ? 0.68 : 0.82,
  });
  if (role === 'scout') addScoutEquipment(root, material);
  else addHeavyArmour(root, material);

  const turret = root.getObjectByName('TurretPivot');
  if (turret) turret.scale.multiplyScalar(roleScales[role].turret);
  const [x, y, z] = roleScales[role].root;
  root.scale.set(x, y, z);
  root.traverse((node) => {
    if (typeof node.userData.rollingRadius === 'number') {
      node.userData.rollingRadius *= x;
    }
  });
}

function addScoutEquipment(root: Group, material: MeshStandardMaterial): void {
  const rack = new Group();
  rack.name = 'ScoutHullEquipment';
  for (const side of [-1, 1]) {
    const storage = new Mesh(new BoxGeometry(0.52, 0.22, 0.34), material);
    storage.name = `ScoutStorage_${side < 0 ? 'L' : 'R'}`;
    storage.position.set(-1.72, 1.12, side * 0.65);
    rack.add(storage);
  }
  root.add(rack);
}

function addHeavyArmour(root: Group, material: MeshStandardMaterial): void {
  const hullArmour = new Group();
  hullArmour.name = 'HeavyHullArmour';
  for (const side of [-1, 1]) {
    const plate = new Mesh(new BoxGeometry(4.35, 0.64, 0.14), material);
    plate.name = `HeavyHullPlate_${side < 0 ? 'L' : 'R'}`;
    plate.position.set(-0.05, 0.72, side * 1.22);
    hullArmour.add(plate);
  }
  root.add(hullArmour);

  const turret = root.getObjectByName('TurretPivot');
  if (!turret) return;
  root.updateMatrixWorld(true);
  const centre = root.worldToLocal(turret.getWorldPosition(new Vector3()));
  const turretArmour = alignedToRoot(root, turret, 'HeavyTurretArmour');
  for (const side of [-1, 1]) {
    const cheek = new Mesh(new BoxGeometry(1.3, 0.62, 0.24), material);
    cheek.name = `HeavyTurretCheek_${side < 0 ? 'L' : 'R'}`;
    cheek.position.set(centre.x + 0.5, centre.y + 0.2, side * 0.92);
    turretArmour.add(cheek);
  }
}

function alignedToRoot(root: Group, parent: Object3D, name: string): Group {
  const alignment = new Matrix4()
    .copy(root.matrixWorld)
    .invert()
    .multiply(parent.matrixWorld)
    .invert();
  const group = new Group();
  group.name = name;
  group.applyMatrix4(alignment);
  parent.add(group);
  return group;
}
