import { Controller, Get, Inject, Param } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { LearningRecordService } from './learning-record.service.js';

@Controller('api/children/:childId/progress')
export class LearningRecordController {
  constructor(
    @Inject(LearningRecordService)
    private readonly service: LearningRecordService
  ) {}

  @Get()
  async list(@Param('childId') childId: string) {
    const data = await this.service.listProgress(childId);
    return { data, error: null, requestId: `req_${randomUUID()}` };
  }
}
