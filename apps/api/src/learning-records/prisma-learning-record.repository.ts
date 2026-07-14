import { Inject, Injectable } from '@nestjs/common';
import type { LearningProgressDto } from '@tankquest/shared';

import { PrismaService } from '../prisma.service.js';
import { toLearningProgress } from './learning-progress.js';
import { LearningRecordRepository } from './learning-record.repository.js';

@Injectable()
export class PrismaLearningRecordRepository extends LearningRecordRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super();
  }

  async listProgress(childId: string): Promise<LearningProgressDto[]> {
    const records = await this.prisma.learningRecord.findMany({
      where: { childId },
      orderBy: [{ subject: 'asc' }, { skillKey: 'asc' }],
    });
    return records.map(toLearningProgress);
  }
}
