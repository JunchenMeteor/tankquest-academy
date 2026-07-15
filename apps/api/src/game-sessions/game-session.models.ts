import type {
  AgeGroup,
  FinishSessionResponse,
  LevelDto,
  QuestionDto,
  StartSessionRequest,
  TankDto,
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
  status: 'active' | 'finished' | 'abandoned';
  setup: SessionSetup;
  answers: RecordedAnswer[];
  settlement: FinishSessionResponse | null;
}

export interface NewSession extends StartSessionRequest {
  mode: string;
  difficulty: number;
}
