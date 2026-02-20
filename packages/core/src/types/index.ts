export interface FlareConfig {
  baseUrl: string;
  apiKey: string;
  scope: string;
  timeout?: number;
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
