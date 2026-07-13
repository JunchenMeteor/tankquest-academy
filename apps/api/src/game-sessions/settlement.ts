import type { FinishSessionResponse } from '@tankquest/shared';

import type { RecordedAnswer } from './game-session.models.js';

export function calculateSettlement(
  sessionId: string,
  answers: RecordedAnswer[],
  questionCount: number
): FinishSessionResponse {
  const correct = answers.filter((answer) => answer.correct).length;
  const total = questionCount;
  const accuracy = total === 0 ? 0 : correct / total;
  const stars = accuracy >= 0.8 ? 3 : accuracy >= 0.6 ? 2 : 1;

  return {
    sessionId,
    stars,
    rewards: [
      { type: 'part', key: 'cannon', amount: stars },
      { type: 'training_point', key: 'general', amount: stars * 10 },
    ],
    learningSummary: { correct, total },
  };
}
