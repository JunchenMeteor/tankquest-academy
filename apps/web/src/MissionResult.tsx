import {
  tankStatMax,
  type FinishSessionResponse,
  type TankDto,
  type UpgradeTankResponse,
} from '@tankquest/shared';

import { useI18n } from './i18n/I18nProvider.js';

interface MissionResultProps {
  busy: boolean;
  online: boolean;
  settlement: FinishSessionResponse;
  tank: TankDto;
  upgrade: UpgradeTankResponse | null;
  onContinue: () => void;
  onNextPractice: () => void;
  onReplay: () => void;
  onUpgrade: () => void;
}

export function MissionResult({
  busy,
  online,
  settlement,
  tank,
  upgrade,
  onContinue,
  onNextPractice,
  onReplay,
  onUpgrade,
}: MissionResultProps) {
  const { t } = useI18n();
  const firepowerMaxed = tank.stats.firepower >= tankStatMax;
  const parts =
    settlement.rewards.find((reward) => reward.type === 'part')?.amount ?? 0;

  return (
    <section className="status-card">
      <p
        className="stars"
        aria-label={t('result.stars', { count: settlement.stars })}
      >
        {'★'.repeat(settlement.stars)}
      </p>
      <h2>{t('result.complete')}</h2>
      <p>
        {t('result.summary', {
          correct: settlement.learningSummary.correct,
          total: settlement.learningSummary.total,
          parts,
        })}
      </p>
      <button
        disabled={busy || !online || Boolean(upgrade) || firepowerMaxed}
        onClick={onUpgrade}
      >
        {firepowerMaxed
          ? t('result.max', { max: tankStatMax })
          : t('result.upgrade')}
      </button>
      {firepowerMaxed && !upgrade && (
        <p className="upgrade-max" role="status">
          {t('result.saved')}
        </p>
      )}
      {upgrade && (
        <div className="upgrade-confirmation" role="status">
          <strong>
            {t('result.upgraded', {
              value: upgrade.effectiveValue,
              max: tankStatMax,
            })}
          </strong>
          <span>{t('result.parts', { count: upgrade.remainingParts })}</span>
          <p>{t('result.effect')}</p>
        </div>
      )}
      {settlement.nextPractice && (
        <div className="next-practice" role="status">
          <strong>{t('result.nextPractice')}</strong>
          <p>
            {t('result.nextPracticeSummary', {
              subject: t(`subject.${settlement.nextPractice.subject}`),
              skill: settlement.nextPractice.skillKey,
              difficulty: settlement.nextPractice.difficulty,
            })}
          </p>
          <button disabled={busy} onClick={onNextPractice}>
            {t('result.selectNextPractice')}
          </button>
        </div>
      )}
      <div className="result-actions">
        <button disabled={busy || !online} onClick={onReplay}>
          {t('action.replay')}
        </button>
        <button disabled={busy} onClick={onContinue}>
          {upgrade ? t('action.useUpgrade') : t('action.return')}
        </button>
      </div>
    </section>
  );
}
