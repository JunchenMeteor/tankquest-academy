import { Raycaster, Vector3 } from 'three';
import type { Object3D } from 'three';

import type { ShellHit, ShellHitTest } from './battle-combat.js';

export function createMeshHitTest(
  enemyRoots: ReadonlyMap<string, Object3D>,
  coverObjects: readonly Object3D[] = []
): ShellHitTest {
  const raycaster = new Raycaster();
  const start = new Vector3();
  const end = new Vector3();
  const direction = new Vector3();

  return (from, to, enemies) => {
    start.set(from.x, from.y, from.z);
    end.set(to.x, to.y, to.z);
    const distance = start.distanceTo(end);
    if (distance === 0) return null;
    direction.copy(end).sub(start).normalize();
    raycaster.set(start, direction);
    raycaster.near = 0;
    raycaster.far = distance;

    let nearest: ShellHit | null = null;
    const consider = (
      intersection: { distance: number; point: Vector3 },
      enemy: ShellHit['enemy'],
      cover: boolean
    ) => {
      const fraction = intersection.distance / distance;
      if (nearest && fraction >= nearest.fraction) return;
      nearest = {
        enemy,
        fraction,
        cover,
        point: {
          x: intersection.point.x,
          y: intersection.point.y,
          z: intersection.point.z,
        },
      };
    };

    for (const enemy of enemies) {
      const root = enemyRoots.get(enemy.id);
      if (!root) continue;
      root.updateMatrixWorld(true);
      const [intersection] = raycaster.intersectObject(root, true);
      if (intersection) consider(intersection, enemy, false);
    }
    for (const cover of coverObjects) {
      cover.updateMatrixWorld(true);
      const [intersection] = raycaster.intersectObject(cover, true);
      if (intersection) consider(intersection, null, true);
    }
    return nearest;
  };
}
