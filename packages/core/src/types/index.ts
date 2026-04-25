export interface FlareConfig {
  baseUrl: string;
  apiKey: string;
  scope: string;
  timeout?: number;
  pollingIntervalMs?: number;
}

export interface FlagEvaluationResult {
  flagKey: string;
  value: boolean;
  variant?: string | null;
  reason?: string;
  flagMetadata?: {
    scopeAlias?: string | null;
    scopeId?: string | null;
    updatedAt: string;
  } | null;
}

export interface BulkEvaluationResult {
  flags: FlagEvaluationResult[];
}

export type FlagType = 'boolean' | 'string' | 'number' | 'json';

export type EvaluationReason =
  | 'STATIC'
  | 'TARGETING_MATCH'
  | 'DEFAULT'
  | 'DISABLED'
  | 'TYPE_MISMATCH'
  | 'ERROR';

export interface EvaluationContext {
  scope: string;
  targetingKey: string;
  attributes?: Record<string, string | number | boolean>;
}

export interface EvaluationResult<T> {
  flagKey: string;
  value: T;
  reason: EvaluationReason;
  variant: string | null;
}

export interface TypedFlagResponse {
  flagKey: string;
  type: FlagType;
  value: boolean | string | number | object;
  variant: string | null;
  reason: EvaluationReason;
}

export interface TypedBulkEvaluationResponse {
  flags: TypedFlagResponse[];
}
