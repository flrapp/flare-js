import {
  type CommonProvider,
  type EvaluationContext,
  type JsonValue,
  type ProviderMetadata,
  type ResolutionDetails,
  ClientProviderStatus,
  StandardResolutionReasons,
} from '@openfeature/core';
import { FlareHttpClient } from '../client/FlareHttpClient';
import type { FlagEvaluationResult, FlareConfig } from '../types';

export class FlareProvider implements CommonProvider<ClientProviderStatus> {
  readonly metadata: ProviderMetadata = { name: 'flare-provider' };
  private readonly client: FlareHttpClient;
  private readonly config: FlareConfig;
  private cache: Map<string, FlagEvaluationResult> = new Map();
  private pollingInterval?: ReturnType<typeof setInterval>;

  constructor(config: FlareConfig) {
    this.config = config;
    this.client = new FlareHttpClient(config);
  }

  private async refreshCache(context?: EvaluationContext): Promise<void> {
    const { targetingKey, ...rest } = context ?? {};

    const attributes = Object.keys(rest).length > 0
      ? Object.fromEntries(
          Object.entries(rest).filter(([_, val]) => typeof val === 'string')
        ) as Record<string, string>
      : null;

    const result = attributes
      ? await this.client.evaluateAll(this.config.scope, targetingKey ?? null, attributes)
      : await this.client.evaluateAll(this.config.scope, targetingKey ?? null);
    this.cache.clear();
    for (const flag of result.flags) {
      this.cache.set(flag.flagKey, flag);
    }
  }

  async initialize(context?: EvaluationContext): Promise<void> {
    await this.refreshCache(context);
    if (this.config.pollingIntervalMs) {
      this.pollingInterval = setInterval(
        () => this.refreshCache(context),
        this.config.pollingIntervalMs,
      );
    }
  }

  async onContextChange(
    _oldContext: EvaluationContext,
    newContext: EvaluationContext,
  ): Promise<void> {
    await this.refreshCache(newContext);
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      if (this.config.pollingIntervalMs) {
        this.pollingInterval = setInterval(
          () => this.refreshCache(newContext),
          this.config.pollingIntervalMs,
        );
      }
    }
  }

  async onClose(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    this.cache.clear();
  }

  resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    _context: EvaluationContext,
  ): ResolutionDetails<boolean> {
    const cached = this.cache.get(flagKey);
    if (!cached) {
      return { value: defaultValue, reason: StandardResolutionReasons.DEFAULT };
    }
    return {
      value: cached.value,
      reason: StandardResolutionReasons.CACHED,
      variant: cached.variant ?? undefined,
    };
  }

  resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
    context: EvaluationContext,
  ): ResolutionDetails<string> {
    const result = this.resolveBooleanEvaluation(flagKey, defaultValue === 'true', context);
    return { ...result, value: result.value.toString() };
  }

  resolveNumberEvaluation(
    flagKey: string,
    defaultValue: number,
    context: EvaluationContext,
  ): ResolutionDetails<number> {
    const result = this.resolveBooleanEvaluation(flagKey, defaultValue !== 0, context);
    return { ...result, value: result.value ? 1 : 0 };
  }

  resolveObjectEvaluation<T extends JsonValue>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
  ): ResolutionDetails<T> {
    const result = this.resolveBooleanEvaluation(flagKey, Boolean(defaultValue), context);
    return { ...result, value: { value: result.value } as unknown as T };
  }
}
