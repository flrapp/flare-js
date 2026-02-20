import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlagNotFoundError, GeneralError } from '@openfeature/core';
import type { EvaluationContext } from '@openfeature/core';
import { FlareProvider } from '../src/provider/FlareProvider';
import type { FlareConfig } from '../src/types';

const mockEvaluateFlag = vi.hoisted(() => vi.fn());
const mockEvaluateAll = vi.hoisted(() => vi.fn());

vi.mock('../src/client/FlareHttpClient', () => ({
  FlareHttpClient: class {
    evaluateFlag = mockEvaluateFlag;
    evaluateAll = mockEvaluateAll;
  },
}));

const config: FlareConfig = {
  baseUrl: 'http://localhost:5001',
  apiKey: 'test-api-key',
  scope: 'test-scope',
};

const emptyContext: EvaluationContext = {};
const contextWithTargeting: EvaluationContext = { targetingKey: 'user-123' };

beforeEach(() => {
  mockEvaluateFlag.mockReset();
  mockEvaluateAll.mockReset();
});

describe('FlareProvider.resolveBooleanEvaluation', () => {
  it('returns ResolutionDetails with correct value from API response', async () => {
    mockEvaluateFlag.mockResolvedValue({
      flagKey: 'test-flag',
      value: true,
      variant: 'on',
      reason: 'TARGETING_MATCH',
    });

    const provider = new FlareProvider(config);
    const result = await provider.resolveBooleanEvaluation('test-flag', false, emptyContext);

    expect(result.value).toBe(true);
    expect(result.variant).toBe('on');
    expect(result.reason).toBe('TARGETING_MATCH');
  });

  it('always uses this.config.scope, never reads scope from EvaluationContext', async () => {
    mockEvaluateFlag.mockResolvedValue({ flagKey: 'test-flag', value: true });

    const provider = new FlareProvider(config);
    const contextWithScope = { ...contextWithTargeting, scope: 'injected-scope' } as EvaluationContext;
    await provider.resolveBooleanEvaluation('test-flag', false, contextWithScope);

    expect(mockEvaluateFlag).toHaveBeenCalledWith('test-flag', 'test-scope', 'user-123');
  });

  it('passes context.targetingKey to HTTP client', async () => {
    mockEvaluateFlag.mockResolvedValue({ flagKey: 'test-flag', value: false });

    const provider = new FlareProvider(config);
    await provider.resolveBooleanEvaluation('test-flag', false, contextWithTargeting);

    expect(mockEvaluateFlag).toHaveBeenCalledWith('test-flag', 'test-scope', 'user-123');
  });

  it('passes null targetingKey when context has none', async () => {
    mockEvaluateFlag.mockResolvedValue({ flagKey: 'test-flag', value: false });

    const provider = new FlareProvider(config);
    await provider.resolveBooleanEvaluation('test-flag', false, emptyContext);

    expect(mockEvaluateFlag).toHaveBeenCalledWith('test-flag', 'test-scope', null);
  });

  it('returns reason from API response', async () => {
    mockEvaluateFlag.mockResolvedValue({ flagKey: 'test-flag', value: true, reason: 'SPLIT' });

    const provider = new FlareProvider(config);
    const result = await provider.resolveBooleanEvaluation('test-flag', false, emptyContext);

    expect(result.reason).toBe('SPLIT');
  });

  it('returns default reason TARGETING_MATCH when API returns no reason', async () => {
    mockEvaluateFlag.mockResolvedValue({ flagKey: 'test-flag', value: true });

    const provider = new FlareProvider(config);
    const result = await provider.resolveBooleanEvaluation('test-flag', false, emptyContext);

    expect(result.reason).toBe('TARGETING_MATCH');
  });

  it('throws FlagNotFoundError when HTTP client throws 404 error', async () => {
    mockEvaluateFlag.mockRejectedValue(new Error('HTTP 404: Not Found'));

    const provider = new FlareProvider(config);
    await expect(
      provider.resolveBooleanEvaluation('missing-flag', false, emptyContext),
    ).rejects.toThrow(FlagNotFoundError);
  });

  it('throws GeneralError on other HTTP errors', async () => {
    mockEvaluateFlag.mockRejectedValue(new Error('HTTP 500: Internal Server Error'));

    const provider = new FlareProvider(config);
    await expect(
      provider.resolveBooleanEvaluation('test-flag', false, emptyContext),
    ).rejects.toThrow(GeneralError);
  });

  it('throws GeneralError (not default value) on error', async () => {
    mockEvaluateFlag.mockRejectedValue(new Error('HTTP 503: Service Unavailable'));

    const provider = new FlareProvider(config);
    await expect(
      provider.resolveBooleanEvaluation('test-flag', true, emptyContext),
    ).rejects.toThrow(GeneralError);
  });

  it('includes flagMetadata in result', async () => {
    mockEvaluateFlag.mockResolvedValue({
      flagKey: 'test-flag',
      value: true,
      flagMetadata: { updatedAt: '2024-01-01T00:00:00Z', scopeAlias: 'prod', scopeId: 'scope-1' },
    });

    const provider = new FlareProvider(config);
    const result = await provider.resolveBooleanEvaluation('test-flag', false, emptyContext);

    expect(result.flagMetadata).toEqual({
      updatedAt: '2024-01-01T00:00:00Z',
      scopeAlias: 'prod',
      scopeId: 'scope-1',
    });
  });

  it('omits null scopeAlias and scopeId from flagMetadata', async () => {
    mockEvaluateFlag.mockResolvedValue({
      flagKey: 'test-flag',
      value: true,
      flagMetadata: { updatedAt: '2024-01-01T00:00:00Z', scopeAlias: null, scopeId: null },
    });

    const provider = new FlareProvider(config);
    const result = await provider.resolveBooleanEvaluation('test-flag', false, emptyContext);

    expect(result.flagMetadata).toEqual({ updatedAt: '2024-01-01T00:00:00Z' });
  });
});

