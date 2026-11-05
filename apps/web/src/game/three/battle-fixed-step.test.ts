import { describe, expect, it } from 'vitest';

import { FixedStepDriver } from './battle-fixed-step.js';

describe('fixed-step simulation', () => {
  it('uses the same step size across different render intervals', () => {
    const driver = new FixedStepDriver(0.02);
    const steps: number[] = [];

    driver.advance(0.05, (step) => steps.push(step));
    driver.advance(0.01, (step) => steps.push(step));
    driver.advance(0.04, (step) => steps.push(step));

    expect(steps).toEqual([0.02, 0.02, 0.02, 0.02, 0.02]);
  });

  it('bounds catch-up work after a long frame', () => {
    const driver = new FixedStepDriver();
    let updates = 0;

    const count = driver.advance(5, () => {
      updates += 1;
    });

    expect(count).toBe(6);
    expect(updates).toBe(6);
  });
});
