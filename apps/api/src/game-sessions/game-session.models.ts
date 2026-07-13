import type {
  FinishSessionResponse,
  LevelDto,
  QuestionDto,
  StartSessionRequest,
  TankDto,
} from '@tankquest/shared';

export interface InternalQuestion extends QuestionDto {
  correctAnswerId: string;
  explanation: string;
}

export interface SessionSetup {
  level: LevelDto;
  tank: TankDto;
  questions: InternalQuestion[];
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
