import type { AiGatewayConfig } from './ai-gateway.config.js';
import {
  aiHealthSchema,
  aiParentReportSummaryRequestSchema,
  aiParentReportSummaryResponseSchema,
  aiQuestionDraftRequestSchema,
  aiQuestionDraftResponseSchema,
  aiPracticeRecommendationRequestSchema,
  aiPracticeRecommendationResponseSchema,
  aiWrongAnswerExplanationRequestSchema,
  aiWrongAnswerExplanationResponseSchema,
  type AiDependencyStatus,
  type AiParentReportSummaryRequest,
  type AiParentReportSummaryResponse,
  type AiQuestionDraftRequest,
  type AiQuestionDraftResponse,
  type AiPracticeRecommendationRequest,
  type AiPracticeRecommendationResponse,
  type AiWrongAnswerExplanationRequest,
  type AiWrongAnswerExplanationResponse,
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

  async createWrongAnswerExplanation(
    request: AiWrongAnswerExplanationRequest
  ): Promise<AiWrongAnswerExplanationResponse> {
    const response = await this.request(
      '/v1/internal/wrong-answer-explanations',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          aiWrongAnswerExplanationRequestSchema.parse(request)
        ),
      }
    );
    const result = aiWrongAnswerExplanationResponseSchema.safeParse(
      await this.readJson(response)
    );
    if (!response.ok || !result.success) throw new AiGatewayError();
    return result.data;
  }

  async createPracticeRecommendation(
    request: AiPracticeRecommendationRequest
  ): Promise<AiPracticeRecommendationResponse> {
    const response = await this.request(
      '/v1/internal/practice-recommendations',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          aiPracticeRecommendationRequestSchema.parse(request)
        ),
      }
    );
    const result = aiPracticeRecommendationResponseSchema.safeParse(
      await this.readJson(response)
    );
    if (!response.ok || !result.success) throw new AiGatewayError();
    return result.data;
  }

  async createParentReportSummary(
    request: AiParentReportSummaryRequest
  ): Promise<AiParentReportSummaryResponse> {
    const response = await this.request(
      '/v1/internal/parent-report-summaries',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(aiParentReportSummaryRequestSchema.parse(request)),
      }
    );
    const result = aiParentReportSummaryResponseSchema.safeParse(
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
