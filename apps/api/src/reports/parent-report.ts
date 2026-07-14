import type {
  ParentReportDto,
  ParentReportMetricDto,
  Subject,
} from '@tankquest/shared';

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
  const skillMetrics = [...skills.values()].map(toMetric);
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
