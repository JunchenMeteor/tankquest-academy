import { describe, expect, it } from 'vitest';

import {
  createTrackPath,
  layoutRoadWheels,
  sampleTrackPath,
  trackContactHeights,
  travelledForHeading,
} from './running-gear-layout.js';

describe('procedural running gear layout', () => {
  it.each([1.8, 2, 2.3, 0.2])(
    'fits road wheels between the rear sprocket and front idler for hull depth %s',
    (hullDepth) => {
      const layout = layoutRoadWheels(hullDepth, 0.3);
      expect(layout.idlerX).toBeGreaterThan(0);
      expect(layout.sprocketX).toBeLessThan(0);
      expect(layout.roadPositions.length).toBeGreaterThanOrEqual(1);
      expect(layout.roadPositions.length).toBeLessThanOrEqual(3);
      const wheels = [
        { x: layout.sprocketX, radius: layout.sprocketRadius },
        ...layout.roadPositions.map((x) => ({ x, radius: layout.roadRadius })),
        { x: layout.idlerX, radius: layout.idlerRadius },
      ];
      for (let index = 1; index < wheels.length; index += 1) {
        const previous = wheels[index - 1]!;
        const current = wheels[index]!;
        expect(
          current.x - previous.x - current.radius - previous.radius
        ).toBeGreaterThanOrEqual(0.029);
      }
    }
  );

  it('places the lower and upper track runs in contact with their wheels', () => {
    const contact = trackContactHeights(0.34);
    expect(contact.lower).toBeCloseTo(0.0493);
    expect(contact.upper).toBeCloseTo(0.6443);
    expect(contact.returnRoller).toBeCloseTo(0.5043);
  });

  it('uses separated links and samples a continuous closed path', () => {
    const track = createTrackPath(1.16, 0.34, 0.26);
    expect(track.points.length).toBeLessThan(30);
    expect(track.perimeter / track.points.length).toBeGreaterThanOrEqual(0.26);
    const initial = sampleTrackPath(track, 0);
    const wrapped = sampleTrackPath(track, track.perimeter);
    expect(wrapped.x).toBeCloseTo(initial.x);
    expect(wrapped.y).toBeCloseTo(initial.y);
    expect(wrapped.angle).toBeCloseTo(initial.angle);
    const backward = sampleTrackPath(track, -0.1);
    const forward = sampleTrackPath(track, track.perimeter - 0.1);
    expect(backward.x).toBeCloseTo(forward.x);
    expect(backward.y).toBeCloseTo(forward.y);
    expect(backward.angle).toBeCloseTo(forward.angle);
  });

  it('derives signed travel from actual displacement and hull heading', () => {
    expect(travelledForHeading({ x: 0, z: 0 }, { x: 2, z: 0 }, 0)).toBeCloseTo(
      2
    );
    expect(travelledForHeading({ x: 2, z: 0 }, { x: 0, z: 0 }, 0)).toBeCloseTo(
      -2
    );
    expect(
      travelledForHeading({ x: 0, z: 0 }, { x: 0, z: -2 }, Math.PI / 2)
    ).toBeCloseTo(2);
    expect(
      travelledForHeading({ x: 0, z: 0 }, { x: 0, z: 2 }, Math.PI / 2)
    ).toBeCloseTo(-2);
    expect(travelledForHeading({ x: 1, z: 1 }, { x: 1, z: 1 }, 0)).toBe(0);
  });
});
