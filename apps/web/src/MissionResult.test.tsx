import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { MissionResult } from './MissionResult.js';

describe('MissionResult', () => {
  it('shows a backend-owned next practice recommendation', () => {
    const html = renderToStaticMarkup(
      <MissionResult
        online={true}
        busy={false}
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
  });
});
