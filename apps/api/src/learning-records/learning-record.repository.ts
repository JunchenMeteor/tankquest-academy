import type { LearningProgressDto } from '@tankquest/shared';

export abstract class LearningRecordRepository {
  abstract listProgress(childId: string): Promise<LearningProgressDto[]>;
}
