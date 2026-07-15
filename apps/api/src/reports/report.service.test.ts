import { NotFoundException } from '@nestjs/common';
import type { ParentReportDto } from '@tankquest/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AiGatewayService } from '../ai/ai-gateway.service.js';
import type { ReportRepository } from './report.repository.js';
import { ReportService } from './report.service.js';

const report: ParentReportDto = {
  range: {
    from: '2026-06-15T00:00:00.000Z',
    to: '2026-07-15T00:00:00.000Z',
  },
  completedSessions: 4,
  totalAnswers: 12,
  subjects: [
    {
      subject: 'math',
      attempts: 12,
      correctCount: 9,
      accuracy: 75,
      averageAnswerTimeMs: 4_000,
    },
  ],
  recentSkills: [
    {
      subject: 'math',
      skillKey: 'addition-within-20',
      attempts: 6,
      correctCount: 5,
      accuracy: 83,
      averageAnswerTimeMs: 3_000,
      currentDifficulty: 2,
      lastPracticedAt: '2026-07-14T00:00:00.000Z',
      trend: 'improving',
    },
  ],
  focusSkill: { subject: 'math', skillKey: 'addition-within-20' },
};

describe('ReportService', () => {
  let repository: { getParentReport: ReturnType<typeof vi.fn> };
  let aiGateway: { createParentReportSummary: ReturnType<typeof vi.fn> };
  let service: ReportService;

  beforeEach(() => {
    repository = { getParentReport: vi.fn().mockResolvedValue(report) };
    aiGateway = {
      createParentReportSummary: vi.fn().mockResolvedValue({
        requestId: 'e96e124f-98d5-44b9-9690-002f7a5a5454',
        source: 'model',
        fallbackReason: null,
        summary: {
          practiceContent: 'Practice covered math.',
          progress: 'One skill shows evidence of improvement.',
          attention: 'Addition remains a useful focus.',
          nextStep: 'Try one short addition practice session.',
        },
      }),
    };
    service = new ReportService(
      repository as unknown as ReportRepository,
      aiGateway as unknown as AiGatewayService
    );
  });

  it('uses a safe model summary without sending identity or raw activity', async () => {
    await expect(
      service.getParentReport('child_secret', 'en')
    ).resolves.toMatchObject({
      subjects: report.subjects,
      recentSkills: report.recentSkills,
      summary: {
        source: 'model',
        progress:
          '1 skill area shows clear improvement across the two practice windows.',
      },
    });
    const payload = aiGateway.createParentReportSummary.mock.calls[0]?.[0];
    expect(payload).toEqual({
      locale: 'en',
      completedSessions: 4,
      totalAnswers: 12,
      subjects: [
        {
          subject: 'math',
          attempts: 12,
          accuracy: 75,
          averageAnswerTimeMs: 4_000,
        },
      ],
      skills: [
        {
          subject: 'math',
          skillKey: 'addition-within-20',
          attempts: 6,
          accuracy: 83,
          averageAnswerTimeMs: 3_000,
          currentDifficulty: 2,
          trend: 'improving',
        },
      ],
    });
    expect(JSON.stringify(payload)).not.toMatch(
      /child_secret|childId|name|birth|answerId|question|session|event|2026-/
    );
  });

  it.each([
    'This child is stupid and far behind.',
    'This child has ADHD and is a slow learner.',
    'Practice was steady. Keep going.',
  ])('falls back locally when model language is unsafe: %s', async (text) => {
    aiGateway.createParentReportSummary.mockResolvedValueOnce({
      source: 'model',
      fallbackReason: null,
      summary: {
        practiceContent: 'Practice covered math.',
        progress: 'Progress follows the backend signal.',
        attention: text,
        nextStep: 'Try one short session.',
      },
    });

    const result = await service.getParentReport('child_secret', 'en');
    expect(result.summary.source).toBe('deterministic');
    expect(JSON.stringify(result.summary)).not.toContain(text);
    expect(result.subjects).toEqual(report.subjects);
  });

  it('keeps progress backend-owned when the model contradicts trend data', async () => {
    repository.getParentReport.mockResolvedValueOnce({
      ...report,
      recentSkills: [{ ...report.recentSkills[0]!, trend: 'steady' }],
    });
    aiGateway.createParentReportSummary.mockResolvedValueOnce({
      source: 'model',
      fallbackReason: null,
      summary: {
        practiceContent: 'Practice covered math.',
        progress: 'Accuracy clearly improved.',
        attention: 'Addition remains a useful focus.',
        nextStep: 'Try one short session.',
      },
    });

    const result = await service.getParentReport('child_secret', 'en');
    expect(result.summary.source).toBe('model');
    expect(result.summary.progress).toContain(
      'do not show a clear improvement signal'
    );
    expect(result.summary.progress).not.toContain('clearly improved');
  });

  it('skips AI for an empty report and returns a localized summary', async () => {
    repository.getParentReport.mockResolvedValueOnce({
      ...report,
      completedSessions: 0,
      totalAnswers: 0,
      subjects: [],
      recentSkills: [],
      focusSkill: null,
    });

    const result = await service.getParentReport('child_secret', 'zh-CN');
    expect(result.summary).toMatchObject({
      source: 'deterministic',
      practiceContent: expect.stringContaining('暂无'),
    });
    expect(aiGateway.createParentReportSummary).not.toHaveBeenCalled();
  });

  it('keeps a missing report as a not-found boundary', async () => {
    repository.getParentReport.mockResolvedValueOnce(null);
    await expect(
      service.getParentReport('missing', 'en')
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
