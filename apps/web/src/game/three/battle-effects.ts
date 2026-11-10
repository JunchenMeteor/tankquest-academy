import { CylinderGeometry, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { MeshBasicMaterial, Scene } from 'three';
import type { CombatState } from './battle-combat.js';

interface TimedEffect {
  mesh: Mesh;
  ttl: number;
  life: number;
  growth: number;
}

export class BattleEffects {
  private readonly effects: TimedEffect[] = [];
  private readonly shellMeshes = new Map<number, Mesh>();
  private readonly enemyShellMeshes = new Map<number, Mesh>();
  private readonly shellGeometry = new CylinderGeometry(0.045, 0.075, 0.72, 8);
  private readonly shellMaterial = new MeshStandardMaterial({
    color: 0xd8e1e8,
    emissive: 0x3d2a10,
    metalness: 0.75,
    roughness: 0.25,
  });
  private readonly enemyShellMaterial = new MeshStandardMaterial({
    color: 0xff9a7a,
    emissive: 0x5a140c,
    metalness: 0.55,
    roughness: 0.3,
  });

  constructor(private readonly scene: Scene) {}

  spawn(mesh: Mesh, life: number, growth: number): void {
    this.scene.add(mesh);
    this.effects.push({ mesh, ttl: life, life, growth });
  }

  update(delta: number, combat: CombatState): void {
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index]!;
      effect.ttl -= delta;
      const material = effect.mesh.material as MeshBasicMaterial;
      if (effect.ttl <= 0) {
        this.scene.remove(effect.mesh);
        effect.mesh.geometry.dispose();
        material.dispose();
        this.effects.splice(index, 1);
        continue;
      }
      const scale = 1 + (1 - effect.ttl / effect.life) * effect.growth;
      effect.mesh.scale.setScalar(scale);
      material.opacity = Math.max(0, effect.ttl / effect.life) * 0.9;
    }
    this.syncShells(combat);
  }

  dispose(): void {
    for (const effect of this.effects) {
      this.scene.remove(effect.mesh);
      effect.mesh.geometry.dispose();
      (effect.mesh.material as MeshBasicMaterial).dispose();
    }
    this.effects.length = 0;
    for (const mesh of [
      ...this.shellMeshes.values(),
      ...this.enemyShellMeshes.values(),
    ]) {
      this.scene.remove(mesh);
    }
    this.shellMeshes.clear();
    this.enemyShellMeshes.clear();
    this.shellGeometry.dispose();
    this.shellMaterial.dispose();
    this.enemyShellMaterial.dispose();
  }

  private syncShells(combat: CombatState): void {
    for (const shell of combat.shells) {
      let mesh = this.shellMeshes.get(shell.id);
      if (!mesh) {
        mesh = new Mesh(this.shellGeometry, this.shellMaterial);
        this.shellMeshes.set(shell.id, mesh);
        this.scene.add(mesh);
      }
      mesh.position.set(shell.x, shell.y, shell.z);
      const horizontal = Math.cos(shell.pitch);
      mesh.quaternion.setFromUnitVectors(
        new Vector3(0, 1, 0),
        new Vector3(
          Math.cos(shell.heading) * horizontal,
          -Math.sin(shell.pitch),
          -Math.sin(shell.heading) * horizontal
        )
      );
    }
    for (const [id, mesh] of this.shellMeshes) {
      if (!combat.shells.some((shell) => shell.id === id)) {
        this.scene.remove(mesh);
        this.shellMeshes.delete(id);
      }
    }

    for (const shell of combat.enemyShells) {
      let mesh = this.enemyShellMeshes.get(shell.id);
      if (!mesh) {
        mesh = new Mesh(this.shellGeometry, this.enemyShellMaterial);
        this.enemyShellMeshes.set(shell.id, mesh);
        this.scene.add(mesh);
      }
      mesh.position.set(shell.x, shell.y, shell.z);
      const horizontal = Math.cos(shell.pitch);
      mesh.quaternion.setFromUnitVectors(
        new Vector3(0, 1, 0),
        new Vector3(
          Math.cos(shell.heading) * horizontal,
          -Math.sin(shell.pitch),
          -Math.sin(shell.heading) * horizontal
        )
      );
    }
    for (const [id, mesh] of this.enemyShellMeshes) {
      if (!combat.enemyShells.some((shell) => shell.id === id)) {
        this.scene.remove(mesh);
        this.enemyShellMeshes.delete(id);
      }
    }
  }
}
