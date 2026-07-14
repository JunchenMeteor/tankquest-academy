import { Inject, Injectable } from '@nestjs/common';
import { subjectSchema } from '@tankquest/shared';

import { PrismaService } from '../prisma.service.js';
import { buildParentReport } from './parent-report.js';
import { ReportRepository } from './report.repository.js';

const REPORT_DAYS = 30;

@Injectable()
export class PrismaReportRepository extends ReportRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super();
  }

  async getParentReport(childId: string, now: Date) {
    const from = new Date(now);
    from.setUTCDate(from.getUTCDate() - REPORT_DAYS);
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      select: { id: true },
    });
    if (!child) return null;

    const sessions = await this.prisma.gameSession.findMany({
      where: {
        childId,
        status: 'finished',
        finishedAt: { gte: from, lte: now },
      },
      orderBy: { finishedAt: 'asc' },
      select: {
        answers: {
          where: { createdAt: { gte: from, lte: now } },
          orderBy: { createdAt: 'asc' },
          select: {
            isCorrect: true,
            answerTimeMs: true,
            createdAt: true,
            question: {
              select: { subject: true, skillKey: true, difficulty: true },
            },
          },
        },
      },
    });

    return buildParentReport({
      from,
      to: now,
      completedSessions: sessions.length,
      answers: sessions.flatMap((session) =>
        session.answers.map((answer) => ({
          subject: subjectSchema.parse(answer.question.subject),
          skillKey: answer.question.skillKey,
          correct: answer.isCorrect,
          answerTimeMs: answer.answerTimeMs,
          difficulty: answer.question.difficulty,
          answeredAt: answer.createdAt,
        }))
      ),
    });
  }
}
