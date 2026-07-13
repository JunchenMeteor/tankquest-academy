export interface MotionInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
}

export interface MotionResult {
  angularVelocity: number;
  velocityX: number;
  velocityY: number;
}

export function calculateTankMotion(
  rotation: number,
  speed: number,
  turnSpeed: number,
  input: MotionInput
): MotionResult {
  const drive = Number(input.forward) - Number(input.backward);
  const turn = Number(input.right) - Number(input.left);
  return {
    angularVelocity: turn * turnSpeed,
    velocityX: Math.cos(rotation) * speed * drive,
    velocityY: Math.sin(rotation) * speed * drive,
  };
}
