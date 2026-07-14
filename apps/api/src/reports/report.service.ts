import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { ReportRepository } from './report.repository.js';

@Injectable()
export class ReportService {
  constructor(
    @Inject(ReportRepository) private readonly repository: ReportRepository
  ) {}

  async getParentReport(childId: string) {
    const report = await this.repository.getParentReport(childId, new Date());
    if (!report) throw new NotFoundException('Child report was not found');
    return report;
  }
}
