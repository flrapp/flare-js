import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { EvaluationContext } from '@openfeature/core';
import { StandardResolutionReasons } from '@openfeature/core';
import { FlareProvider } from '../src/provider/FlareProvider';
import type { FlareConfig, BulkEvaluationResult } from '../src/types';

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

function makeBulkResult(flags: BulkEvaluationResult['flags'] = []): BulkEvaluationResult {
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
        { flagKey: 'flag-a', value: true, variant: 'on' },
        { flagKey: 'flag-b', value: false, variant: 'off' },
      ]),
    );

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);

    const a = await provider.resolveBooleanEvaluation('flag-a', false, emptyContext);
    const b = await provider.resolveBooleanEvaluation('flag-b', true, emptyContext);
    expect(a.value).toBe(true);
    expect(b.value).toBe(false);
  });

  it('does not call evaluateAll again on resolve after initialization', async () => {
    mockEvaluateAll.mockResolvedValue(
      makeBulkResult([{ flagKey: 'my-flag', value: true }]),
    );

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);
    await provider.resolveBooleanEvaluation('my-flag', false, emptyContext);
    await provider.resolveBooleanEvaluation('my-flag', false, emptyContext);

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
      makeBulkResult([{ flagKey: 'my-flag', value: true, variant: 'on' }]),
    );

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);
    const result = await provider.resolveBooleanEvaluation('my-flag', false, emptyContext);

    expect(result.value).toBe(true);
    expect(result.variant).toBe('on');
    expect(result.reason).toBe(StandardResolutionReasons.CACHED);
  });

  it('returns defaultValue with reason DEFAULT when flag not in cache', async () => {
    mockEvaluateAll.mockResolvedValue(makeBulkResult());

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);
    const result = await provider.resolveBooleanEvaluation('unknown-flag', true, emptyContext);

    expect(result.value).toBe(true);
    expect(result.reason).toBe(StandardResolutionReasons.DEFAULT);
  });

  it('does not call HTTP client on resolve', async () => {
    mockEvaluateAll.mockResolvedValue(
      makeBulkResult([{ flagKey: 'my-flag', value: false }]),
    );

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);
    await provider.resolveBooleanEvaluation('my-flag', true, emptyContext);

    expect(mockEvaluateFlag).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// resolveStringEvaluation
// ---------------------------------------------------------------------------
describe('FlareProvider.resolveStringEvaluation', () => {
  it('returns "true" for cached true flag', async () => {
    mockEvaluateAll.mockResolvedValue(
      makeBulkResult([{ flagKey: 'my-flag', value: true }]),
    );

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);
    const result = await provider.resolveStringEvaluation('my-flag', 'false', emptyContext);

    expect(result.value).toBe('true');
  });

  it('returns "false" for cached false flag', async () => {
    mockEvaluateAll.mockResolvedValue(
      makeBulkResult([{ flagKey: 'my-flag', value: false }]),
    );

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);
    const result = await provider.resolveStringEvaluation('my-flag', 'true', emptyContext);

    expect(result.value).toBe('false');
  });
});

// ---------------------------------------------------------------------------
// resolveNumberEvaluation
// ---------------------------------------------------------------------------
describe('FlareProvider.resolveNumberEvaluation', () => {
  it('returns 1 for cached true flag', async () => {
    mockEvaluateAll.mockResolvedValue(
      makeBulkResult([{ flagKey: 'my-flag', value: true }]),
    );

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);
    const result = await provider.resolveNumberEvaluation('my-flag', 0, emptyContext);

    expect(result.value).toBe(1);
  });

  it('returns 0 for cached false flag', async () => {
    mockEvaluateAll.mockResolvedValue(
      makeBulkResult([{ flagKey: 'my-flag', value: false }]),
    );

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);
    const result = await provider.resolveNumberEvaluation('my-flag', 1, emptyContext);

    expect(result.value).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// resolveObjectEvaluation
// ---------------------------------------------------------------------------
describe('FlareProvider.resolveObjectEvaluation', () => {
  it('returns { value: true } for cached true flag', async () => {
    mockEvaluateAll.mockResolvedValue(
      makeBulkResult([{ flagKey: 'my-flag', value: true }]),
    );

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);
    const result = await provider.resolveObjectEvaluation('my-flag', {}, emptyContext);

    expect(result.value).toEqual({ value: true });
  });

  it('returns { value: false } for cached false flag', async () => {
    mockEvaluateAll.mockResolvedValue(
      makeBulkResult([{ flagKey: 'my-flag', value: false }]),
    );

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);
    const result = await provider.resolveObjectEvaluation('my-flag', {}, emptyContext);

    expect(result.value).toEqual({ value: false });
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
      .mockResolvedValueOnce(makeBulkResult([{ flagKey: 'my-flag', value: false }]))
      .mockResolvedValueOnce(makeBulkResult([{ flagKey: 'my-flag', value: true }]));

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);

    const before = await provider.resolveBooleanEvaluation('my-flag', true, emptyContext);
    expect(before.value).toBe(false);

    await provider.onContextChange(emptyContext, contextWithTargeting);

    const after = await provider.resolveBooleanEvaluation('my-flag', false, emptyContext);
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

    // onContextChange calls refreshCache once
    expect(mockEvaluateAll).toHaveBeenCalledTimes(2);

    // new polling fires with new context
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

    // only 2 calls: initialize + onContextChange
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
    // only 1 call from initialize — polling stopped
    expect(mockEvaluateAll).toHaveBeenCalledTimes(1);
  });

  it('clears the cache on close', async () => {
    mockEvaluateAll.mockResolvedValue(
      makeBulkResult([{ flagKey: 'my-flag', value: true }]),
    );

    const provider = new FlareProvider(config);
    await provider.initialize(emptyContext);
    await provider.onClose();

    const result = await provider.resolveBooleanEvaluation('my-flag', false, emptyContext);
    expect(result.value).toBe(false);
    expect(result.reason).toBe(StandardResolutionReasons.DEFAULT);
  });
});
