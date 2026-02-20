import type { FlareConfig, FlagEvaluationResult, BulkEvaluationResult } from '../types';

export class FlareClient {
  private readonly config: FlareConfig;

  constructor(config: FlareConfig) {
    this.config = config;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const { baseUrl, apiKey, timeout } = this.config;
    const url = `${baseUrl}${path}`;

    const controller = new AbortController();
    const timeoutId = timeout
      ? setTimeout(() => controller.abort(), timeout)
      : null;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
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

  async evaluateFlag(flagKey: string, targetingKey?: string): Promise<FlagEvaluationResult> {
    return this.post<FlagEvaluationResult>('/sdk/v1/flags/evaluate', {
      flagKey,
      context: {
        scope: this.config.scope,
        targetingKey: targetingKey ?? null,
      },
    });
  }

  async evaluateAll(targetingKey?: string): Promise<BulkEvaluationResult> {
    return this.post<BulkEvaluationResult>('/sdk/v1/flags/evaluate-all', {
      context: {
        scope: this.config.scope,
        targetingKey: targetingKey ?? null,
      },
    });
  }
}
