import type { LevelObjectiveSetDto } from '@tankquest/shared';
import { describe, expect, it } from 'vitest';

import {
  activeWaveEnemyIds,
  applyMissionObjectiveEvent,
  createMissionObjectiveState,
  objectiveRuntimeSummary,
} from './mission-objectives.js';

describe('mission objectives', () => {
  it('completes eliminate and elite objectives only for unique valid targets', () => {
    const set: LevelObjectiveSetDto = {
      completion: 'all',
      objectives: [
        { id: 'clear', type: 'eliminate', targetCount: 2 },
        { id: 'elite', type: 'elite-hunt', targetEnemyIds: ['boss'] },
      ],
    };
    let state = createMissionObjectiveState(set);
    state = applyMissionObjectiveEvent(set, state, {
      type: 'enemy-defeated',
      enemyId: 'guard',
    });
    state = applyMissionObjectiveEvent(set, state, {
      type: 'enemy-defeated',
      enemyId: 'guard',
    });
    expect(state.complete).toBe(false);
    state = applyMissionObjectiveEvent(set, state, {
      type: 'enemy-defeated',
      enemyId: 'boss',
    });
    expect(state.complete).toBe(true);
  });

  it('activates defend waves in order', () => {
    const set: LevelObjectiveSetDto = {
      completion: 'all',
      objectives: [
        {
          id: 'waves',
          type: 'defend-waves',
          waves: [
            { id: 'wave_1', enemyIds: ['a', 'b'] },
            { id: 'wave_2', enemyIds: ['c'] },
          ],
        },
      ],
    };
    let state = createMissionObjectiveState(set);
    expect(activeWaveEnemyIds(set, state)).toEqual(['a', 'b']);
    state = applyMissionObjectiveEvent(set, state, {
      type: 'enemy-defeated',
      enemyId: 'c',
    });
    expect(activeWaveEnemyIds(set, state)).toEqual(['a', 'b']);
    for (const enemyId of ['a', 'b']) {
      state = applyMissionObjectiveEvent(set, state, {
        type: 'enemy-defeated',
        enemyId,
      });
    }
    expect(activeWaveEnemyIds(set, state)).toEqual(['c']);
  });

  it('collects supplies once and requires route checkpoints in order', () => {
    const set: LevelObjectiveSetDto = {
      completion: 'all',
      objectives: [
        {
          id: 'supply',
          type: 'supply-run',
          required: 1,
          points: [{ id: 'crate', x: 100, y: 100 }],
        },
        {
          id: 'route',
          type: 'route-choice',
          checkpoints: [
            { id: 'gate_a', x: 200, y: 100 },
            { id: 'gate_b', x: 300, y: 100 },
          ],
        },
      ],
    };
    let state = createMissionObjectiveState(set);
    state = applyMissionObjectiveEvent(set, state, {
      type: 'checkpoint-reached',
      checkpointId: 'gate_b',
    });
    expect(objectiveRuntimeSummary(state).objectiveCurrent).toBe(0);
    state = applyMissionObjectiveEvent(set, state, {
      type: 'supply-collected',
      pointId: 'crate',
    });
    for (const checkpointId of ['gate_a', 'gate_b']) {
      state = applyMissionObjectiveEvent(set, state, {
        type: 'checkpoint-reached',
        checkpointId,
      });
    }
    expect(state.complete).toBe(true);
  });
});
