// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyTankUpgradeLevels } from '@tankquest/shared';
import type { LevelDto, OwnedTankDto, TankSkinDto } from '@tankquest/shared';

import { GarageHome } from './GarageHome.js';
import { I18nProvider } from './i18n/I18nProvider.js';

vi.mock('./game/three/GarageTankPreview.js', () => ({
  default: ({ code }: { code: string }) => <div data-preview-code={code} />,
}));

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  if (root) act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.clearAllMocks();
});

const levels: LevelDto[] = [
  {
    id: 'level_1',
    code: 'target-range',
    titleKey: 'level.targetRange.title',
    mode: 'child_learning',
    subject: 'math',
    baseDifficulty: 1,
    config: {},
  },
  {
    id: 'level_2',
    code: 'word-match-camp',
    titleKey: 'level.wordMatchCamp.title',
    mode: 'child_learning',
    subject: 'english',
    baseDifficulty: 2,
    config: {},
  },
];

function tank(code: string, role: 'medium' | 'scout'): OwnedTankDto {
  return {
    id: `tank_${code}`,
    code,
    nameKey: `tank.${code}.name`,
    role,
    level: 1,
    upgradeLevels: emptyTankUpgradeLevels(),
    stats: {
      firepower: 3,
      mobility: 3,
      armor: 3,
      stealth: 2,
      vision: 3,
      accuracy: 3,
      turretTraverse: 3,
    },
  };
}

const skins: TankSkinDto[] = [
  {
    id: 'skin_olive',
    code: 'field-olive',
    nameKey: 'skin.fieldOlive.name',
    primaryColor: '#5d7d46',
    secondaryColor: '#e8c65a',
    unlocked: true,
    equipped: true,
  },
];

async function mount() {
  const callbacks = {
    onSelectLevel: vi.fn(),
    onSelectTank: vi.fn(),
    onEquipSkin: vi.fn(),
    onUpgrade: vi.fn(),
    onStart: vi.fn(),
  };
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root?.render(
      <I18nProvider>
        <GarageHome
          busy={false}
          online={true}
          levels={levels}
          preview={undefined}
          selectedLevelId="level_1"
          selectedTankId="tank_star-shield"
          skins={skins}
          tanks={[tank('star-shield', 'medium'), tank('swift-fox', 'scout')]}
          {...callbacks}
        />
      </I18nProvider>
    )
  );
  return callbacks;
}

function click(element: Element | null | undefined) {
  act(() => element?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

describe('GarageHome', () => {
  it('keeps mission, tank, skin, upgrade, and battle callbacks intact', async () => {
    const callbacks = await mount();
    const missionButtons = container?.querySelectorAll('.garage-mission');
    click(missionButtons?.[1]);
    expect(callbacks.onSelectLevel).toHaveBeenCalledWith('level_2');
    const tankButtons = container?.querySelectorAll('.garage-tank-choice');
    click(tankButtons?.[1]);
    expect(callbacks.onSelectTank).toHaveBeenCalledWith('tank_swift-fox');
    click(container?.querySelector('.garage-skin'));
    expect(callbacks.onEquipSkin).toHaveBeenCalledWith('skin_olive');
    click(container?.querySelector('.garage-upgrade-button'));
    expect(callbacks.onUpgrade).toHaveBeenCalledWith('firepower');
    click(container?.querySelector('.garage-start'));
    expect(callbacks.onStart).toHaveBeenCalledOnce();
  });

  it('filters missions and expands only the requested detail panel', async () => {
    await mount();
    const search = container?.querySelector('.garage-search');
    act(() => {
      if (search) {
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value'
        )?.set?.call(search, 'word');
        search.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    expect(container?.querySelectorAll('.garage-mission')).toHaveLength(1);
    const detailsButton = container?.querySelector('.garage-details-toggle');
    expect(detailsButton?.getAttribute('aria-expanded')).toBe('false');
    click(detailsButton);
    expect(detailsButton?.getAttribute('aria-expanded')).toBe('true');
    expect(
      container?.querySelector('.garage-details')?.hasAttribute('hidden')
    ).toBe(false);
  });
});
