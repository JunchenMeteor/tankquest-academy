import {
  tankStatMax,
  type FinishSessionResponse,
  type TankDto,
  type UpgradeTankResponse,
} from '@tankquest/shared';

import { combatProfileForStats } from './game/presentation/combat-profile.js';
import type { RuntimeState } from './game/runtime/types.js';
import { useI18n } from './i18n/I18nProvider.js';

interface MissionResultProps {
  busy: boolean;
  enemyTotal: number;
  online: boolean;
  runtime: RuntimeState;
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
  enemyTotal,
  online,
  runtime,
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
  const accuracy =
    settlement.learningSummary.total === 0
      ? 0
      : Math.round(
          (settlement.learningSummary.correct /
            settlement.learningSummary.total) *
            100
        );
  const enemiesDefeated = Math.max(0, enemyTotal - runtime.enemiesRemaining);
  const beforeUpgrade = combatProfileForStats(tank.stats);
  const afterUpgrade = upgrade
    ? combatProfileForStats({
        ...tank.stats,
        [upgrade.stat]: upgrade.effectiveValue,
      })
    : null;

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
      <div className="result-breakdown">
        <section>
          <h3>{t('result.learning')}</h3>
          <p>
            {t('result.learningSummary', {
              accuracy,
              correct: settlement.learningSummary.correct,
              stars: settlement.stars,
              total: settlement.learningSummary.total,
            })}
          </p>
        </section>
        <section>
          <h3>{t('result.battle')}</h3>
          <p>
            {t('result.battleSummary', {
              current: runtime.objectiveCurrent,
              defeated: enemiesDefeated,
              health: runtime.playerHealth,
              maxHealth: runtime.playerMaxHealth,
              shots: runtime.shotsFired,
              target: runtime.objectiveTarget,
            })}
          </p>
        </section>
        <section>
          <h3>{t('result.rewards')}</h3>
          <ul>
            {settlement.rewards.map((reward) => (
              <li key={`${reward.type}:${reward.key}`}>
                {t(`result.reward.${reward.type}`, {
                  amount: reward.amount,
                  stars: settlement.stars,
                })}
              </li>
            ))}
          </ul>
        </section>
      </div>
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
          {afterUpgrade && (
            <dl className="upgrade-deltas">
              <UpgradeDelta
                label={t('stat.shell')}
                before={beforeUpgrade.damage}
                after={afterUpgrade.damage}
              />
              <UpgradeDelta
                label={t('stat.penetration')}
                before={beforeUpgrade.penetration}
                after={afterUpgrade.penetration}
              />
              <UpgradeDelta
                label={t('stat.projectileSpeed')}
                before={beforeUpgrade.projectileSpeed}
                after={afterUpgrade.projectileSpeed}
              />
              <UpgradeDelta
                label={t('stat.reload')}
                before={`${beforeUpgrade.reloadSeconds}s`}
                after={`${afterUpgrade.reloadSeconds}s`}
              />
            </dl>
          )}
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

function UpgradeDelta({
  after,
  before,
  label,
}: {
  after: number | string;
  before: number | string;
  label: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {before} → {after}
      </dd>
    </div>
  );
}
