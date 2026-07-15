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
