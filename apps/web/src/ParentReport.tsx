import type {
  ParentReportDto,
  ParentReportMetricDto,
  ParentReportSummaryDto,
} from '@tankquest/shared';
import { useEffect, useState } from 'react';

import { readError } from './app-state.js';
import { ApiClient } from './client/api-client.js';
import { clientConfig } from './client/runtime-config.js';
import { useI18n } from './i18n/I18nProvider.js';
import { PreferenceControls } from './TrainingViews.js';

const api = new ApiClient(clientConfig.apiBaseUrl);

export function ParentReport() {
  const { locale, t } = useI18n();
  const [report, setReport] = useState<ParentReportDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setReport(null);
    setError(null);
    void api
      .getParentReport(clientConfig.demoChildId, locale)
      .then((data) => {
        if (active) setReport(data);
      })
      .catch((reason: unknown) => {
        if (active) setError(readError(reason));
      });
    return () => {
      active = false;
    };
  }, [locale]);

  return (
    <main className="app-shell parent-shell">
      <header className="parent-header">
        <div>
          <p className="eyebrow">{t('parent.area')}</p>
          <h1>{t('parent.title')}</h1>
        </div>
        <PreferenceControls />
      </header>
      {!report && !error && (
        <section className="status-card">{t('parent.loading')}</section>
      )}
      {report && (
        <>
          <section className="report-overview">
            <div>
              <span>{t('parent.range')}</span>
              <strong>
                {formatDate(report.range.from, locale)} –{' '}
                {formatDate(report.range.to, locale)}
              </strong>
            </div>
            <div>
              <span>{t('parent.sessions')}</span>
              <strong>{report.completedSessions}</strong>
            </div>
            <div>
              <span>{t('parent.answers')}</span>
              <strong>{report.totalAnswers}</strong>
            </div>
          </section>
          {report.summary && (
            <ReportSection title={t('parent.summary')}>
              <ParentReportSummary summary={report.summary} />
            </ReportSection>
          )}
          <ReportSection title={t('parent.subjects')}>
            {report.subjects.length ? (
              <div className="report-grid">
                {report.subjects.map((metric) => (
                  <MetricCard
                    key={metric.subject}
                    metric={metric}
                    title={t(`subject.${metric.subject}`)}
                  />
                ))}
              </div>
            ) : (
              <p>{t('parent.empty')}</p>
            )}
          </ReportSection>
          <ReportSection title={t('parent.skills')}>
            {report.recentSkills.length ? (
              <div className="report-grid">
                {report.recentSkills.map((metric) => (
                  <MetricCard
                    key={`${metric.subject}:${metric.skillKey}`}
                    metric={metric}
                    title={skillName(metric.skillKey, t)}
                  />
                ))}
              </div>
            ) : (
              <p>{t('parent.empty')}</p>
            )}
          </ReportSection>
          <ReportSection title={t('parent.next')}>
            <p>
              {report.focusSkill
                ? t('parent.focus', {
                    skill: skillName(report.focusSkill.skillKey, t),
                  })
                : t('parent.empty')}
            </p>
          </ReportSection>
          <a className="parent-return" href="/">
            {t('parent.return')}
          </a>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}

export function ParentReportSummary({
  summary,
}: {
  summary: ParentReportSummaryDto;
}) {
  const { t } = useI18n();
  return (
    <div className="summary-grid">
      <SummaryItem
        title={t('parent.summaryPractice')}
        value={summary.practiceContent}
      />
      <SummaryItem
        title={t('parent.summaryProgress')}
        value={summary.progress}
      />
      <SummaryItem
        title={t('parent.summaryAttention')}
        value={summary.attention}
      />
      <SummaryItem title={t('parent.summaryNext')} value={summary.nextStep} />
    </div>
  );
}

function SummaryItem({ title, value }: { title: string; value: string }) {
  return (
    <article className="summary-item">
      <h3>{title}</h3>
      <p>{value}</p>
    </article>
  );
}

function ReportSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="report-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function MetricCard({
  metric,
  title,
}: {
  metric: ParentReportMetricDto;
  title: string;
}) {
  const { t } = useI18n();
  return (
    <article className="metric-card">
      <h3>{title}</h3>
      <strong>{metric.accuracy}%</strong>
      <span>
        {t('parent.correct', {
          correct: metric.correctCount,
          attempts: metric.attempts,
        })}
      </span>
      <span>
        {t('parent.average', {
          seconds: (metric.averageAnswerTimeMs / 1000).toFixed(1),
        })}
      </span>
    </article>
  );
}

function skillName(
  skillKey: string | undefined,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  return skillKey ? t(`skill.${skillKey}`) : t('parent.unknownSkill');
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(value)
  );
}
