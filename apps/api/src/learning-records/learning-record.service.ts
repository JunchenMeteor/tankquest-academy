import { Inject, Injectable } from '@nestjs/common';
import type { LearningProgressDto } from '@tankquest/shared';

import { LearningRecordRepository } from './learning-record.repository.js';

@Injectable()
export class LearningRecordService {
  constructor(
    @Inject(LearningRecordRepository)
    private readonly repository: LearningRecordRepository
  ) {}

  listProgress(childId: string): Promise<LearningProgressDto[]> {
    return this.repository.listProgress(childId);
  }
}
