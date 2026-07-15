import type { AiGatewayConfig } from './ai-gateway.config.js';
import {
  aiHealthSchema,
  aiQuestionDraftRequestSchema,
  aiQuestionDraftResponseSchema,
  type AiDependencyStatus,
  type AiQuestionDraftRequest,
  type AiQuestionDraftResponse,
} from './ai-gateway.models.js';

type FetchImplementation = typeof fetch;

export class AiGatewayError extends Error {
  constructor() {
    super('AI service request failed');
    this.name = 'AiGatewayError';
  }
}

export class AiGatewayClient {
  constructor(
    private readonly config: AiGatewayConfig,
    private readonly fetchImplementation: FetchImplementation = fetch
  ) {}

  async getHealth(): Promise<AiDependencyStatus> {
    const response = await this.request('/health', { method: 'GET' });
    const result = aiHealthSchema.safeParse(await this.readJson(response));
    if (!response.ok || !result.success) throw new AiGatewayError();
    return result.data.status;
  }

  async createQuestionDraft(
    request: AiQuestionDraftRequest
  ): Promise<AiQuestionDraftResponse> {
    const response = await this.request('/v1/internal/question-drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(aiQuestionDraftRequestSchema.parse(request)),
    });
    const result = aiQuestionDraftResponseSchema.safeParse(
      await this.readJson(response)
    );
    if (!response.ok || !result.success) throw new AiGatewayError();
    return result.data;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    try {
      return await this.fetchImplementation(`${this.config.baseUrl}${path}`, {
        ...init,
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch {
      throw new AiGatewayError();
    }
  }

  private async readJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      throw new AiGatewayError();
    }
  }
}
