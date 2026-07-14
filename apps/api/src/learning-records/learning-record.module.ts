import { Module } from '@nestjs/common';

import { PrismaService } from '../prisma.service.js';
import { LearningRecordController } from './learning-record.controller.js';
import { LearningRecordRepository } from './learning-record.repository.js';
import { LearningRecordService } from './learning-record.service.js';
import { PrismaLearningRecordRepository } from './prisma-learning-record.repository.js';

@Module({
  controllers: [LearningRecordController],
  providers: [
    PrismaService,
    LearningRecordService,
    {
      provide: LearningRecordRepository,
      useClass: PrismaLearningRecordRepository,
    },
  ],
})
export class LearningRecordModule {}
