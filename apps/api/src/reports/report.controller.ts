import { Controller, Get, Inject, Param } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { ReportService } from './report.service.js';

@Controller('api/children/:childId/report')
export class ReportController {
  constructor(@Inject(ReportService) private readonly service: ReportService) {}

  @Get()
  async get(@Param('childId') childId: string) {
    const data = await this.service.getParentReport(childId);
    return { data, error: null, requestId: `req_${randomUUID()}` };
  }
}
