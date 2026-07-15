import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ParentReportDto,
  ParentReportSummaryDto,
} from '@tankquest/shared';

import { AiGatewayService } from '../ai/ai-gateway.service.js';
import { buildDeterministicParentSummary } from './parent-report.js';
import { ReportRepository } from './report.repository.js';

@Injectable()
export class ReportService {
  constructor(
    @Inject(ReportRepository) private readonly repository: ReportRepository,
    @Inject(AiGatewayService)
    private readonly aiGateway: AiGatewayService
  ) {}

  async getParentReport(childId: string, locale: 'en' | 'zh-CN') {
    const report = await this.repository.getParentReport(childId, new Date());
    if (!report) throw new NotFoundException('Child report was not found');
    const deterministicSummary = buildDeterministicParentSummary(
      report,
      locale
    );
    const request = toAiRequest(report, locale);
    if (!request || report.totalAnswers === 0) {
      return { ...report, summary: deterministicSummary };
    }

    const response = await this.aiGateway.createParentReportSummary(request);
    const summary =
      response?.source === 'model' &&
      response.fallbackReason === null &&
      isSafeParentSummary(response.summary)
        ? {
            ...response.summary,
            progress: deterministicSummary.progress,
            source: 'model' as const,
          }
        : deterministicSummary;
    return { ...report, summary };
  }
}

function toAiRequest(report: ParentReportDto, locale: 'en' | 'zh-CN') {
  const subjects = report.subjects
    .slice(0, 5)
    .map(({ subject, attempts, accuracy, averageAnswerTimeMs }) => ({
      subject,
      attempts,
      accuracy,
      averageAnswerTimeMs,
    }));
  const skills = report.recentSkills
    .filter((metric) => metric.skillKey && metric.trend)
    .slice(0, 5)
    .map((metric) => ({
      subject: metric.subject,
      skillKey: metric.skillKey!,
      attempts: metric.attempts,
      accuracy: metric.accuracy,
      averageAnswerTimeMs: metric.averageAnswerTimeMs,
      ...(metric.currentDifficulty
        ? { currentDifficulty: metric.currentDifficulty }
        : {}),
      trend: metric.trend!,
    }));
  if (!subjects.length || !skills.length) return null;
  return {
    locale,
    completedSessions: report.completedSessions,
    totalAnswers: report.totalAnswers,
    subjects,
    skills,
  };
}

function isSafeParentSummary(
  summary: Omit<ParentReportSummaryDto, 'source'>
): boolean {
  if (Object.values(summary).some((value) => sentenceCount(value) > 1)) {
    return false;
  }
  const content = Object.values(summary).join(' ');
  return !(
    /https?:\/\/|www\./i.test(content) ||
    /\b(?:diagnos(?:e|is)|disorder|therapy|medication|adhd|autis(?:m|tic)|dyslexi(?:a|c)|depress(?:ion|ed)|stupid|dumb|lazy|talentless|hopeless|alarming|concerning|gifted|genius|brilliant|unintelligent|intelligence|iq|full name|home address|phone number|email address|school name)\b/i.test(
      content
    ) ||
    /\b(?:serious problem|must act immediately|must act now|far behind|low ability|high ability|personality type|slow learner|urgent intervention)\b/i.test(
      content
    ) ||
    /\b(?:provide|share|send).{0,30}(?:name|address|phone|email|school)\b/i.test(
      content
    ) ||
    /(?:诊断|疾病|治疗|药物|多动症|自闭症|抑郁|笨蛋|笨孩子|愚蠢|懒惰|没有天赋|能力差|能力不足|智力|智商|天才|聪明孩子|性格标签|落后|失败|没希望|严重问题|必须立即|令人担忧|姓名|家庭住址|电话号码|邮箱地址|学校名称)/.test(
      content
    )
  );
}

function sentenceCount(value: string): number {
  return value
    .split(/(?:[!?。！？]+|[.]+(?=\s|$))/)
    .filter((part) => part.trim()).length;
}
