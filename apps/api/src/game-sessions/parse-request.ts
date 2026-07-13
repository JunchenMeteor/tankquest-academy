import { BadRequestException } from '@nestjs/common';
import type { ZodType } from 'zod';

export function parseRequest<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new BadRequestException('Request body is invalid');
  }
  return result.data;
}
