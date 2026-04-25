import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { EvaluationContext } from '@openfeature/core';
import { StandardResolutionReasons } from '@openfeature/core';
import { FlareProvider } from '../src/provider/FlareProvider';
import type { FlareConfig, TypedBulkEvaluationResponse } from '../src/types';

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

function makeBulkResult(flags: TypedBulkEvaluationResponse['flags'] = []): TypedBulkEvaluationResponse {
  return { flags };
}

beforeEach(() => {
  mockEvaluateFlag.mockReset();
  mockEvaluateAll.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// initialize
// ---------------------------------------------------------------------------
describe('FlareProvider.initialize', () => {
  it('calls evaluateAll once with config scope and null targetingKey', async () => {
    mockEvaluateAll.mockResolvedValue(makeBulkResult());

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);

    expect(mockEvaluateAll).toHaveBeenCalledOnce();
    expect(mockEvaluateAll).toHaveBeenCalledWith('test-scope', null);
  });

  it('passes targetingKey from context to evaluateAll', async () => {
    mockEvaluateAll.mockResolvedValue(makeBulkResult());

    const provider = new FlareProvider(config);
    await provider.initialize(contextWithTargeting);

    expect(mockEvaluateAll).toHaveBeenCalledWith('test-scope', 'user-123');
  });

  it('populates cache from evaluateAll response', async () => {
    mockEvaluateAll.mockResolvedValue(
      makeBulkResult([
        { flagKey: 'flag-a', type: 'boolean', value: true, variant: 'on', reason: 'STATIC' },
        { flagKey: 'flag-b', type: 'boolean', value: false, variant: 'off', reason: 'STATIC' },
      ]),
    );

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);

    const a = provider.resolveBooleanEvaluation('flag-a', false, emptyContext);
    const b = provider.resolveBooleanEvaluation('flag-b', true, emptyContext);
    expect(a.value).toBe(true);
    expect(b.value).toBe(false);
  });

  it('does not call evaluateAll again on resolve after initialization', async () => {
    mockEvaluateAll.mockResolvedValue(
      makeBulkResult([{ flagKey: 'my-flag', type: 'boolean', value: true, variant: null, reason: 'STATIC' }]),
    );

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);
    provider.resolveBooleanEvaluation('my-flag', false, emptyContext);
    provider.resolveBooleanEvaluation('my-flag', false, emptyContext);

    expect(mockEvaluateAll).toHaveBeenCalledOnce();
    expect(mockEvaluateFlag).not.toHaveBeenCalled();
  });

  it('starts polling interval when pollingIntervalMs is set', async () => {
    vi.useFakeTimers();
    mockEvaluateAll.mockResolvedValue(makeBulkResult());

    const pollingConfig = { ...config, pollingIntervalMs: 5000 };
    const provider = new FlareProvider(pollingConfig);
    await provider.initialize(emptyContext);

    expect(mockEvaluateAll).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    expect(mockEvaluateAll).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(5000);
    expect(mockEvaluateAll).toHaveBeenCalledTimes(3);

    await provider.onClose();
  });

  it('does not start polling when pollingIntervalMs is not set', async () => {
    vi.useFakeTimers();
    mockEvaluateAll.mockResolvedValue(makeBulkResult());

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);

    await vi.advanceTimersByTimeAsync(60000);
    expect(mockEvaluateAll).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// resolveBooleanEvaluation
// ---------------------------------------------------------------------------
describe('FlareProvider.resolveBooleanEvaluation', () => {
  it('returns cached value with reason CACHED', async () => {
    mockEvaluateAll.mockResolvedValue(
      makeBulkResult([{ flagKey: 'my-flag', type: 'boolean', value: true, variant: 'on', reason: 'STATIC' }]),
    );

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);
    const result = provider.resolveBooleanEvaluation('my-flag', false, emptyContext);

    expect(result.value).toBe(true);
    expect(result.variant).toBe('on');
    expect(result.reason).toBe(StandardResolutionReasons.CACHED);
  });

  it('returns defaultValue with reason DEFAULT when flag not in cache', async () => {
    mockEvaluateAll.mockResolvedValue(makeBulkResult());

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);
    const result = provider.resolveBooleanEvaluation('unknown-flag', true, emptyContext);

    expect(result.value).toBe(true);
    expect(result.reason).toBe(StandardResolutionReasons.DEFAULT);
  });

  it('returns defaultValue with reason ERROR when cached flag type is not boolean', async () => {
    mockEvaluateAll.mockResolvedValue(
      makeBulkResult([{ flagKey: 'my-flag', type: 'string', value: 'yes', variant: null, reason: 'STATIC' }]),
    );

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);
    const result = provider.resolveBooleanEvaluation('my-flag', false, emptyContext);

    expect(result.value).toBe(false);
    expect(result.reason).toBe(StandardResolutionReasons.ERROR);
  });

  it('does not call HTTP client on resolve', async () => {
    mockEvaluateAll.mockResolvedValue(
      makeBulkResult([{ flagKey: 'my-flag', type: 'boolean', value: false, variant: null, reason: 'STATIC' }]),
    );

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);
    provider.resolveBooleanEvaluation('my-flag', true, emptyContext);

    expect(mockEvaluateFlag).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// resolveStringEvaluation
// ---------------------------------------------------------------------------
describe('FlareProvider.resolveStringEvaluation', () => {
  it('returns cached string value with reason CACHED', async () => {
    mockEvaluateAll.mockResolvedValue(
      makeBulkResult([{ flagKey: 'my-flag', type: 'string', value: 'blue', variant: 'blue', reason: 'STATIC' }]),
    );

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);
    const result = provider.resolveStringEvaluation('my-flag', 'red', emptyContext);

    expect(result.value).toBe('blue');
    expect(result.variant).toBe('blue');
    expect(result.reason).toBe(StandardResolutionReasons.CACHED);
  });

  it('returns defaultValue with reason DEFAULT when flag not in cache', async () => {
    mockEvaluateAll.mockResolvedValue(makeBulkResult());

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);
    const result = provider.resolveStringEvaluation('missing', 'fallback', emptyContext);

    expect(result.value).toBe('fallback');
    expect(result.reason).toBe(StandardResolutionReasons.DEFAULT);
  });

  it('returns defaultValue with reason ERROR when cached flag type is not string', async () => {
    mockEvaluateAll.mockResolvedValue(
      makeBulkResult([{ flagKey: 'my-flag', type: 'boolean', value: true, variant: null, reason: 'STATIC' }]),
    );

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);
    const result = provider.resolveStringEvaluation('my-flag', 'fallback', emptyContext);

    expect(result.value).toBe('fallback');
    expect(result.reason).toBe(StandardResolutionReasons.ERROR);
  });
});

