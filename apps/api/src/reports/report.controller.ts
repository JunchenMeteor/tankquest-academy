import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
  Query,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { ReportService } from './report.service.js';

@Controller('api/children/:childId/report')
export class ReportController {
  constructor(@Inject(ReportService) private readonly service: ReportService) {}

  @Get()
  async get(
    @Param('childId') childId: string,
    @Query('locale') requestedLocale?: string
  ) {
    const locale = requestedLocale ?? 'en';
    if (locale !== 'en' && locale !== 'zh-CN') {
      throw new BadRequestException('Unsupported report locale');
    }
    const data = await this.service.getParentReport(childId, locale);
    return { data, error: null, requestId: `req_${randomUUID()}` };
  }
}
