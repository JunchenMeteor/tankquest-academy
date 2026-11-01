export interface ComboState {
  streak: number;
  best: number;
}

export const COMBO_BONUS_AT = 3;

export function emptyCombo(): ComboState {
  return { streak: 0, best: 0 };
}

/**
 * Tracks a streak of correct answers.
 *
 * A streak never changes how hard a shell hits, only how fast it is loaded, so
 * answering well cannot win a fight on its own.
 */
export function applyAnswerCombo(
  state: ComboState,
  correct: boolean
): { state: ComboState; bonusAmmo: number } {
  if (!correct) return { state: { ...state, streak: 0 }, bonusAmmo: 0 };
  const streak = state.streak + 1;
  const bonusAmmo = streak > 0 && streak % COMBO_BONUS_AT === 0 ? 1 : 0;
  return { state: { streak, best: Math.max(state.best, streak) }, bonusAmmo };
}
