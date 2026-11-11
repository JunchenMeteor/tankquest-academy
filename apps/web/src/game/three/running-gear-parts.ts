import {
  BoxGeometry,
  CylinderGeometry,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import type { Object3D } from 'three';

function runningGearMaterial(source: Object3D): MeshStandardMaterial {
  if (source instanceof Mesh) {
    const materials = Array.isArray(source.material)
      ? source.material
      : [source.material];
    const standard = materials.find(
      (material): material is MeshStandardMaterial =>
        material instanceof MeshStandardMaterial
    );
    if (standard) return standard.clone();
  }
  return new MeshStandardMaterial({
    color: 0x3d4548,
    roughness: 0.7,
    metalness: 0.6,
  });
}

export function addRunningGearParts(root: Object3D): Object3D[] {
  if (root.userData.runningGearPartsAdded) return [];
  root.userData.runningGearPartsAdded = true;
  const hull = root.getObjectByName('Hull') ?? root;
  const accessories: Object3D[] = [];
  const sprockets: Mesh[] = [];
  root.traverse((node) => {
    if (node instanceof Mesh && /^Wheel_[LR]_06$/.test(node.name)) {
      sprockets.push(node);
    }
  });

  for (const sprocket of sprockets) {
    const material = runningGearMaterial(sprocket);
    const side = sprocket.name.includes('_L_') ? 'L' : 'R';
    for (let index = 0; index < 12; index += 1) {
      const angle = (index / 12) * Math.PI * 2;
      const tooth = new Mesh(new BoxGeometry(30, 5, 7), material);
      tooth.name = `SprocketTooth_${side}_06_${String(index).padStart(2, '0')}`;
      tooth.position.set(0, Math.cos(angle) * 54, Math.sin(angle) * 54);
      tooth.rotation.x = angle;
      tooth.castShadow = true;
      sprocket.add(tooth);
    }
  }

  for (const side of ['L', 'R'] as const) {
    const x = side === 'L' ? -140 : 140;
    for (const [index, z] of [95.65, -95.65].entries()) {
      const geometry = new CylinderGeometry(10, 10, 20, 12);
      geometry.rotateZ(Math.PI / 2);
      const roller = new Mesh(
        geometry,
        runningGearMaterial(sprockets[0] ?? hull)
      );
      roller.name = `ReturnRoller_${side}_${String(index + 1).padStart(2, '0')}`;
      roller.position.set(x, 107.35, z);
      roller.userData.sourceRollingRadius = 10;
      roller.castShadow = true;
      hull.add(roller);
      accessories.push(roller);
    }

    for (let index = 1; index <= 5; index += 1) {
      const wheel = root.getObjectByName(
        `Wheel_${side}_${String(index).padStart(2, '0')}`
      );
      if (!wheel) continue;
      const anchor = new Vector3(wheel.position.x, 102, wheel.position.z + 12);
      const direction = wheel.position.clone().sub(anchor);
      const length = direction.length();
      if (length === 0) continue;
      const arm = new Mesh(
        new BoxGeometry(7, length, 7),
        runningGearMaterial(sprockets[0] ?? hull)
      );
      arm.name = `Suspension_${side}_${String(index).padStart(2, '0')}`;
      arm.position.copy(anchor).add(wheel.position).multiplyScalar(0.5);
      arm.quaternion.setFromUnitVectors(
        new Vector3(0, 1, 0),
        direction.normalize()
      );
      arm.castShadow = true;
      hull.add(arm);
    }
  }
  return accessories;
}