// ---------------------------------------------------------------------------
// resolveNumberEvaluation
// ---------------------------------------------------------------------------
describe('FlareProvider.resolveNumberEvaluation', () => {
  it('returns cached number value with reason CACHED', async () => {
    mockEvaluateAll.mockResolvedValue(
      makeBulkResult([{ flagKey: 'my-flag', type: 'number', value: 42, variant: null, reason: 'STATIC' }]),
    );

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);
    const result = provider.resolveNumberEvaluation('my-flag', 0, emptyContext);

    expect(result.value).toBe(42);
    expect(result.reason).toBe(StandardResolutionReasons.CACHED);
  });

  it('returns defaultValue with reason DEFAULT when flag not in cache', async () => {
    mockEvaluateAll.mockResolvedValue(makeBulkResult());

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);
    const result = provider.resolveNumberEvaluation('missing', 99, emptyContext);

    expect(result.value).toBe(99);
    expect(result.reason).toBe(StandardResolutionReasons.DEFAULT);
  });

  it('returns defaultValue with reason ERROR when cached flag type is not number', async () => {
    mockEvaluateAll.mockResolvedValue(
      makeBulkResult([{ flagKey: 'my-flag', type: 'boolean', value: true, variant: null, reason: 'STATIC' }]),
    );

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);
    const result = provider.resolveNumberEvaluation('my-flag', 5, emptyContext);

    expect(result.value).toBe(5);
    expect(result.reason).toBe(StandardResolutionReasons.ERROR);
  });
});