describe('FlareProvider.resolveStringEvaluation', () => {
  it('returns "true" when flag value is true', async () => {
    mockEvaluateFlag.mockResolvedValue({ flagKey: 'test-flag', value: true });

    const provider = new FlareProvider(config);
    const result = await provider.resolveStringEvaluation('test-flag', 'false', emptyContext);

    expect(result.value).toBe('true');
  });

  it('returns "false" when flag value is false', async () => {
    mockEvaluateFlag.mockResolvedValue({ flagKey: 'test-flag', value: false });

    const provider = new FlareProvider(config);
    const result = await provider.resolveStringEvaluation('test-flag', 'true', emptyContext);

    expect(result.value).toBe('false');
  });
});

describe('FlareProvider.resolveNumberEvaluation', () => {
  it('returns 1 when flag value is true', async () => {
    mockEvaluateFlag.mockResolvedValue({ flagKey: 'test-flag', value: true });

    const provider = new FlareProvider(config);
    const result = await provider.resolveNumberEvaluation('test-flag', 0, emptyContext);

    expect(result.value).toBe(1);
  });

  it('returns 0 when flag value is false', async () => {
    mockEvaluateFlag.mockResolvedValue({ flagKey: 'test-flag', value: false });

    const provider = new FlareProvider(config);
    const result = await provider.resolveNumberEvaluation('test-flag', 1, emptyContext);

    expect(result.value).toBe(0);
  });
});

describe('FlareProvider.resolveObjectEvaluation', () => {
  it('returns { value: true } when flag value is true', async () => {
    mockEvaluateFlag.mockResolvedValue({ flagKey: 'test-flag', value: true });

    const provider = new FlareProvider(config);
    const result = await provider.resolveObjectEvaluation('test-flag', {}, emptyContext);

    expect(result.value).toEqual({ value: true });
  });

  it('returns { value: false } when flag value is false', async () => {
    mockEvaluateFlag.mockResolvedValue({ flagKey: 'test-flag', value: false });

    const provider = new FlareProvider(config);
    const result = await provider.resolveObjectEvaluation('test-flag', {}, emptyContext);

    expect(result.value).toEqual({ value: false });
  });
});
