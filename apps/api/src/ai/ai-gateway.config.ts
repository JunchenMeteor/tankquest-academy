export interface AiGatewayConfig {
  baseUrl: string;
  timeoutMs: number;
}

const DEFAULT_AI_SERVICE_URL = 'http://127.0.0.1:8100';
const DEFAULT_TIMEOUT_MS = 1_500;

export function readAiGatewayConfig(
  environment: NodeJS.ProcessEnv = process.env
): AiGatewayConfig {
  const url = new URL(environment.AI_SERVICE_URL ?? DEFAULT_AI_SERVICE_URL);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('AI_SERVICE_URL must use http or https');
  }

  const timeoutMs = Number(
    environment.AI_SERVICE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS
  );
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 10_000) {
    throw new Error(
      'AI_SERVICE_TIMEOUT_MS must be an integer between 100 and 10000'
    );
  }

  return {
    baseUrl: url.toString().replace(/\/$/, ''),
    timeoutMs,
  };
}
