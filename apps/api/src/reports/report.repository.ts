import type { ParentReportDto } from '@tankquest/shared';

export abstract class ReportRepository {
  abstract getParentReport(
    childId: string,
    now: Date
  ): Promise<ParentReportDto | null>;
}