// ---------------------------------------------------------------------------
// resolveObjectEvaluation
// ---------------------------------------------------------------------------
describe('FlareProvider.resolveObjectEvaluation', () => {
  it('returns cached object value with reason CACHED', async () => {
    const payload = { threshold: 0.5, enabled: true };
    mockEvaluateAll.mockResolvedValue(
      makeBulkResult([{ flagKey: 'my-flag', type: 'json', value: payload, variant: null, reason: 'STATIC' }]),
    );

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);
    const result = provider.resolveObjectEvaluation('my-flag', {}, emptyContext);

    expect(result.value).toEqual(payload);
    expect(result.reason).toBe(StandardResolutionReasons.CACHED);
  });

  it('returns defaultValue with reason DEFAULT when flag not in cache', async () => {
    mockEvaluateAll.mockResolvedValue(makeBulkResult());

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);
    const defaultVal = { x: 1 };
    const result = provider.resolveObjectEvaluation('missing', defaultVal, emptyContext);

    expect(result.value).toEqual(defaultVal);
    expect(result.reason).toBe(StandardResolutionReasons.DEFAULT);
  });

  it('returns defaultValue with reason ERROR when cached flag type is not json', async () => {
    mockEvaluateAll.mockResolvedValue(
      makeBulkResult([{ flagKey: 'my-flag', type: 'boolean', value: true, variant: null, reason: 'STATIC' }]),
    );

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);
    const defaultVal = { x: 0 };
    const result = provider.resolveObjectEvaluation('my-flag', defaultVal, emptyContext);

    expect(result.value).toEqual(defaultVal);
    expect(result.reason).toBe(StandardResolutionReasons.ERROR);
  });
});

// ---------------------------------------------------------------------------
// onContextChange
// ---------------------------------------------------------------------------
describe('FlareProvider.onContextChange', () => {
  it('calls refreshCache with new context', async () => {
    mockEvaluateAll.mockResolvedValue(makeBulkResult());

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);

    const newContext: EvaluationContext = { targetingKey: 'user-456' };
    await provider.onContextChange(emptyContext, newContext);

    expect(mockEvaluateAll).toHaveBeenCalledTimes(2);
    expect(mockEvaluateAll).toHaveBeenLastCalledWith('test-scope', 'user-456');
  });

  it('updates cache with flags from new context', async () => {
    mockEvaluateAll
      .mockResolvedValueOnce(makeBulkResult([{ flagKey: 'my-flag', type: 'boolean', value: false, variant: null, reason: 'STATIC' }]))
      .mockResolvedValueOnce(makeBulkResult([{ flagKey: 'my-flag', type: 'boolean', value: true, variant: null, reason: 'TARGETING_MATCH' }]));

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);

    const before = provider.resolveBooleanEvaluation('my-flag', true, emptyContext);
    expect(before.value).toBe(false);

    await provider.onContextChange(emptyContext, contextWithTargeting);

    const after = provider.resolveBooleanEvaluation('my-flag', false, emptyContext);
    expect(after.value).toBe(true);
  });

  it('restarts polling interval with new context when polling is enabled', async () => {
    vi.useFakeTimers();
    mockEvaluateAll.mockResolvedValue(makeBulkResult());

    const pollingConfig = { ...config, pollingIntervalMs: 5000 };
    const provider = new FlareProvider(pollingConfig);
    await provider.initialize(emptyContext);

    expect(mockEvaluateAll).toHaveBeenCalledTimes(1);

    const newContext: EvaluationContext = { targetingKey: 'user-456' };
    await provider.onContextChange(emptyContext, newContext);

    expect(mockEvaluateAll).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(5000);
    expect(mockEvaluateAll).toHaveBeenCalledTimes(3);
    expect(mockEvaluateAll).toHaveBeenLastCalledWith('test-scope', 'user-456');

    await provider.onClose();
  });

  it('does not restart polling when polling was not enabled', async () => {
    vi.useFakeTimers();
    mockEvaluateAll.mockResolvedValue(makeBulkResult());

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);
    await provider.onContextChange(emptyContext, contextWithTargeting);

    await vi.advanceTimersByTimeAsync(60000);

    expect(mockEvaluateAll).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// onClose
// ---------------------------------------------------------------------------
describe('FlareProvider.onClose', () => {
  it('clears polling interval on close', async () => {
    vi.useFakeTimers();
    mockEvaluateAll.mockResolvedValue(makeBulkResult());

    const pollingConfig = { ...config, pollingIntervalMs: 5000 };
    const provider = new FlareProvider(pollingConfig);
    await provider.initialize(emptyContext);
    await provider.onClose();

    await vi.advanceTimersByTimeAsync(30000);
    expect(mockEvaluateAll).toHaveBeenCalledTimes(1);
  });

  it('clears the cache on close', async () => {
    mockEvaluateAll.mockResolvedValue(
      makeBulkResult([{ flagKey: 'my-flag', type: 'boolean', value: true, variant: null, reason: 'STATIC' }]),
    );

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);
    await provider.onClose();

    const result = provider.resolveBooleanEvaluation('my-flag', false, emptyContext);
    expect(result.value).toBe(false);
    expect(result.reason).toBe(StandardResolutionReasons.DEFAULT);
  });
});
