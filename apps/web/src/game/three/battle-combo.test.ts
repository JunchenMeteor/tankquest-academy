import { describe, expect, it } from 'vitest';

import {
  COMBO_BONUS_AT,
  applyAnswerCombo,
  emptyCombo,
} from './battle-combo.js';

describe('answer combo', () => {
  it('counts a streak and remembers the best', () => {
    let state = emptyCombo();
    for (let index = 0; index < 2; index += 1) {
      state = applyAnswerCombo(state, true).state;
    }
    expect(state.streak).toBe(2);
    expect(state.best).toBe(2);
  });

  it('grants one extra shell every third answer', () => {
    let state = emptyCombo();
    const bonuses: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      const result = applyAnswerCombo(state, true);
      state = result.state;
      bonuses.push(result.bonusAmmo);
    }
    expect(bonuses.filter((value) => value > 0)).toHaveLength(2);
    expect(bonuses[COMBO_BONUS_AT - 1]).toBe(1);
  });

  it('resets the streak on a wrong answer without losing the best', () => {
    let state = emptyCombo();
    for (let index = 0; index < 4; index += 1) {
      state = applyAnswerCombo(state, true).state;
    }
    const afterWrong = applyAnswerCombo(state, false);
    expect(afterWrong.state.streak).toBe(0);
    expect(afterWrong.state.best).toBe(4);
    expect(afterWrong.bonusAmmo).toBe(0);
  });
});
