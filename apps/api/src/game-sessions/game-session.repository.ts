import type {
  FinishSessionResponse,
  GameEventRequest,
  LevelDto,
  StartSessionRequest,
  TankDto,
} from '@tankquest/shared';

import type {
  NewSession,
  RecordedAnswer,
  SessionSetup,
  SessionState,
} from './game-session.models.js';

export abstract class GameSessionRepository {
  abstract listLevels(): Promise<LevelDto[]>;
  abstract listTanks(): Promise<TankDto[]>;
  abstract loadSetup(
    request: StartSessionRequest
  ): Promise<SessionSetup | null>;
  abstract createSession(session: NewSession): Promise<string>;
  abstract findSession(sessionId: string): Promise<SessionState | null>;
  abstract recordAnswer(
    sessionId: string,
    answer: RecordedAnswer
  ): Promise<void>;
  abstract recordEvent(
    sessionId: string,
    event: GameEventRequest
  ): Promise<void>;
  abstract settleSession(
    sessionId: string,
    settlement: FinishSessionResponse
  ): Promise<FinishSessionResponse>;
}
