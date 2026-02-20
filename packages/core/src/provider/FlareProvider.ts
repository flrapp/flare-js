import {
  type CommonProvider,
  type EvaluationContext,
  type ProviderMetadata,
  type ResolutionDetails,
  FlagNotFoundError,
  GeneralError,
  ServerProviderStatus,
  StandardResolutionReasons,
} from '@openfeature/core';
import { FlareHttpClient } from '../client/FlareHttpClient';
import type { FlareConfig } from '../types';

export class FlareProvider implements CommonProvider<ServerProviderStatus> {
  readonly metadata: ProviderMetadata = { name: 'flare-provider' };
  private readonly client: FlareHttpClient;
  private readonly config: FlareConfig;

  constructor(config: FlareConfig) {
    this.config = config;
    this.client = new FlareHttpClient(config);
  }

  async initialize(): Promise<void> {
    // optional: validate connection on startup
  }

  async resolveBooleanEvaluation(
    flagKey: string,
    _defaultValue: boolean,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<boolean>> {
    const scope = this.config.scope;
    const targetingKey = context.targetingKey ?? null;

    try {
      const result = await this.client.evaluateFlag(flagKey, scope, targetingKey);
      return {
        value: result.value,
        reason: result.reason ?? StandardResolutionReasons.TARGETING_MATCH,
        variant: result.variant ?? undefined,
        flagMetadata: result.flagMetadata
          ? {
              updatedAt: result.flagMetadata.updatedAt,
              ...(result.flagMetadata.scopeAlias != null && {
                scopeAlias: result.flagMetadata.scopeAlias,
              }),
              ...(result.flagMetadata.scopeId != null && {
                scopeId: result.flagMetadata.scopeId,
              }),
            }
          : undefined,
      };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('HTTP 404')) {
        throw new FlagNotFoundError(`Flag '${flagKey}' not found`);
      }
      throw new GeneralError(
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<string>> {
    const result = await this.resolveBooleanEvaluation(
      flagKey,
      defaultValue === 'true',
      context,
    );
    return { ...result, value: String(result.value) };
  }

  async resolveNumberEvaluation(
    flagKey: string,
    defaultValue: number,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<number>> {
    const result = await this.resolveBooleanEvaluation(
      flagKey,
      defaultValue !== 0,
      context,
    );
    return { ...result, value: result.value ? 1 : 0 };
  }

  async resolveObjectEvaluation<T extends object>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<T>> {
    const result = await this.resolveBooleanEvaluation(
      flagKey,
      Boolean(defaultValue),
      context,
    );
    return { ...result, value: { value: result.value } as unknown as T };
  }
}
