import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { ApiError } from '@tankquest/shared';
import { randomUUID } from 'node:crypto';

interface ErrorEnvelope {
  data: null;
  error: ApiError;
  requestId: string;
}

interface HttpResponse {
  status(status: number): { json(body: ErrorEnvelope): void };
}

export function describeException(exception: unknown): {
  status: number;
  error: ApiError;
} {
  if (!(exception instanceof HttpException)) {
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    };
  }

  const status = exception.getStatus();
  const response = exception.getResponse();
  const detail = typeof response === 'object' ? response : null;
  const rawMessage = detail && 'message' in detail ? detail.message : response;
  const message = Array.isArray(rawMessage)
    ? rawMessage.join(', ')
    : typeof rawMessage === 'string'
      ? rawMessage
      : exception.message;

  return {
    status,
    error: { code: `HTTP_${status}`, message },
  };
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<HttpResponse>();
    const { status, error } = describeException(exception);
    response.status(status).json({
      data: null,
      error,
      requestId: `req_${randomUUID()}`,
    });
  }
}
