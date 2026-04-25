import type {
  FlareConfig,
  EvaluationContext,
  EvaluationResult,
  EvaluationReason,
  TypedFlagResponse,
  TypedBulkEvaluationResponse,
} from '../types';

export class FlareClient {
  private readonly config: FlareConfig;
  private defaultContext?: EvaluationContext;

  constructor(config: FlareConfig) {
    this.config = config;
  }

  setContext(context: EvaluationContext): void {
    this.defaultContext = context;
  }

  getContext(): EvaluationContext | undefined {
    return this.defaultContext;
  }

  private mergeContext(perCallContext?: EvaluationContext): EvaluationContext {
    const base = this.defaultContext ?? {
      scope: this.config.scope,
      targetingKey: '',
    };
    return perCallContext ?? base;
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
          Authorization: `Bearer ${apiKey}`,
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

  private makeErrorResult<T>(
    flagKey: string,
    defaultValue: T,
    reason: EvaluationReason,
  ): EvaluationResult<T> {
    return { flagKey, value: defaultValue, reason, variant: null };
  }

  private async evaluateTyped(
    flagKey: string,
    context: EvaluationContext,
  ): Promise<TypedFlagResponse> {
    return this.post<TypedFlagResponse>('/sdk/v1/flags/evaluate', {
      flagKey,
      context: {
        scope: context.scope,
        targetingKey: context.targetingKey,
        attributes: context.attributes,
      },
    });
  }

  async getBooleanValue(
    flagKey: string,
    defaultValue: boolean,
    context?: EvaluationContext,
  ): Promise<EvaluationResult<boolean>> {
    const resolvedContext = this.mergeContext(context);
    try {
      const raw = await this.evaluateTyped(flagKey, resolvedContext);
      if (raw.type !== 'boolean') {
        return this.makeErrorResult(flagKey, defaultValue, 'TYPE_MISMATCH');
      }
      return {
        flagKey: raw.flagKey,
        value: raw.value as boolean,
        reason: raw.reason,
        variant: raw.variant,
      };
    } catch {
      return this.makeErrorResult(flagKey, defaultValue, 'ERROR');
    }
  }

  async getStringValue(
    flagKey: string,
    defaultValue: string,
    context?: EvaluationContext,
  ): Promise<EvaluationResult<string>> {
    const resolvedContext = this.mergeContext(context);
    try {
      const raw = await this.evaluateTyped(flagKey, resolvedContext);
      if (raw.type !== 'string') {
        return this.makeErrorResult(flagKey, defaultValue, 'TYPE_MISMATCH');
      }
      return {
        flagKey: raw.flagKey,
        value: raw.value as string,
        reason: raw.reason,
        variant: raw.variant,
      };
    } catch {
      return this.makeErrorResult(flagKey, defaultValue, 'ERROR');
    }
  }

  async getNumberValue(
    flagKey: string,
    defaultValue: number,
    context?: EvaluationContext,
  ): Promise<EvaluationResult<number>> {
    const resolvedContext = this.mergeContext(context);
    try {
      const raw = await this.evaluateTyped(flagKey, resolvedContext);
      if (raw.type !== 'number') {
        return this.makeErrorResult(flagKey, defaultValue, 'TYPE_MISMATCH');
      }
      return {
        flagKey: raw.flagKey,
        value: raw.value as number,
        reason: raw.reason,
        variant: raw.variant,
      };
    } catch {
      return this.makeErrorResult(flagKey, defaultValue, 'ERROR');
    }
  }

  async getObjectValue<T>(
    flagKey: string,
    defaultValue: T,
    context?: EvaluationContext,
  ): Promise<EvaluationResult<T>> {
    const resolvedContext = this.mergeContext(context);
    try {
      const raw = await this.evaluateTyped(flagKey, resolvedContext);
      if (raw.type !== 'json') {
        return this.makeErrorResult(flagKey, defaultValue, 'TYPE_MISMATCH');
      }
      return {
        flagKey: raw.flagKey,
        value: raw.value as T,
        reason: raw.reason,
        variant: raw.variant,
      };
    } catch {
      return this.makeErrorResult(flagKey, defaultValue, 'ERROR');
    }
  }

  async evaluateAll(
    context?: EvaluationContext,
  ): Promise<Record<string, EvaluationResult<unknown>>> {
    const resolvedContext = this.mergeContext(context);
    try {
      const raw = await this.post<TypedBulkEvaluationResponse>(
        '/sdk/v1/flags/evaluate-all',
        {
          context: {
            scope: resolvedContext.scope,
            targetingKey: resolvedContext.targetingKey,
            attributes: resolvedContext.attributes,
          },
        },
      );
      return Object.fromEntries(
        raw.flags.map((flag) => [
          flag.flagKey,
          {
            flagKey: flag.flagKey,
            value: flag.value,
            reason: flag.reason,
            variant: flag.variant,
          } satisfies EvaluationResult<unknown>,
        ]),
      );
    } catch {
      return {};
    }
  }
}
