import { describe, expect, it, vi } from 'vitest';

import { AiGatewayClient, AiGatewayError } from './ai-gateway.client.js';

const config = { baseUrl: 'http://ai:8100', timeoutMs: 500 };

describe('AiGatewayClient', () => {
  it('accepts a valid health response', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        status: 'ok',
        requestedProvider: 'template',
        effectiveProvider: 'template',
      })
    );

    await expect(
      new AiGatewayClient(config, fetchImplementation).getHealth()
    ).resolves.toBe('ok');
    expect(fetchImplementation).toHaveBeenCalledWith(
      'http://ai:8100/health',
      expect.objectContaining({
        method: 'GET',
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('sends only the explicit question-draft contract', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        requestId: 'e96e124f-98d5-44b9-9690-002f7a5a5454',
        source: 'template',
        fallbackReason: null,
        draft: {
          question: 'What is 2 + 2?',
          choices: ['3', '4', '5'],
          correctAnswer: '4',
          explanation: 'Two plus two is four.',
        },
      })
    );
    const request = {
      ageGroup: '6-8' as const,
      locale: 'en' as const,
      subject: 'math' as const,
      skillKey: 'addition-within-20',
      difficulty: 1,
    };

    await expect(
      new AiGatewayClient(config, fetchImplementation).createQuestionDraft(
        request
      )
    ).resolves.toMatchObject({ source: 'template' });
    const body = JSON.parse(
      String(fetchImplementation.mock.calls[0]?.[1]?.body)
    );
    expect(body).toEqual(request);
    expect(body).not.toHaveProperty('childId');
  });

  it('sends only the explicit wrong-answer explanation contract', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        requestId: 'e96e124f-98d5-44b9-9690-002f7a5a5454',
        source: 'template',
        fallbackReason: null,
        correctAnswer: '15',
        explanation: 'Add the two numbers one step at a time.',
      })
    );
    const request = {
      ageGroup: '6-8' as const,
      locale: 'zh-CN' as const,
      subject: 'math' as const,
      skillKey: 'addition-within-20',
      difficulty: 1,
      question: '8 + 7 = ?',
      selectedAnswer: '12',
      correctAnswer: '15',
    };

    await expect(
      new AiGatewayClient(
        config,
        fetchImplementation
      ).createWrongAnswerExplanation(request)
    ).resolves.toMatchObject({ correctAnswer: '15' });
    const [url, init] = fetchImplementation.mock.calls[0] ?? [];
    expect(url).toBe('http://ai:8100/v1/internal/wrong-answer-explanations');
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual(request);
    expect(body).not.toHaveProperty('childId');
    expect(body).not.toHaveProperty('questionId');
    expect(body).not.toHaveProperty('sessionId');
  });

  it('rejects malformed explanation responses', async () => {
    const client = new AiGatewayClient(
      config,
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          requestId: 'e96e124f-98d5-44b9-9690-002f7a5a5454',
          source: 'model',
          fallbackReason: null,
          correctAnswer: '15',
          explanation: 'Valid text.',
          childId: 'not-allowed',
        })
      )
    );

    await expect(
      client.createWrongAnswerExplanation({
        ageGroup: '6-8',
        locale: 'en',
        subject: 'math',
        skillKey: 'addition-within-20',
        difficulty: 1,
        question: '8 + 7 = ?',
        selectedAnswer: '12',
        correctAnswer: '15',
      })
    ).rejects.toBeInstanceOf(AiGatewayError);
  });

  it('sends only aggregate practice recommendation fields', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        requestId: 'e96e124f-98d5-44b9-9690-002f7a5a5454',
        source: 'template',
        fallbackReason: null,
        subject: 'math',
        skillKey: 'addition-within-20',
        recommendedDifficulty: 2,
        practiceIntent: 'challenge',
      })
    );
    const request = {
      ageGroup: '6-8' as const,
      subject: 'math' as const,
      skillKey: 'addition-within-20',
      currentDifficulty: 1,
      attempts: 5,
      accuracy: 80,
      averageAnswerTimeMs: 8_000,
      completedSessions: 4,
      allowedDifficulty: { min: 1, max: 2 },
    };

    await expect(
      new AiGatewayClient(
        config,
        fetchImplementation
      ).createPracticeRecommendation(request)
    ).resolves.toMatchObject({ recommendedDifficulty: 2 });
    const [url, init] = fetchImplementation.mock.calls[0] ?? [];
    expect(url).toBe('http://ai:8100/v1/internal/practice-recommendations');
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual(request);
    for (const field of [
      'childId',
      'sessionId',
      'levelId',
      'answers',
      'events',
    ]) {
      expect(body).not.toHaveProperty(field);
    }
  });

  it('rejects an invalid allowed difficulty range before sending it', async () => {
    const fetchImplementation = vi.fn<typeof fetch>();

    await expect(
      new AiGatewayClient(
        config,
        fetchImplementation
      ).createPracticeRecommendation({
        ageGroup: '6-8',
        subject: 'math',
        skillKey: 'addition-within-20',
        currentDifficulty: 1,
        attempts: 5,
        accuracy: 80,
        averageAnswerTimeMs: 8_000,
        completedSessions: 4,
        allowedDifficulty: { min: 2, max: 1 },
      })
    ).rejects.toThrow();
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it.each([
    Response.json({ status: 'ok' }, { status: 200 }),
    Response.json(
      {
        status: 'ok',
        requestedProvider: 'template',
        effectiveProvider: 'template',
      },
      { status: 503 }
    ),
  ])('rejects invalid or unsuccessful health responses', async (response) => {
    const client = new AiGatewayClient(
      config,
      vi.fn<typeof fetch>().mockResolvedValue(response)
    );

    await expect(client.getHealth()).rejects.toBeInstanceOf(AiGatewayError);
  });

  it('replaces transport errors with a safe gateway error', async () => {
    const client = new AiGatewayClient(
      config,
      vi.fn<typeof fetch>().mockRejectedValue(new Error('secret raw response'))
    );

    await expect(client.getHealth()).rejects.toEqual(new AiGatewayError());
  });

  it('rejects an out-of-range request before sending it', async () => {
    const fetchImplementation = vi.fn<typeof fetch>();
    const client = new AiGatewayClient(config, fetchImplementation);

    await expect(
      client.createQuestionDraft({
        ageGroup: '6-8',
        locale: 'en',
        subject: 'math',
        skillKey: 'addition-within-20',
        difficulty: 6,
      })
    ).rejects.toThrow();
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('rejects a draft whose choices are not unique', async () => {
    const client = new AiGatewayClient(
      config,
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          requestId: 'e96e124f-98d5-44b9-9690-002f7a5a5454',
          source: 'model',
          fallbackReason: null,
          draft: {
            question: 'What is 2 + 2?',
            choices: ['4', '4', '5'],
            correctAnswer: '4',
            explanation: 'Two plus two is four.',
          },
        })
      )
    );

    await expect(
      client.createQuestionDraft({
        ageGroup: '6-8',
        locale: 'en',
        subject: 'math',
        skillKey: 'addition-within-20',
        difficulty: 1,
      })
    ).rejects.toBeInstanceOf(AiGatewayError);
  });
});
