import { Module } from '@nestjs/common';

import { PrismaService } from '../prisma.service.js';
import { PrismaReportRepository } from './prisma-report.repository.js';
import { ReportController } from './report.controller.js';
import { ReportRepository } from './report.repository.js';
import { ReportService } from './report.service.js';

@Module({
  controllers: [ReportController],
  providers: [
    PrismaService,
    ReportService,
    { provide: ReportRepository, useClass: PrismaReportRepository },
  ],
})
export class ReportModule {}
