export interface TrackPathPoint {
  x: number;
  y: number;
  angle: number;
}

export interface TrackPath {
  points: TrackPathPoint[];
  perimeter: number;
}

export interface RoadWheelLayout {
  roadRadius: number;
  roadPositions: number[];
  sprocketRadius: number;
  sprocketX: number;
  idlerRadius: number;
  idlerX: number;
}

export function layoutRoadWheels(
  hullDepth: number,
  wheelRadius: number
): RoadWheelLayout {
  const straight = Math.max(0.2, hullDepth / 2 - 0.18);
  const minimumGap = 0.03;
  const baseSprocketRadius = wheelRadius * 0.92;
  const baseIdlerRadius = baseSprocketRadius * 0.82;
  const baseRoadRadius = wheelRadius * 0.7;
  const sizeFactor = Math.min(
    1,
    (straight * 2 - minimumGap * 2) /
      (baseSprocketRadius + baseIdlerRadius + baseRoadRadius * 2 + minimumGap)
  );
  const sprocketRadius = baseSprocketRadius * sizeFactor;
  const idlerRadius = baseIdlerRadius * sizeFactor;
  const roadRadius = baseRoadRadius * sizeFactor;
  const available = straight * 2 - sprocketRadius - idlerRadius;
  const count = Math.max(
    1,
    Math.min(
      3,
      Math.floor((available + minimumGap) / (roadRadius * 2 + minimumGap))
    )
  );
  const first = -straight + sprocketRadius + minimumGap + roadRadius;
  const last = straight - idlerRadius - minimumGap - roadRadius;
  const roadPositions = Array.from({ length: count }, (_, index) =>
    count === 1
      ? (first + last) / 2
      : first + ((last - first) * index) / (count - 1)
  );
  return {
    roadRadius,
    roadPositions,
    sprocketRadius,
    sprocketX: -straight,
    idlerRadius,
    idlerX: straight,
  };
}

export function trackContactHeights(floor: number): {
  lower: number;
  upper: number;
  returnRoller: number;
} {
  const lower = floor - 0.34 + 0.34 * 0.02 + 0.085 / 2;
  const upper = floor + 0.34 + 0.34 * 0.02 - 0.085 / 2;
  return { lower, upper, returnRoller: upper - 0.14 };
}

export function createTrackPath(
  halfLength: number,
  radius: number,
  linkLength: number
): TrackPath {
  const straight = Math.max(0.2, halfLength - radius);
  const perimeter = straight * 4 + Math.PI * 2 * radius;
  const samples = Math.max(8, Math.ceil(perimeter / (linkLength * 1.08)));
  const points: TrackPathPoint[] = [];
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
  return { points, perimeter };
}

export function sampleTrackPath(
  track: TrackPath,
  distance: number
): TrackPathPoint {
  const count = track.points.length;
  const wrapped =
    ((distance % track.perimeter) + track.perimeter) % track.perimeter;
  const position = (wrapped / track.perimeter) * count;
  const index = Math.floor(position) % count;
  const fraction = position - Math.floor(position);
  const current = track.points[index]!;
  const next = track.points[(index + 1) % count]!;
  let nextAngle = next.angle;
  if (nextAngle - current.angle < -Math.PI) nextAngle += Math.PI * 2;
  if (nextAngle - current.angle > Math.PI) nextAngle -= Math.PI * 2;
  const angle =
    (current.angle + (nextAngle - current.angle) * fraction) % (Math.PI * 2);
  return {
    x: current.x + (next.x - current.x) * fraction,
    y: current.y + (next.y - current.y) * fraction,
    angle: Math.abs(angle - Math.PI * 2) < 1e-8 ? 0 : angle,
  };
}

export function travelledForHeading(
  previous: { x: number; z: number },
  current: { x: number; z: number },
  heading: number
): number {
  const dx = current.x - previous.x;
  const dz = current.z - previous.z;
  const forward = dx * Math.cos(heading) - dz * Math.sin(heading);
  return Math.hypot(dx, dz) * Math.sign(forward);
}
