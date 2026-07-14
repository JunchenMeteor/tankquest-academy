import {
  tankStatMax,
  type FinishSessionResponse,
  type TankDto,
  type UpgradeTankResponse,
} from '@tankquest/shared';

interface MissionResultProps {
  busy: boolean;
  settlement: FinishSessionResponse;
  tank: TankDto;
  upgrade: UpgradeTankResponse | null;
  onContinue: () => void;
  onUpgrade: () => void;
}

export function MissionResult({
  busy,
  settlement,
  tank,
  upgrade,
  onContinue,
  onUpgrade,
}: MissionResultProps) {
  const firepowerMaxed = tank.stats.firepower >= tankStatMax;
  const parts =
    settlement.rewards.find((reward) => reward.type === 'part')?.amount ?? 0;

  return (
    <section className="status-card">
      <p className="stars" aria-label={`${settlement.stars} stars`}>
        {'★'.repeat(settlement.stars)}
      </p>
      <h2>Mission complete</h2>
      <p>
        {settlement.learningSummary.correct}/{settlement.learningSummary.total}{' '}
        challenges correct · {parts} cannon parts earned
      </p>
      <button
        disabled={busy || Boolean(upgrade) || firepowerMaxed}
        onClick={onUpgrade}
      >
        {firepowerMaxed
          ? `Firepower is at maximum (${tankStatMax}/${tankStatMax})`
          : 'Spend 2 parts: upgrade firepower'}
      </button>
      {firepowerMaxed && !upgrade && (
        <p className="upgrade-max" role="status">
          No parts were spent. Your saved parts can be used for other upgrades
          later.
        </p>
      )}
      {upgrade && (
        <div className="upgrade-confirmation" role="status">
          <strong>
            Upgrade complete: Firepower {upgrade.effectiveValue}/{tankStatMax}
          </strong>
          <span>{upgrade.remainingParts} cannon parts remain.</span>
          <p>The new projectile speed and reload time apply next mission.</p>
          <button onClick={onContinue}>Use upgrade in next mission</button>
        </div>
      )}
    </section>
  );
}
