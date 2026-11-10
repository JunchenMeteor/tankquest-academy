import {
  tankStatMax,
  tankUpgradeCost,
  upgradeableStats,
  type FinishSessionResponse,
  type OwnedTankDto,
  type UpgradeableStat,
  type UpgradeTankResponse,
} from '@tankquest/shared';
import { useState } from 'react';

import { combatProfileForStats } from './game/presentation/combat-profile.js';
import { upgradeEffects } from './game/presentation/upgrade-effects.js';
import type { RuntimeState } from './game/runtime/types.js';
import { useI18n } from './i18n/I18nProvider.js';

interface MissionResultProps {
  busy: boolean;
  enemyTotal: number;
  online: boolean;
  runtime: RuntimeState;
  settlement: FinishSessionResponse;
  tank: OwnedTankDto;
  upgrade: UpgradeTankResponse | null;
  onContinue: () => void;
  onNextPractice: () => void;
  onReplay: () => void;
  onUpgrade: (stat: UpgradeableStat) => void;
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
  const [selectedStat, setSelectedStat] =
    useState<UpgradeableStat>('firepower');
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
  const currentLevel = tank.upgradeLevels[selectedStat];
  const cost = tankUpgradeCost(currentLevel);
  const selectedMaxed = cost === null;
  const previewStat = upgrade?.stat ?? selectedStat;
  const beforeStats = upgrade
    ? {
        ...tank.stats,
        [upgrade.stat]: Math.max(1, upgrade.effectiveValue - 1),
      }
    : tank.stats;
  const afterStats = {
    ...tank.stats,
    [previewStat]:
      upgrade?.effectiveValue ??
      Math.min(tankStatMax, tank.stats[previewStat] + 1),
  };
  const beforeUpgrade = combatProfileForStats(beforeStats);
  const afterUpgrade = combatProfileForStats(afterStats);
  const effects = upgradeEffects(beforeUpgrade, afterUpgrade, previewStat);

  return (
    <section className="status-card result-card">
      <header className="result-hero">
        <p
          className="stars"
          aria-label={t('result.stars', { count: settlement.stars })}
        >
          <span>{'★'.repeat(settlement.stars)}</span>
          <span aria-hidden="true" className="stars-empty">
            {'☆'.repeat(Math.max(0, 3 - settlement.stars))}
          </span>
        </p>
        <h2>{t('result.complete')}</h2>
        <p className="result-lede">
          {t('result.summary', {
            correct: settlement.learningSummary.correct,
            total: settlement.learningSummary.total,
            parts,
          })}
        </p>
      </header>
      <dl className="result-stats">
        <div>
          <dt>{t('result.stat.stars')}</dt>
          <dd>{settlement.stars}/3</dd>
        </div>
        <div>
          <dt>{t('result.stat.accuracy')}</dt>
          <dd>{accuracy}%</dd>
        </div>
        <div>
          <dt>{t('result.stat.defeated')}</dt>
          <dd>
            {enemiesDefeated}/{enemyTotal}
          </dd>
        </div>
        <div>
          <dt>{t('result.stat.parts')}</dt>
          <dd>{parts}</dd>
        </div>
      </dl>
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
      <section className={upgrade ? 'upgrade-confirmation' : 'upgrade-panel'}>
        <label className="upgrade-stat-picker">
          <span>{t('result.chooseStat')}</span>
          <select
            aria-label={t('result.chooseStat')}
            disabled={busy || Boolean(upgrade)}
            onChange={(event) =>
              setSelectedStat(event.target.value as UpgradeableStat)
            }
            value={selectedStat}
          >
            {upgradeableStats.map((stat) => (
              <option key={stat} value={stat}>
                {t(`stat.${stat}`)} · {tank.stats[stat]}/{tankStatMax} · Lv
                {tank.upgradeLevels[stat]}
              </option>
            ))}
          </select>
        </label>
        {upgrade && (
          <>
            <strong>
              {t('result.upgraded', {
                stat: t(`stat.${upgrade.stat}`),
                value: upgrade.effectiveValue,
                max: tankStatMax,
              })}
            </strong>
            <span>{t('result.parts', { count: upgrade.remainingParts })}</span>
          </>
        )}
        <dl className="upgrade-deltas">
          {effects.map((effect) => (
            <UpgradeDelta
              key={effect.labelKey}
              label={t(effect.labelKey)}
              before={effect.before}
              after={effect.after}
            />
          ))}
        </dl>
        {!upgrade && (
          <button
            disabled={busy || !online || selectedMaxed}
            onClick={() => onUpgrade(selectedStat)}
          >
            {selectedMaxed
              ? t('result.max', {
                  max: tankStatMax,
                  stat: t(`stat.${selectedStat}`),
                })
              : t('result.upgrade', {
                  cost,
                  stat: t(`stat.${selectedStat}`),
                })}
          </button>
        )}
        {selectedMaxed && !upgrade && (
          <p className="upgrade-max" role="status">
            {t('result.saved')}
          </p>
        )}
        {upgrade && <p>{t('result.effect')}</p>}
      </section>
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
  after: number;
  before: number;
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
