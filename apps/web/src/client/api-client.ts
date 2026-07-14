import type {
  ApiResponse,
  FinishSessionResponse,
  GameEventRequest,
  LevelDto,
  LearningProgressDto,
  OwnedTankDto,
  ParentReportDto,
  StartSessionRequest,
  StartSessionResponse,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
  TankDto,
  TankSkinDto,
  TankStats,
  UpgradeTankResponse,
} from '@tankquest/shared';

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export class ApiClient {
  private readonly request: typeof fetch;

  constructor(
    private readonly baseUrl: string,
    request: typeof fetch = globalThis.fetch
  ) {
    this.request = request.bind(globalThis);
  }

  listLevels() {
    return this.send<LevelDto[]>('/api/levels');
  }

  listTanks() {
    return this.send<TankDto[]>('/api/tanks');
  }

  listOwnedTanks(childId: string) {
    return this.send<OwnedTankDto[]>(`/api/children/${childId}/tanks`);
  }

  listLearningProgress(childId: string) {
    return this.send<LearningProgressDto[]>(
      `/api/children/${childId}/progress`
    );
  }

  getParentReport(childId: string) {
    return this.send<ParentReportDto>(`/api/children/${childId}/report`);
  }

  listTankSkins(childId: string, tankId: string) {
    return this.send<TankSkinDto[]>(
      `/api/children/${childId}/tanks/${tankId}/skins`
    );
  }

  equipTankSkin(childId: string, tankId: string, skinId: string) {
    return this.send<TankSkinDto>(
      `/api/children/${childId}/tanks/${tankId}/skins/${skinId}/equip`,
      { method: 'POST' }
    );
  }

  startSession(request: StartSessionRequest) {
    return this.send<StartSessionResponse>('/api/game-sessions', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  submitAnswer(sessionId: string, request: SubmitAnswerRequest) {
    return this.send<SubmitAnswerResponse>(
      `/api/game-sessions/${sessionId}/answers`,
      { method: 'POST', body: JSON.stringify(request) }
    );
  }

  recordEvent(sessionId: string, event: GameEventRequest) {
    return this.send<{ accepted: true }>(
      `/api/game-sessions/${sessionId}/events`,
      { method: 'POST', body: JSON.stringify(event) }
    );
  }

  finishSession(sessionId: string) {
    return this.send<FinishSessionResponse>(
      `/api/game-sessions/${sessionId}/finish`,
      { method: 'POST' }
    );
  }

  upgradeTank(childId: string, tankId: string, stat: keyof TankStats) {
    return this.send<UpgradeTankResponse>(
      `/api/children/${childId}/tanks/${tankId}/upgrades`,
      { method: 'POST', body: JSON.stringify({ stat }) }
    );
  }

  private async send<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.request(`${this.baseUrl}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...init.headers },
    });
    const payload = (await response.json()) as Partial<ApiResponse<T>> & {
      message?: string | string[];
    };
    if (!response.ok || payload.error || payload.data == null) {
      const fallback = Array.isArray(payload.message)
        ? payload.message.join(', ')
        : payload.message;
      throw new ApiClientError(
        payload.error?.message ?? fallback ?? 'Request failed',
        response.status
      );
    }
    return payload.data;
  }
}
