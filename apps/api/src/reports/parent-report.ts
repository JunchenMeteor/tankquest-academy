import type {
  ParentReportDto,
  ParentReportMetricDto,
  ParentReportSummaryDto,
  ParentReportTrend,
  Subject,
} from '@tankquest/shared';

const minimumTrendAttemptsPerWindow = 5;
const meaningfulAccuracyChange = 10;

export interface ReportAnswer {
  subject: Subject;
  skillKey: string;
  correct: boolean;
  answerTimeMs: number;
  difficulty: number;
  answeredAt: Date;
}

interface MetricAccumulator {
  subject: Subject;
  skillKey?: string;
  attempts: number;
  correctCount: number;
  totalAnswerTimeMs: number;
  currentDifficulty?: number;
  lastPracticedAt?: Date;
}

export function buildParentReport(input: {
  from: Date;
  to: Date;
  completedSessions: number;
  answers: ReportAnswer[];
}): ParentReportDto {
  const subjects = new Map<Subject, MetricAccumulator>();
  const skills = new Map<string, MetricAccumulator>();

  for (const answer of input.answers) {
    accumulate(subjects, answer.subject, answer);
    accumulate(skills, `${answer.subject}:${answer.skillKey}`, answer, true);
  }

  const subjectMetrics = [...subjects.values()]
    .map(toMetric)
    .sort((left, right) => left.subject.localeCompare(right.subject));
  const skillTrends = buildSkillTrends(input.answers, input.from, input.to);
  const skillMetrics = [...skills.entries()].map(([key, value]) => ({
    ...toMetric(value),
    trend: skillTrends.get(key) ?? 'insufficient-data',
  }));
  const recentSkills = skillMetrics
    .slice()
    .sort(
      (left, right) =>
        (right.lastPracticedAt ?? '').localeCompare(
          left.lastPracticedAt ?? ''
        ) || (left.skillKey ?? '').localeCompare(right.skillKey ?? '')
    )
    .slice(0, 5);
  const focus = skillMetrics
    .slice()
    .sort(
      (left, right) =>
        left.accuracy - right.accuracy ||
        left.subject.localeCompare(right.subject) ||
        (left.skillKey ?? '').localeCompare(right.skillKey ?? '')
    )[0];

  return {
    range: { from: input.from.toISOString(), to: input.to.toISOString() },
    completedSessions: input.completedSessions,
    totalAnswers: input.answers.length,
    subjects: subjectMetrics,
    recentSkills,
    focusSkill: focus
      ? { subject: focus.subject, skillKey: focus.skillKey }
      : null,
  };
}

export function buildDeterministicParentSummary(
  report: ParentReportDto,
  locale: 'en' | 'zh-CN'
): ParentReportSummaryDto {
  const improving = report.recentSkills.filter(
    (metric) => metric.trend === 'improving'
  );
  const hasComparableWindows = report.recentSkills.some(
    (metric) => metric.trend && metric.trend !== 'insufficient-data'
  );
  const focusMetric = report.recentSkills.find(
    (metric) =>
      metric.subject === report.focusSkill?.subject &&
      metric.skillKey === report.focusSkill.skillKey
  );
  const practicedSubjects = report.subjects.map((metric) =>
    subjectName(metric.subject, locale)
  );

  if (locale === 'zh-CN') {
    return {
      source: 'deterministic',
      practiceContent: report.totalAnswers
        ? `本期完成了 ${report.completedSessions} 局练习、${report.totalAnswers} 次答题，覆盖${practicedSubjects.join('、')}。`
        : '本期还没有完成练习，暂无可汇总的学习内容。',
      progress: improving.length
        ? `有 ${improving.length} 项技能在前后时段对比中表现出明确改善。`
        : hasComparableWindows
          ? '可比较的前后时段目前未显示明确改善信号，继续平稳练习并观察即可。'
          : '目前没有足够的前后时段证据判断明显进步，继续积累练习数据即可。',
      attention: focusMetric
        ? `当前可优先关注正确率为 ${focusMetric.accuracy}% 的技能，保持平静、分步练习。`
        : '目前没有足够数据确定需要优先关注的技能。',
      nextStep: focusMetric
        ? '下一步建议安排一次短时同类练习，并在完成后再观察正确率和耗时变化。'
        : '下一步建议先完成一局基础练习，再查看新的学习摘要。',
    };
  }

  return {
    source: 'deterministic',
    practiceContent: report.totalAnswers
      ? `This period includes ${report.completedSessions} completed sessions and ${report.totalAnswers} answers across ${practicedSubjects.join(', ')}.`
      : 'There are no completed practice activities to summarize yet.',
    progress: improving.length
      ? improving.length === 1
        ? '1 skill area shows clear improvement across the two practice windows.'
        : `${improving.length} skill areas show clear improvement across the two practice windows.`
      : hasComparableWindows
        ? 'The comparable practice windows do not show a clear improvement signal yet; steady practice is appropriate.'
        : 'There is not enough evidence across both practice windows to claim clear improvement yet.',
    attention: focusMetric
      ? `A calm next focus is the skill currently at ${focusMetric.accuracy}% accuracy.`
      : 'There is not enough data to identify a priority skill yet.',
    nextStep: focusMetric
      ? 'Try one short practice session on the focus skill, then review accuracy and answer time again.'
      : 'Complete one foundational practice session before reviewing the next learning summary.',
  };
}

