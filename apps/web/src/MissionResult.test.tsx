import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { MissionResult } from './MissionResult.js';

describe('MissionResult', () => {
  it('shows a backend-owned next practice recommendation', () => {
    const html = renderToStaticMarkup(
      <MissionResult
        online={true}
        busy={false}
        enemyTotal={3}
        runtime={{
          enemiesRemaining: 0,
          shotsFired: 8,
          playerHealth: 112,
          playerMaxHealth: 150,
          playerDestroyed: false,
          objectiveComplete: true,
          objectiveType: 'eliminate',
          objectiveCurrent: 3,
          objectiveTarget: 3,
        }}
        settlement={{
          sessionId: 'session_1',
          stars: 3,
          rewards: [{ type: 'part', key: 'cannon', amount: 3 }],
          learningSummary: { correct: 3, total: 3 },
          nextPractice: {
            levelId: 'level_2',
            subject: 'math',
            skillKey: 'addition-within-20',
            difficulty: 2,
            intent: 'challenge',
            decision: 'adopted',
            reason: 'within_policy',
          },
        }}
        tank={{
          id: 'tank_1',
          code: 'star-shield',
          nameKey: 'tank.starShield.name',
          role: 'medium',
          stats: {
            firepower: 3,
            mobility: 3,
            armor: 3,
            stealth: 2,
            vision: 3,
          },
        }}
        upgrade={null}
        onContinue={vi.fn()}
        onNextPractice={vi.fn()}
        onReplay={vi.fn()}
        onUpgrade={vi.fn()}
      />
    );

    expect(html).toContain('Recommended next practice');
    expect(html).toContain('Math · addition-within-20 · difficulty 2');
    expect(html).toContain('Select recommended mission');
    expect(html).toContain('Learning performance');
    expect(html).toContain('3 enemies defeated · 8 shots');
    expect(html).toContain('3 cannon parts · awarded for this 3-star mission');
  });

  it('shows exact before and after combat outcomes for an upgrade', () => {
    const html = renderToStaticMarkup(
      <MissionResult
        online={true}
        busy={false}
        enemyTotal={2}
        runtime={{
          enemiesRemaining: 0,
          shotsFired: 6,
          playerHealth: 150,
          playerMaxHealth: 150,
          playerDestroyed: false,
          objectiveComplete: true,
          objectiveType: 'eliminate',
          objectiveCurrent: 2,
          objectiveTarget: 2,
        }}
        settlement={{
          sessionId: 'session_1',
          stars: 3,
          rewards: [
            { type: 'part', key: 'cannon', amount: 3 },
            { type: 'training_point', key: 'general', amount: 30 },
          ],
          learningSummary: { correct: 3, total: 3 },
        }}
        tank={{
          id: 'tank_1',
          code: 'star-shield',
          nameKey: 'tank.starShield.name',
          role: 'medium',
          stats: {
            firepower: 3,
            mobility: 3,
            armor: 3,
            stealth: 2,
            vision: 3,
          },
        }}
        upgrade={{
          tankId: 'tank_1',
          stat: 'firepower',
          level: 1,
          effectiveValue: 4,
          remainingParts: 1,
        }}
        onContinue={vi.fn()}
        onNextPractice={vi.fn()}
        onReplay={vi.fn()}
        onUpgrade={vi.fn()}
      />
    );

    expect(html).toContain('34 → 41');
    expect(html).toContain('82 → 94');
    expect(html).toContain('460 → 500');
    expect(html).toContain('0.35s → 0.32s');
  });
});
