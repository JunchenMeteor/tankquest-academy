import type {
  NextPracticeRecommendationDto,
  PracticeIntent,
  Subject,
} from '@tankquest/shared';

import type { AiPracticeRecommendationResponse } from '../ai/ai-gateway.models.js';
import type {
  AdaptiveLearningContext,
  AdaptiveLearningRecord,
  EligiblePracticeLevel,
} from './game-session.models.js';

export const minimumAdaptiveAttempts = 3;
export const fastAnswerThresholdMs = 15_000;

export interface AdaptivePracticePolicy {
  focus: AdaptiveLearningRecord & { accuracy: number };
  currentDifficulty: number;
  completedSessions: number;
  allowedDifficulty: { min: number; max: number };
  deterministicDifficulty: number;
  skipAi: boolean;
  parentLimited: boolean;
  levels: EligiblePracticeLevel[];
}

export function buildAdaptivePracticePolicy(
  context: AdaptiveLearningContext
): AdaptivePracticePolicy | null {
  const availableSkills = new Set(
    context.levels.flatMap((level) =>
      level.skillKeys.map((skillKey) => `${level.subject}:${skillKey}`)
    )
  );
  const candidates = context.records
    .filter(
      (record) =>
        isAiSubject(record.subject) &&
        availableSkills.has(`${record.subject}:${record.skillKey}`)
    )
    .map((record) => ({
      ...record,
      accuracy:
        record.attempts === 0
          ? 0
          : Math.round((record.correctCount / record.attempts) * 100),
    }))
    .sort(
      (left, right) =>
        left.accuracy - right.accuracy ||
        right.averageAnswerTimeMs - left.averageAnswerTimeMs ||
        left.skillKey.localeCompare(right.skillKey)
    );
  const focus = candidates[0];
  if (!focus) return null;

  const currentDifficulty = clamp(
    focus.currentDifficulty,
    1,
    context.maxDifficulty
  );
  let allowedDifficulty = {
    min: currentDifficulty,
    max: currentDifficulty,
  };
  let deterministicDifficulty = currentDifficulty;
  let desiredBeforeParentLimit = currentDifficulty;

  if (focus.attempts >= minimumAdaptiveAttempts && focus.accuracy < 60) {
    allowedDifficulty = {
      min: Math.max(1, currentDifficulty - 1),
      max: currentDifficulty,
    };
    deterministicDifficulty = allowedDifficulty.min;
    desiredBeforeParentLimit = Math.max(1, currentDifficulty - 1);
  } else if (
    focus.attempts >= minimumAdaptiveAttempts &&
    focus.accuracy >= 80 &&
    focus.averageAnswerTimeMs <= fastAnswerThresholdMs
  ) {
    desiredBeforeParentLimit = currentDifficulty + 1;
    allowedDifficulty = {
      min: currentDifficulty,
      max: Math.min(context.maxDifficulty, currentDifficulty + 1),
    };
    deterministicDifficulty = allowedDifficulty.max;
  }

  return {
    focus,
    currentDifficulty,
    completedSessions: context.completedSessions,
    allowedDifficulty,
    deterministicDifficulty,
    skipAi: focus.attempts < minimumAdaptiveAttempts,
    parentLimited: desiredBeforeParentLimit > context.maxDifficulty,
    levels: context.levels.filter(
      (level) =>
        level.subject === focus.subject &&
        level.skillKeys.includes(focus.skillKey)
    ),
  };
}

export function resolveNextPractice(
  policy: AdaptivePracticePolicy,
  aiResponse: AiPracticeRecommendationResponse | null
): NextPracticeRecommendationDto | null {
  let proposedDifficulty = policy.deterministicDifficulty;
  let decision: NextPracticeRecommendationDto['decision'] = 'fallback';
  let reason: NextPracticeRecommendationDto['reason'] = policy.skipAi
    ? 'insufficient_data'
    : 'ai_unavailable';

  if (!policy.skipAi && aiResponse) {
    if (
      aiResponse.subject !== policy.focus.subject ||
      aiResponse.skillKey !== policy.focus.skillKey
    ) {
      decision = 'rejected';
      reason = 'invalid_focus';
    } else {
      proposedDifficulty = clamp(
        aiResponse.recommendedDifficulty,
        policy.allowedDifficulty.min,
        policy.allowedDifficulty.max
      );
      if (proposedDifficulty !== aiResponse.recommendedDifficulty) {
        decision = 'adjusted';
        reason = 'outside_policy';
      } else if (aiResponse.fallbackReason) {
        decision = 'fallback';
        reason = 'provider_fallback';
      } else {
        decision = 'adopted';
        reason = 'within_policy';
      }
    }
  }

  const allowedLevels = policy.levels.filter(
    (level) =>
      level.difficulty >= policy.allowedDifficulty.min &&
      level.difficulty <= policy.allowedDifficulty.max
  );
  const level = nearestLevel(allowedLevels, proposedDifficulty);
  if (!level) return null;
  if (level.difficulty !== proposedDifficulty) {
    decision = 'adjusted';
    reason = 'content_unavailable';
  } else if (policy.parentLimited && reason === 'within_policy') {
    decision = 'adjusted';
    reason = 'parent_limit';
  }

  return {
    levelId: level.id,
    subject: policy.focus.subject,
    skillKey: policy.focus.skillKey,
    difficulty: level.difficulty,
    intent: practiceIntent(policy.currentDifficulty, level.difficulty),
    decision,
    reason,
  };
}

function nearestLevel(
  levels: EligiblePracticeLevel[],
  difficulty: number
): EligiblePracticeLevel | undefined {
  return [...levels].sort(
    (left, right) =>
      Math.abs(left.difficulty - difficulty) -
        Math.abs(right.difficulty - difficulty) ||
      left.difficulty - right.difficulty ||
      left.id.localeCompare(right.id)
  )[0];
}

function practiceIntent(
  currentDifficulty: number,
  recommendedDifficulty: number
): PracticeIntent {
  if (recommendedDifficulty < currentDifficulty) return 'review';
  if (recommendedDifficulty > currentDifficulty) return 'challenge';
  return 'reinforce';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isAiSubject(
  subject: Subject
): subject is 'math' | 'english' | 'direction' {
  return subject === 'math' || subject === 'english' || subject === 'direction';
}
