import { Raycaster, Vector2, Vector3 } from 'three';
import type { Camera, Object3D } from 'three';

import {
  FIRE_AIM_TOLERANCE,
  aimAlignmentError,
  localAimPitch,
  muzzleAimYaw,
  projectGunSight,
  resolveAimPoint,
  rotateTowards,
  stepGunPitch,
} from './battle-aim.js';
import { SHELL_RANGE } from './battle-combat.js';
import { normaliseAngle } from './battle-input.js';
import type { DriveCommand } from './battle-input.js';
import type { TankRig } from './tank-rig.js';

export interface AimPointer {
  x: number;
  y: number;
  ready: boolean;
}

export interface AimState {
  position: { x: number; y: number; z: number };
  heading: number;
  turret: number;
}

export interface AimControlFrame {
  delta: number;
  state: AimState;
  command: DriveCommand;
  rightHeld: boolean;
  pointer: AimPointer;
  camera: Camera;
  camYaw: number;
  bounds: { width: number; height: number };
  targets: Object3D[];
}

export interface AimPresentationFrame {
  camera: Camera;
  pointer: AimPointer;
  guidedAim: boolean;
  bounds: { width: number; height: number };
}

export interface PlayerAimControllerOptions {
  getRig: () => TankRig;
  traverseSpeed: number;
  elevationSpeed: number;
  initialGunPitch?: number;
}

export function createPlayerAimController(options: PlayerAimControllerOptions) {
  const raycaster = new Raycaster();
  const aimPoint = new Vector3();
  let gunPitch = options.initialGunPitch ?? 0;

  const updateControl = (frame: AimControlFrame) => {
    const rig = options.getRig();
    const guidedAim =
      !frame.rightHeld && frame.command.turret === 0 && frame.pointer.ready;
    let targetWorld: number | null =
      frame.rightHeld || frame.command.turret !== 0 ? null : frame.camYaw;
    if (guidedAim) {
      const ndc = new Vector2(
        (frame.pointer.x / Math.max(1, frame.bounds.width)) * 2 - 1,
        -(frame.pointer.y / Math.max(1, frame.bounds.height)) * 2 + 1
      );
      raycaster.setFromCamera(ndc, frame.camera);
      aimPoint.copy(
        resolveAimPoint(raycaster.ray, frame.targets, SHELL_RANGE * 2)
      );
      targetWorld = muzzleAimYaw(
        rig.muzzle,
        aimPoint,
        frame.state.heading,
        frame.state.turret
      );
      gunPitch = stepGunPitch(
        gunPitch,
        localAimPitch(rig.gun, aimPoint, rig.muzzle),
        options.elevationSpeed * frame.delta
      );
    }
    const turret =
      targetWorld === null
        ? frame.state.turret
        : rotateTowards(
            frame.state.turret,
            normaliseAngle(targetWorld - frame.state.heading),
            options.traverseSpeed * frame.delta
          );
    const aimOffset =
      targetWorld === null
        ? null
        : normaliseAngle(
            targetWorld - (frame.state.heading + frame.state.turret)
          );
    return { turret, gunPitch, guidedAim, aimOffset };
  };

  const updatePresentation = (frame: AimPresentationFrame) => {
    const rig = options.getRig();
    const muzzle = rig.muzzle.getWorldPosition(new Vector3());
    const direction = rig.muzzle.getWorldDirection(new Vector3());
    const projected = projectGunSight(
      muzzle,
      direction,
      frame.pointer.ready ? muzzle.distanceTo(aimPoint) : SHELL_RANGE,
      frame.camera
    );
    const aligned =
      !frame.guidedAim ||
      aimAlignmentError(muzzle, direction, aimPoint) <= FIRE_AIM_TOLERANCE;
    return {
      muzzle,
      direction,
      aligned,
      sight: {
        x: ((projected.x + 1) / 2) * frame.bounds.width,
        y: ((1 - projected.y) / 2) * frame.bounds.height,
      },
    };
  };

  return { updateControl, updatePresentation };
}
