import type {
  LevelObjectiveSetDto,
  MissionObjectiveDto,
} from '@tankquest/shared';

export type MissionObjectiveEvent =
  | { type: 'enemy-defeated'; enemyId: string }
  | { type: 'supply-collected'; pointId: string }
  | { type: 'checkpoint-reached'; checkpointId: string };

export interface ObjectiveProgressState {
  id: string;
  type: MissionObjectiveDto['type'];
  current: number;
  target: number;
  complete: boolean;
  resolvedIds: string[];
}

export interface MissionObjectiveState {
  complete: boolean;
  defeatedEnemyIds: string[];
  objectives: ObjectiveProgressState[];
}

export function createMissionObjectiveState(
  set: LevelObjectiveSetDto
): MissionObjectiveState {
  return {
    complete: false,
    defeatedEnemyIds: [],
    objectives: set.objectives.map((objective) => ({
      id: objective.id,
      type: objective.type,
      current: 0,
      target: objectiveTarget(objective),
      complete: false,
      resolvedIds: [],
    })),
  };
}

export function applyMissionObjectiveEvent(
  set: LevelObjectiveSetDto,
  state: MissionObjectiveState,
  event: MissionObjectiveEvent
): MissionObjectiveState {
  const defeatedEnemyIds =
    event.type === 'enemy-defeated' &&
    !state.defeatedEnemyIds.includes(event.enemyId)
      ? [...state.defeatedEnemyIds, event.enemyId]
      : state.defeatedEnemyIds;
  const objectives = set.objectives.map((objective, index) =>
    applyObjectiveEvent(
      objective,
      state.objectives[index] ?? initialProgress(objective),
      event,
      defeatedEnemyIds
    )
  );
  return {
    defeatedEnemyIds,
    objectives,
    complete: objectives.every((objective) => objective.complete),
  };
}

export function activeWaveEnemyIds(
  set: LevelObjectiveSetDto,
  state: MissionObjectiveState
): string[] | null {
  const objective = set.objectives.find((item) => item.type === 'defend-waves');
  if (!objective || objective.type !== 'defend-waves') return null;
  const progress = state.objectives.find((item) => item.id === objective.id);
  if (!progress || progress.complete) return [];
  return objective.waves[progress.current]?.enemyIds ?? [];
}

export function objectiveRuntimeSummary(state: MissionObjectiveState) {
  const objective =
    state.objectives.find((item) => !item.complete) ?? state.objectives.at(-1);
  return {
    objectiveComplete: state.complete,
    objectiveType: objective?.type ?? 'eliminate',
    objectiveCurrent: objective?.current ?? 0,
    objectiveTarget: objective?.target ?? 0,
  };
}

function applyObjectiveEvent(
  objective: MissionObjectiveDto,
  progress: ObjectiveProgressState,
  event: MissionObjectiveEvent,
  defeatedEnemyIds: string[]
): ObjectiveProgressState {
  if (progress.complete) return progress;
  if (objective.type === 'eliminate' && event.type === 'enemy-defeated') {
    return withResolved(progress, event.enemyId);
  }
  if (objective.type === 'elite-hunt' && event.type === 'enemy-defeated') {
    return objective.targetEnemyIds.includes(event.enemyId)
      ? withResolved(progress, event.enemyId)
      : progress;
  }
  if (objective.type === 'supply-run' && event.type === 'supply-collected') {
    return objective.points.some((point) => point.id === event.pointId)
      ? withResolved(progress, event.pointId)
      : progress;
  }
  if (
    objective.type === 'route-choice' &&
    event.type === 'checkpoint-reached'
  ) {
    const expected = objective.checkpoints[progress.current];
    return expected?.id === event.checkpointId
      ? withResolved(progress, event.checkpointId)
      : progress;
  }
  if (objective.type === 'defend-waves' && event.type === 'enemy-defeated') {
    const activeWave = objective.waves[progress.current];
    if (!activeWave?.enemyIds.includes(event.enemyId)) return progress;
    const waveComplete = activeWave.enemyIds.every((enemyId) =>
      defeatedEnemyIds.includes(enemyId)
    );
    if (!waveComplete) return progress;
    const current = progress.current + 1;
    return {
      ...progress,
      current,
      complete: current >= progress.target,
      resolvedIds: [...progress.resolvedIds, activeWave.id],
    };
  }
  return progress;
}

function withResolved(
  progress: ObjectiveProgressState,
  resolvedId: string
): ObjectiveProgressState {
  if (progress.resolvedIds.includes(resolvedId)) return progress;
  const resolvedIds = [...progress.resolvedIds, resolvedId];
  const current = Math.min(progress.target, resolvedIds.length);
  return {
    ...progress,
    resolvedIds,
    current,
    complete: current >= progress.target,
  };
}

function initialProgress(objective: MissionObjectiveDto) {
  return {
    id: objective.id,
    type: objective.type,
    current: 0,
    target: objectiveTarget(objective),
    complete: false,
    resolvedIds: [],
  } satisfies ObjectiveProgressState;
}

function objectiveTarget(objective: MissionObjectiveDto) {
  switch (objective.type) {
    case 'eliminate':
      return objective.targetCount;
    case 'defend-waves':
      return objective.waves.length;
    case 'supply-run':
      return objective.required;
    case 'route-choice':
      return objective.checkpoints.length;
    case 'elite-hunt':
      return objective.targetEnemyIds.length;
  }
}
