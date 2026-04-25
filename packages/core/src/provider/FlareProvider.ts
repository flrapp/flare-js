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
import type { FlareConfig, TypedFlagResponse } from '../types';

export class FlareProvider implements CommonProvider<ClientProviderStatus> {
  readonly metadata: ProviderMetadata = { name: 'flare-provider' };
  private readonly client: FlareHttpClient;
  private readonly config: FlareConfig;
  private cache: Map<string, TypedFlagResponse> = new Map();
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
    if (!cached) return { value: defaultValue, reason: StandardResolutionReasons.DEFAULT };
    if (cached.type !== 'boolean') return { value: defaultValue, reason: StandardResolutionReasons.ERROR };
    return {
      value: cached.value as boolean,
      reason: StandardResolutionReasons.CACHED,
      variant: cached.variant ?? undefined,
    };
  }

  resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
    _context: EvaluationContext,
  ): ResolutionDetails<string> {
    const cached = this.cache.get(flagKey);
    if (!cached) return { value: defaultValue, reason: StandardResolutionReasons.DEFAULT };
    if (cached.type !== 'string') return { value: defaultValue, reason: StandardResolutionReasons.ERROR };
    return {
      value: cached.value as string,
      reason: StandardResolutionReasons.CACHED,
      variant: cached.variant ?? undefined,
    };
  }

  resolveNumberEvaluation(
    flagKey: string,
    defaultValue: number,
    _context: EvaluationContext,
  ): ResolutionDetails<number> {
    const cached = this.cache.get(flagKey);
    if (!cached) return { value: defaultValue, reason: StandardResolutionReasons.DEFAULT };
    if (cached.type !== 'number') return { value: defaultValue, reason: StandardResolutionReasons.ERROR };
    return {
      value: cached.value as number,
      reason: StandardResolutionReasons.CACHED,
      variant: cached.variant ?? undefined,
    };
  }

  resolveObjectEvaluation<T extends JsonValue>(
    flagKey: string,
    defaultValue: T,
    _context: EvaluationContext,
  ): ResolutionDetails<T> {
    const cached = this.cache.get(flagKey);
    if (!cached) return { value: defaultValue, reason: StandardResolutionReasons.DEFAULT };
    if (cached.type !== 'json') return { value: defaultValue, reason: StandardResolutionReasons.ERROR };
    return {
      value: cached.value as T,
      reason: StandardResolutionReasons.CACHED,
      variant: cached.variant ?? undefined,
    };
  }
}
