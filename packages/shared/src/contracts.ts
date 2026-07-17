import type {
  AssetType,
  EnemyTankRole,
  GameMode,
  Subject,
  TankStats,
  TrainingMapStyle,
} from './domain.js';

export interface AssetManifestEntryDto {
  assetId: string;
  type: AssetType;
  version: string;
  url: string;
  sha256: string;
  sizeBytes: number;
  tags: string[];
  preview: string | null;
  dependencies: string[];
}

export interface AssetManifestDto {
  levelId: string;
  levelVersion: number;
  assets: AssetManifestEntryDto[];
}

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
  skin?: TankSkinAppearanceDto;
}

export interface TankSkinAppearanceDto {
  id: string;
  code: string;
  nameKey: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface TankSkinDto extends TankSkinAppearanceDto {
  unlocked: boolean;
  equipped: boolean;
}

export interface OwnedTankDto extends TankDto {
  level: number;
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
    alertMemoryMs: number;
    nearMissRadius: number;
    allyAlertRadius: number;
    searchLeashRange: number;
  };
}

export interface LevelMapConfigDto {
  style: TrainingMapStyle;
  playerSpawn: { x: number; y: number };
  obstacles: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

export interface StartSessionRequest {
  childId: string;
  levelId: string;
  tankId: string;
  locale?: 'en' | 'zh-CN';
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
  locale?: 'en' | 'zh-CN';
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
  nextPractice?: NextPracticeRecommendationDto;
}

export type PracticeIntent = 'review' | 'reinforce' | 'challenge';

export interface NextPracticeRecommendationDto {
  levelId: string;
  subject: Subject;
  skillKey: string;
  difficulty: number;
  intent: PracticeIntent;
  decision: 'adopted' | 'adjusted' | 'rejected' | 'fallback';
  reason:
    | 'within_policy'
    | 'insufficient_data'
    | 'ai_unavailable'
    | 'invalid_focus'
    | 'outside_policy'
    | 'parent_limit'
    | 'content_unavailable'
    | 'provider_fallback';
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

export interface LearningProgressDto {
  subject: Subject;
  skillKey: string;
  attempts: number;
  correctCount: number;
  accuracy: number;
  averageAnswerTimeMs: number;
  currentDifficulty: number;
  updatedAt: string;
}

export interface ParentReportMetricDto {
  subject: Subject;
  skillKey?: string;
  attempts: number;
  correctCount: number;
  accuracy: number;
  averageAnswerTimeMs: number;
  currentDifficulty?: number;
  lastPracticedAt?: string;
  trend?: ParentReportTrend;
}

export type ParentReportTrend =
  'improving' | 'steady' | 'needs-practice' | 'insufficient-data';

export interface ParentReportSummaryDto {
  source: 'deterministic' | 'model';
  practiceContent: string;
  progress: string;
  attention: string;
  nextStep: string;
}

export interface ParentReportDto {
  range: { from: string; to: string };
  completedSessions: number;
  totalAnswers: number;
  subjects: ParentReportMetricDto[];
  recentSkills: ParentReportMetricDto[];
  focusSkill: Pick<ParentReportMetricDto, 'subject' | 'skillKey'> | null;
  summary?: ParentReportSummaryDto;
}
