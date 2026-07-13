import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { describeException } from './api-exception.filter.js';

describe('describeException', () => {
  it('preserves safe HTTP error details in the shared shape', () => {
    expect(
      describeException(new BadRequestException(['childId is required']))
    ).toEqual({
      status: 400,
      error: { code: 'HTTP_400', message: 'childId is required' },
    });
  });

  it('does not expose unexpected internal error details', () => {
    expect(describeException(new Error('database password leaked'))).toEqual({
      status: 500,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });
});
