interface HealthPayload {
  status?: unknown;
}

export class StartupHealthClient {
  constructor(
    private readonly fetchRef: typeof fetch = globalThis.fetch,
    private readonly timeoutMs = 5_000
  ) {}

  async check(apiBaseUrl: string) {
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(
      () => controller.abort(),
      this.timeoutMs
    );
    try {
      const response = await this.fetchRef(`${apiBaseUrl}/api/health`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) return false;
      const payload = (await response.json()) as HealthPayload;
      return payload.status === 'ok';
    } catch {
      return false;
    } finally {
      globalThis.clearTimeout(timeout);
    }
  }
}
