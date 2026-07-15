import { Inject, Injectable, Logger } from '@nestjs/common';

import { AiGatewayClient } from './ai-gateway.client.js';
import type {
  AiDependencyStatus,
  AiParentReportSummaryRequest,
  AiParentReportSummaryResponse,
  AiQuestionDraftRequest,
  AiQuestionDraftResponse,
  AiPracticeRecommendationRequest,
  AiPracticeRecommendationResponse,
  AiWrongAnswerExplanationRequest,
  AiWrongAnswerExplanationResponse,
} from './ai-gateway.models.js';

const WARNING_INTERVAL_MS = 60_000;

@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);
  private lastWarningAt = 0;

  constructor(
    @Inject(AiGatewayClient) private readonly client: AiGatewayClient
  ) {}

  async getDependencyStatus(): Promise<AiDependencyStatus> {
    try {
      return await this.client.getHealth();
    } catch {
      this.warnUnavailable();
      return 'degraded';
    }
  }

  async createQuestionDraft(
    request: AiQuestionDraftRequest
  ): Promise<AiQuestionDraftResponse | null> {
    try {
      return await this.client.createQuestionDraft(request);
    } catch {
      this.warnUnavailable();
      return null;
    }
  }

  async createWrongAnswerExplanation(
    request: AiWrongAnswerExplanationRequest
  ): Promise<AiWrongAnswerExplanationResponse | null> {
    try {
      return await this.client.createWrongAnswerExplanation(request);
    } catch {
      this.warnUnavailable();
      return null;
    }
  }

  async createPracticeRecommendation(
    request: AiPracticeRecommendationRequest
  ): Promise<AiPracticeRecommendationResponse | null> {
    try {
      return await this.client.createPracticeRecommendation(request);
    } catch {
      this.warnUnavailable();
      return null;
    }
  }

  async createParentReportSummary(
    request: AiParentReportSummaryRequest
  ): Promise<AiParentReportSummaryResponse | null> {
    try {
      return await this.client.createParentReportSummary(request);
    } catch {
      this.warnUnavailable();
      return null;
    }
  }

  private warnUnavailable(): void {
    const now = Date.now();
    if (now - this.lastWarningAt < WARNING_INTERVAL_MS) return;
    this.lastWarningAt = now;
    this.logger.warn('AI service unavailable; deterministic fallback required');
  }
}
