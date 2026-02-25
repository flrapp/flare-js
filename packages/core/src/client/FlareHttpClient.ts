import type { FlareConfig, FlagEvaluationResult, BulkEvaluationResult } from '../types';

export class FlareHttpClient {
  private readonly config: FlareConfig;

  constructor(config: FlareConfig) {
    this.config = config;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const { baseUrl, apiKey, timeout } = this.config;
    const url = `${baseUrl}${path}`;

    const authHeader = `Bearer ${apiKey}`
    const controller = new AbortController();
    const timeoutId = timeout
      ? setTimeout(() => controller.abort(), timeout)
      : null;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
      }

      return response.json() as Promise<T>;
    } finally {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    }
  }

  async evaluateFlag(
    flagKey: string,
    scope: string,
    targetingKey?: string | null,
  ): Promise<FlagEvaluationResult> {
    return this.post<FlagEvaluationResult>('/sdk/v1/flags/evaluate', {
      flagKey,
      context: {
        scope,
        targetingKey: targetingKey ?? null,
      },
    });
  }

  async evaluateAll(
    scope: string,
    targetingKey?: string | null,
  ): Promise<BulkEvaluationResult> {
    return this.post<BulkEvaluationResult>('/sdk/v1/flags/evaluate-all', {
      context: {
        scope,
        targetingKey: targetingKey ?? null,
      },
    });
  }
}