function buildSkillTrends(
  answers: ReportAnswer[],
  from: Date,
  to: Date
): Map<string, ParentReportTrend> {
  const midpoint = (from.getTime() + to.getTime()) / 2;
  const windows = new Map<
    string,
    {
      earlyAttempts: number;
      earlyCorrect: number;
      lateAttempts: number;
      lateCorrect: number;
    }
  >();
  for (const answer of answers) {
    const key = `${answer.subject}:${answer.skillKey}`;
    const current = windows.get(key) ?? {
      earlyAttempts: 0,
      earlyCorrect: 0,
      lateAttempts: 0,
      lateCorrect: 0,
    };
    if (answer.answeredAt.getTime() < midpoint) {
      current.earlyAttempts += 1;
      current.earlyCorrect += answer.correct ? 1 : 0;
    } else {
      current.lateAttempts += 1;
      current.lateCorrect += answer.correct ? 1 : 0;
    }
    windows.set(key, current);
  }

  return new Map(
    [...windows.entries()].map(([key, value]) => [key, toTrend(value)])
  );
}

function toTrend(value: {
  earlyAttempts: number;
  earlyCorrect: number;
  lateAttempts: number;
  lateCorrect: number;
}): ParentReportTrend {
  if (
    value.earlyAttempts < minimumTrendAttemptsPerWindow ||
    value.lateAttempts < minimumTrendAttemptsPerWindow
  ) {
    return 'insufficient-data';
  }
  const earlyAccuracy = (value.earlyCorrect / value.earlyAttempts) * 100;
  const lateAccuracy = (value.lateCorrect / value.lateAttempts) * 100;
  if (lateAccuracy - earlyAccuracy >= meaningfulAccuracyChange) {
    return 'improving';
  }
  if (earlyAccuracy - lateAccuracy >= meaningfulAccuracyChange) {
    return 'needs-practice';
  }
  return 'steady';
}

function subjectName(subject: Subject, locale: 'en' | 'zh-CN'): string {
  if (locale === 'zh-CN') {
    return {
      math: '数学',
      english: '英语',
      direction: '方向',
      logic: '逻辑',
      physics: '物理',
    }[subject];
  }
  return {
    math: 'math',
    english: 'English',
    direction: 'direction',
    logic: 'logic',
    physics: 'physics',
  }[subject];
}

function accumulate(
  metrics: Map<string, MetricAccumulator>,
  key: string,
  answer: ReportAnswer,
  includeSkill = false
) {
  const current = metrics.get(key) ?? {
    subject: answer.subject,
    skillKey: includeSkill ? answer.skillKey : undefined,
    attempts: 0,
    correctCount: 0,
    totalAnswerTimeMs: 0,
  };
  current.attempts += 1;
  current.correctCount += answer.correct ? 1 : 0;
  current.totalAnswerTimeMs += answer.answerTimeMs;
  if (!current.lastPracticedAt || answer.answeredAt > current.lastPracticedAt) {
    current.lastPracticedAt = answer.answeredAt;
    current.currentDifficulty = answer.difficulty;
  }
  metrics.set(key, current);
}

function toMetric(metric: MetricAccumulator): ParentReportMetricDto {
  return {
    subject: metric.subject,
    ...(metric.skillKey ? { skillKey: metric.skillKey } : {}),
    attempts: metric.attempts,
    correctCount: metric.correctCount,
    accuracy: Math.round((metric.correctCount / metric.attempts) * 100),
    averageAnswerTimeMs: Math.round(metric.totalAnswerTimeMs / metric.attempts),
    ...(metric.currentDifficulty
      ? { currentDifficulty: metric.currentDifficulty }
      : {}),
    ...(metric.lastPracticedAt
      ? { lastPracticedAt: metric.lastPracticedAt.toISOString() }
      : {}),
  };
}
