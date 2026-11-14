import { useState, type ReactNode } from 'react';
import {
  tankStatMax,
  tankUpgradeCost,
  upgradeableStats,
  type LevelDto,
  type OwnedTankDto,
  type TankSkinDto,
  type UpgradeableStat,
} from '@tankquest/shared';

import { combatProfileForStats } from './game/presentation/combat-profile.js';
import type { RuntimeLevelConfig } from './game/runtime/types.js';
import { useI18n } from './i18n/I18nProvider.js';

function Accordion({
  className,
  title,
  open,
  onToggle,
  children,
}: {
  className: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className={`${className}-panel`}>
      <button
        className={`${className}-toggle`}
        aria-expanded={open}
        onClick={onToggle}
      >
        {title}
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      <div className={`${className}-content`} hidden={!open}>
        {children}
      </div>
    </section>
  );
}

export function MissionPanel({
  levels,
  preview,
  selectedLevelId,
  onSelectLevel,
}: {
  levels: LevelDto[];
  preview: RuntimeLevelConfig | undefined;
  selectedLevelId: string;
  onSelectLevel: (levelId: string) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState('all');
  const filtered = levels.filter((level) => {
    const matchesQuery = t(`content.${level.code}`)
      .toLowerCase()
      .includes(query.trim().toLowerCase());
    return matchesQuery && (subject === 'all' || level.subject === subject);
  });
  return (
    <aside className="garage-missions">
      <header>
        <p className="garage-eyebrow">{t('garage.missionPanel')}</p>
        <h2>{t('picker.title')}</h2>
      </header>
      <input
        className="garage-search"
        aria-label={t('garage.searchMissions')}
        placeholder={t('garage.searchMissions')}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <select
        className="garage-subject-filter"
        aria-label={t('garage.subjectFilter')}
        value={subject}
        onChange={(event) => setSubject(event.target.value)}
      >
        <option value="all">{t('garage.allSubjects')}</option>
        <option value="math">{t('subject.math')}</option>
        <option value="english">{t('subject.english')}</option>
        <option value="direction">{t('subject.direction')}</option>
      </select>
      <div className="garage-mission-list" aria-label={t('picker.missions')}>
        {filtered.map((level) => (
          <button
            key={level.id}
            className={`garage-mission${level.id === selectedLevelId ? ' selected' : ''}`}
            aria-pressed={level.id === selectedLevelId}
            onClick={() => onSelectLevel(level.id)}
          >
            <strong>{t(`content.${level.code}`)}</strong>
            <span>
              {level.subject ? t(`subject.${level.subject}`) : null} ·{' '}
              {t('picker.difficulty', { value: level.baseDifficulty })}
            </span>
          </button>
        ))}
      </div>
      {preview && (
        <div className="garage-mission-summary">
          <h3>{t('garage.currentMission')}</h3>
          <p>{t('garage.missionSummary', { count: preview.enemies.length })}</p>
          <p>
            {t('picker.preview', {
              map: t(`content.${preview.mapStyle}`),
              enemies: preview.enemies.length,
            })}
          </p>
        </div>
      )}
    </aside>
  );
}

export function TankPanel({
  tank,
  skins,
  busy,
  online,
  onEquipSkin,
  onUpgrade,
}: {
  tank: OwnedTankDto;
  skins: TankSkinDto[];
  busy: boolean;
  online: boolean;
  onEquipSkin: (skinId: string) => void;
  onUpgrade: (stat: UpgradeableStat) => void;
}) {
  const { t } = useI18n();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(true);
  const [skinsOpen, setSkinsOpen] = useState(false);
  const [stat, setStat] = useState<UpgradeableStat>('firepower');
  const profile = combatProfileForStats(tank.stats);
  const cost = tankUpgradeCost(tank.upgradeLevels[stat]);
  const before = tank.stats[stat];
  const after = Math.min(tankStatMax, before + 1);
  return (
    <aside className="garage-stats">
      <header>
        <p className="garage-eyebrow">{t('garage.tankStatus')}</p>
        <h2>{t(`content.${tank.code}`)}</h2>
      </header>
      <dl className="garage-stat-bars">
        {(['firepower', 'mobility', 'armor', 'stealth', 'vision'] as const).map(
          (key) => (
            <div key={key}>
              <dt>{t(`stat.${key}`)}</dt>
              <dd>
                <meter min={0} max={tankStatMax} value={tank.stats[key]} />
                <span>{tank.stats[key]}</span>
              </dd>
            </div>
          )
        )}
      </dl>
      <Accordion
        className="garage-details"
        title={t('garage.detailedStats')}
        open={detailsOpen}
        onToggle={() => setDetailsOpen((value) => !value)}
      >
        <dl className="garage-details">
          <div>
            <dt>{t('stat.health')}</dt>
            <dd>{profile.health}</dd>
          </div>
          <div>
            <dt>{t('stat.shell')}</dt>
            <dd>{profile.damage}</dd>
          </div>
          <div>
            <dt>{t('stat.penetration')}</dt>
            <dd>{profile.penetration}</dd>
          </div>
          <div>
            <dt>{t('stat.reload')}</dt>
            <dd>{profile.reloadSeconds}s</dd>
          </div>
          <div>
            <dt>{t('stat.speed')}</dt>
            <dd>{profile.topSpeed}</dd>
          </div>
          <div>
            <dt>{t('stat.detection')}</dt>
            <dd>{profile.detectionRange}</dd>
          </div>
          <div>
            <dt>{t('stat.armor')}</dt>
            <dd>{profile.frontArmor}</dd>
          </div>
        </dl>
      </Accordion>
      <Accordion
        className="garage-upgrade"
        title={t('result.chooseStat')}
        open={upgradeOpen}
        onToggle={() => setUpgradeOpen((value) => !value)}
      >
        <label className="upgrade-stat-picker">
          <span>{t('result.chooseStat')}</span>
          <select
            aria-label={t('result.chooseStat')}
            disabled={busy}
            value={stat}
            onChange={(event) => setStat(event.target.value as UpgradeableStat)}
          >
            {upgradeableStats.map((key) => (
              <option key={key} value={key}>
                {t(`stat.${key}`)} · {tank.upgradeLevels[key]}/{tankStatMax}
              </option>
            ))}
          </select>
        </label>
        <p className="garage-upgrade-delta">
          {t(`stat.${stat}`)}: {before} → {after}
        </p>
        <button
          className="garage-upgrade-button"
          disabled={busy || !online || cost === null}
          onClick={() => onUpgrade(stat)}
        >
          {cost === null
            ? t('result.max', { max: tankStatMax, stat: t(`stat.${stat}`) })
            : t('result.upgrade', { cost, stat: t(`stat.${stat}`) })}
        </button>
      </Accordion>
      <Accordion
        className="garage-skins"
        title={t('picker.skins')}
        open={skinsOpen}
        onToggle={() => setSkinsOpen((value) => !value)}
      >
        <div className="skin-picker" aria-label={t('picker.skins')}>
          {skins.map((skin) => (
            <button
              key={skin.id}
              className={`garage-skin${skin.equipped ? ' selected' : ''}`}
              aria-pressed={skin.equipped}
              disabled={busy || !online || !skin.unlocked}
              onClick={() => onEquipSkin(skin.id)}
            >
              <span
                className="skin-swatch"
                style={{
                  background: `linear-gradient(135deg, ${skin.primaryColor} 50%, ${skin.secondaryColor} 50%)`,
                }}
              />
              {t(`content.${skin.code}`)}
            </button>
          ))}
        </div>
      </Accordion>
    </aside>
  );
}
