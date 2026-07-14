import type { EnemyTankRole, GameMode, Subject, TankStats } from './domain.js';

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
  requestId: string;
}

export interface TankDto {
  id: string;
  code: string;
  nameKey: string;
  role: string;
  stats: TankStats;
}

export interface QuestionChoiceDto {
  id: string;
  text: string;
}

export interface QuestionDto {
  id: string;
  subject: Subject;
  difficulty: number;
  prompt: string;
  choices: QuestionChoiceDto[];
}

export interface LevelDto {
  id: string;
  code: string;
  titleKey: string;
  mode: GameMode;
  baseDifficulty: number;
  config: Record<string, unknown>;
}

export interface EnemyTankConfigDto {
  id: string;
  role: EnemyTankRole;
  x: number;
  y: number;
  stats: TankStats;
  ai: {
    detectionRange: number;
    attackRange: number;
    fireCooldownMs: number;
    speedMultiplier: number;
  };
}

export interface StartSessionRequest {
  childId: string;
  levelId: string;
  tankId: string;
}

export interface StartSessionResponse {
  sessionId: string;
  level: LevelDto;
  tank: TankDto;
  questions: QuestionDto[];
}

export interface SubmitAnswerRequest {
  questionId: string;
  selectedAnswerId: string;
  answerTimeMs: number;
}

export interface SubmitAnswerResponse {
  correct: boolean;
  explanation: string;
  resourceReward: { type: 'ammo'; amount: number };
}

export interface GameEventRequest {
  eventType:
    | 'enemy_defeated'
    | 'player_hit'
    | 'supply_collected'
    | 'objective_completed'
    | 'question_presented'
    | 'level_finished';
  payload: Record<string, unknown>;
  clientTimeMs: number;
}

export interface FinishSessionResponse {
  sessionId: string;
  stars: number;
  rewards: Array<{
    type: 'part' | 'training_point';
    key: string;
    amount: number;
  }>;
  learningSummary: { correct: number; total: number };
}

export interface UpgradeTankRequest {
  stat: keyof TankStats;
}

export interface UpgradeTankResponse {
  tankId: string;
  stat: keyof TankStats;
  level: number;
  effectiveValue: number;
  remainingParts: number;
}
