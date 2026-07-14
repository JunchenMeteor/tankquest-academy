import { subjectSchema, type LearningProgressDto } from '@tankquest/shared';

export function toLearningProgress(record: {
  subject: string;
  skillKey: string;
  attempts: number;
  correctCount: number;
  averageAnswerTimeMs: number;
  currentDifficulty: number;
  updatedAt: Date;
}): LearningProgressDto {
  return {
    subject: subjectSchema.parse(record.subject),
    skillKey: record.skillKey,
    attempts: record.attempts,
    correctCount: record.correctCount,
    accuracy:
      record.attempts === 0
        ? 0
        : Math.round((record.correctCount / record.attempts) * 100),
    averageAnswerTimeMs: record.averageAnswerTimeMs,
    currentDifficulty: record.currentDifficulty,
    updatedAt: record.updatedAt.toISOString(),
  };
}
