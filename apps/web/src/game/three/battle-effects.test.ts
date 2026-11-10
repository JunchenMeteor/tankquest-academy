import { Mesh, MeshBasicMaterial, RingGeometry, Scene } from 'three';
import { describe, expect, it } from 'vitest';

import {
  createCombatState,
  spawnEnemyShell,
  spawnShell,
} from './battle-combat.js';
import { BattleEffects } from './battle-effects.js';

describe('BattleEffects', () => {
  it('expires timed effects and releases their scene resources', () => {
    const scene = new Scene();
    const effects = new BattleEffects(scene);
    const mesh = new Mesh(
      new RingGeometry(0.3, 0.5, 12),
      new MeshBasicMaterial({ transparent: true })
    );
    effects.spawn(mesh, 0.2, 2);

    effects.update(0.1, createCombatState(0));
    expect(scene.children).toContain(mesh);
    expect(mesh.scale.x).toBeGreaterThan(1);

    effects.update(0.2, createCombatState(0));
    expect(scene.children).not.toContain(mesh);
    effects.dispose();
  });

  it('keeps projectile transforms in sync and removes stale shells', () => {
    const scene = new Scene();
    const effects = new BattleEffects(scene);
    let combat = spawnShell(createCombatState(1), { x: 0, z: 0 }, 0, 0, 0.5);
    combat = spawnEnemyShell(combat, {
      x: 1,
      y: 3,
      z: 0,
      heading: 0,
      pitch: 0.4,
      damage: 12,
      sourceId: 'enemy',
    });
    effects.update(0, combat);
    const playerMesh = scene.children.find((child) => child.position.y === 0.5);
    const enemyMesh = scene.children.find((child) => child.position.y === 3);
    expect(playerMesh).toBeDefined();
    expect(enemyMesh).toBeDefined();

    combat = { ...combat, shells: [], enemyShells: [] };
    effects.update(0, combat);
    expect(scene.children).toHaveLength(0);
    effects.dispose();
  });
});
