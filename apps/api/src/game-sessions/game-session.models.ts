import type {
  AgeGroup,
  FinishSessionResponse,
  LevelDto,
  QuestionDto,
  StartSessionRequest,
  TankDto,
  Subject,
} from '@tankquest/shared';

export interface InternalQuestion extends QuestionDto {
  skillKey: string;
  correctAnswerId: string;
  explanation: string;
}

export interface SessionLearnerContext {
  ageGroup: AgeGroup;
  aiExplanationEnabled: boolean;
}

export interface SessionSetup {
  level: LevelDto;
  tank: TankDto;
  questions: InternalQuestion[];
  learner: SessionLearnerContext;
}

export interface RecordedAnswer {
  questionId: string;
  selectedAnswerId: string;
  correct: boolean;
  answerTimeMs: number;
}

export interface SessionState {
  id: string;
  childId: string;
  locale: 'en' | 'zh-CN';
  status: 'active' | 'finished' | 'abandoned';
  setup: SessionSetup;
  answers: RecordedAnswer[];
  settlement: FinishSessionResponse | null;
}

export interface AdaptiveLearningRecord {
  subject: Subject;
  skillKey: string;
  attempts: number;
  correctCount: number;
  averageAnswerTimeMs: number;
  currentDifficulty: number;
}

export interface EligiblePracticeLevel {
  id: string;
  subject: Subject;
  difficulty: number;
  skillKeys: string[];
}

export interface AdaptiveLearningContext {
  ageGroup: AgeGroup;
  maxDifficulty: number;
  completedSessions: number;
  records: AdaptiveLearningRecord[];
  levels: EligiblePracticeLevel[];
}

export interface NewSession extends StartSessionRequest {
  mode: string;
  difficulty: number;
  locale: 'en' | 'zh-CN';
  questionIds: string[];
}
