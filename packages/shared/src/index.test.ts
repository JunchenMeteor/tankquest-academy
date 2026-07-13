import { describe, expect, it } from 'vitest';

import type { ApiResponse } from './index';

describe('shared API contract', () => {
  it('represents a successful response', () => {
    const response: ApiResponse<string> = {
      data: 'ready',
      error: null,
      requestId: 'req_test',
    };

    expect(response.data).toBe('ready');
  });
});
