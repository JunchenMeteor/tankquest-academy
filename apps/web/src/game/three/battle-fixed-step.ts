export class FixedStepDriver {
  private accumulator = 0;

  constructor(
    private readonly step = 1 / 60,
    private readonly maxSteps = 6
  ) {}

  advance(deltaSeconds: number, update: (step: number) => void): number {
    this.accumulator += Math.max(0, Math.min(0.1, deltaSeconds));
    let steps = 0;
    while (this.accumulator >= this.step && steps < this.maxSteps) {
      update(this.step);
      this.accumulator -= this.step;
      steps += 1;
    }
    return steps;
  }
}
