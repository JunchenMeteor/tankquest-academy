import { lazy, Suspense } from 'react';
import type {
  LevelDto,
  OwnedTankDto,
  TankSkinDto,
  UpgradeableStat,
} from '@tankquest/shared';

import { MissionPanel, TankPanel } from './GaragePanels.js';
import { TankPreview } from './game/presentation/TankPreview.js';
import type { RuntimeLevelConfig } from './game/runtime/types.js';
import { useI18n } from './i18n/I18nProvider.js';

const GarageTankPreview = lazy(
  () => import('./game/three/GarageTankPreview.js')
);

export interface GarageHomeProps {
  busy: boolean;
  online: boolean;
  levels: LevelDto[];
  preview: RuntimeLevelConfig | undefined;
  selectedLevelId: string;
  selectedTankId: string;
  tanks: OwnedTankDto[];
  skins: TankSkinDto[];
  onSelectLevel: (levelId: string) => void;
  onSelectTank: (tankId: string) => void;
  onEquipSkin: (skinId: string) => void;
  onUpgrade: (stat: UpgradeableStat) => void;
  onStart: () => void;
}

export function GarageHome(props: GarageHomeProps) {
  const { t } = useI18n();
  const tank =
    props.tanks.find((item) => item.id === props.selectedTankId) ??
    props.tanks[0];
  const level =
    props.levels.find((item) => item.id === props.selectedLevelId) ??
    props.levels[0];
  if (!tank || !level) return null;
  const skin = props.skins.find((item) => item.equipped);

  return (
    <section className="garage-page" aria-label={t('garage.title')}>
      <MissionPanel
        levels={props.levels}
        preview={props.preview}
        selectedLevelId={props.selectedLevelId}
        onSelectLevel={props.onSelectLevel}
      />
      <div className="garage-stage">
        <header className="garage-stage-heading">
          <div>
            <p className="garage-eyebrow">{t('garage.currentTank')}</p>
            <h2>{t(`content.${tank.code}`)}</h2>
            <p>
              {t(`role.${tank.role}`)} ·{' '}
              {t('picker.level', { value: tank.level })}
            </p>
          </div>
          <span className="garage-mission-tag">
            {t(`content.${level.code}`)}
          </span>
        </header>
        <div className="garage-preview-frame">
          <Suspense
            fallback={
              <TankPreview
                code={tank.code}
                primaryColor={skin?.primaryColor}
                secondaryColor={skin?.secondaryColor}
              />
            }
          >
            <GarageTankPreview
              code={tank.code}
              primaryColor={skin?.primaryColor}
              secondaryColor={skin?.secondaryColor}
            />
          </Suspense>
        </div>
        <div
          className="garage-tank-choices"
          aria-label={t('picker.ownedTanks')}
        >
          {props.tanks.map((item) => (
            <button
              key={item.id}
              className={`garage-tank-choice${item.id === tank.id ? ' selected' : ''}`}
              aria-pressed={item.id === tank.id}
              onClick={() => props.onSelectTank(item.id)}
            >
              <strong>{t(`content.${item.code}`)}</strong>
              <span>{t(`role.${item.role}`)}</span>
            </button>
          ))}
        </div>
      </div>
      <TankPanel
        tank={tank}
        skins={props.skins}
        busy={props.busy}
        online={props.online}
        onEquipSkin={props.onEquipSkin}
        onUpgrade={props.onUpgrade}
      />
      <footer className="garage-startbar">
        <div>
          <span>{t('garage.currentMission')}</span>
          <strong>{t(`content.${level.code}`)}</strong>
          <small>{t(`content.${tank.code}`)}</small>
        </div>
        <button
          className="primary-start garage-start"
          disabled={props.busy || !props.online}
          onClick={props.onStart}
        >
          <span aria-hidden="true">▶</span> {t('action.start')}
        </button>
      </footer>
    </section>
  );
}
