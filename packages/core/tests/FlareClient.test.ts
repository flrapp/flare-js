import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlareClient } from '../src/client/FlareClient';
import type { FlareConfig, EvaluationContext } from '../src/types';

const config: FlareConfig = {
  baseUrl: 'http://localhost:5001',
  apiKey: 'test-api-key',
  scope: 'test-scope',
};

const ctx: EvaluationContext = {
  scope: 'test-scope',
  targetingKey: 'user-123',
};

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(body: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

function mockNetworkError() {
  mockFetch.mockRejectedValueOnce(new Error('Network failure'));
}

function mockHttpError(status: number) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.resolve(''),
    text: () => Promise.resolve(''),
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

// ---------------------------------------------------------------------------
// getBooleanValue
// ---------------------------------------------------------------------------
describe('FlareClient.getBooleanValue', () => {
  it('returns value when response type matches boolean', async () => {
    mockResponse({ flagKey: 'my-flag', type: 'boolean', value: true, variant: 'on', reason: 'STATIC' });

    const client = new FlareClient(config);
    const result = await client.getBooleanValue('my-flag', false, ctx);

    expect(result.value).toBe(true);
    expect(result.reason).toBe('STATIC');
    expect(result.variant).toBe('on');
    expect(result.flagKey).toBe('my-flag');
  });

  it('returns defaultValue with reason TYPE_MISMATCH when server returns a non-boolean type', async () => {
    mockResponse({ flagKey: 'my-flag', type: 'string', value: 'hello', variant: null, reason: 'STATIC' });

    const client = new FlareClient(config);
    const result = await client.getBooleanValue('my-flag', false, ctx);

    expect(result.value).toBe(false);
    expect(result.reason).toBe('TYPE_MISMATCH');
    expect(result.variant).toBeNull();
  });

  it('returns defaultValue with reason ERROR on network failure', async () => {
    mockNetworkError();

    const client = new FlareClient(config);
    const result = await client.getBooleanValue('my-flag', true, ctx);

    expect(result.value).toBe(true);
    expect(result.reason).toBe('ERROR');
    expect(result.variant).toBeNull();
  });

  it('returns defaultValue with reason ERROR on HTTP error', async () => {
    mockHttpError(500);

    const client = new FlareClient(config);
    const result = await client.getBooleanValue('my-flag', false, ctx);

    expect(result.value).toBe(false);
    expect(result.reason).toBe('ERROR');
  });

  it('sends context attributes in request body', async () => {
    mockResponse({ flagKey: 'my-flag', type: 'boolean', value: true, variant: null, reason: 'TARGETING_MATCH' });

    const ctxWithAttributes: EvaluationContext = {
      scope: 'test-scope',
      targetingKey: 'user-123',
      attributes: { plan: 'pro', age: 30, beta: true },
    };

    const client = new FlareClient(config);
    await client.getBooleanValue('my-flag', false, ctxWithAttributes);

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.context.attributes).toEqual({ plan: 'pro', age: 30, beta: true });
    expect(body.context.targetingKey).toBe('user-123');
    expect(body.context.scope).toBe('test-scope');
  });

  it('sends flagKey in request body', async () => {
    mockResponse({ flagKey: 'feat-x', type: 'boolean', value: false, variant: null, reason: 'DEFAULT' });

    const client = new FlareClient(config);
    await client.getBooleanValue('feat-x', true, ctx);

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.flagKey).toBe('feat-x');
  });

  it('POSTs to /sdk/v1/flags/evaluate', async () => {
    mockResponse({ flagKey: 'my-flag', type: 'boolean', value: true, variant: null, reason: 'STATIC' });

    const client = new FlareClient(config);
    await client.getBooleanValue('my-flag', false, ctx);

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:5001/sdk/v1/flags/evaluate');
  });
});

// ---------------------------------------------------------------------------
// getStringValue
// ---------------------------------------------------------------------------
describe('FlareClient.getStringValue', () => {
  it('returns value when type matches string', async () => {
    mockResponse({ flagKey: 'color', type: 'string', value: 'blue', variant: 'blue', reason: 'TARGETING_MATCH' });

    const client = new FlareClient(config);
    const result = await client.getStringValue('color', 'red', ctx);

    expect(result.value).toBe('blue');
    expect(result.reason).toBe('TARGETING_MATCH');
  });

  it('returns defaultValue with TYPE_MISMATCH when type is not string', async () => {
    mockResponse({ flagKey: 'color', type: 'boolean', value: true, variant: null, reason: 'STATIC' });

    const client = new FlareClient(config);
    const result = await client.getStringValue('color', 'red', ctx);

    expect(result.value).toBe('red');
    expect(result.reason).toBe('TYPE_MISMATCH');
  });

  it('returns defaultValue with ERROR on network failure', async () => {
    mockNetworkError();

    const client = new FlareClient(config);
    const result = await client.getStringValue('color', 'red', ctx);

    expect(result.value).toBe('red');
    expect(result.reason).toBe('ERROR');
  });
});

// ---------------------------------------------------------------------------
// getNumberValue
// ---------------------------------------------------------------------------
describe('FlareClient.getNumberValue', () => {
  it('returns value when type matches number', async () => {
    mockResponse({ flagKey: 'limit', type: 'number', value: 42, variant: null, reason: 'STATIC' });

    const client = new FlareClient(config);
    const result = await client.getNumberValue('limit', 0, ctx);

    expect(result.value).toBe(42);
    expect(result.reason).toBe('STATIC');
  });

  it('returns defaultValue with TYPE_MISMATCH when type is not number', async () => {
    mockResponse({ flagKey: 'limit', type: 'boolean', value: true, variant: null, reason: 'STATIC' });

    const client = new FlareClient(config);
    const result = await client.getNumberValue('limit', 0, ctx);

    expect(result.value).toBe(0);
    expect(result.reason).toBe('TYPE_MISMATCH');
  });

  it('returns defaultValue with ERROR on network failure', async () => {
    mockNetworkError();

    const client = new FlareClient(config);
    const result = await client.getNumberValue('limit', 99, ctx);

    expect(result.value).toBe(99);
    expect(result.reason).toBe('ERROR');
  });
});

// ---------------------------------------------------------------------------
// getObjectValue
// ---------------------------------------------------------------------------
describe('FlareClient.getObjectValue', () => {
  it('returns value when type matches json', async () => {
    const payload = { threshold: 0.5, enabled: true };
    mockResponse({ flagKey: 'config', type: 'json', value: payload, variant: null, reason: 'STATIC' });

    const client = new FlareClient(config);
    const result = await client.getObjectValue<typeof payload>('config', { threshold: 0, enabled: false }, ctx);

    expect(result.value).toEqual(payload);
    expect(result.reason).toBe('STATIC');
  });

  it('returns defaultValue with TYPE_MISMATCH when type is not json', async () => {
    mockResponse({ flagKey: 'config', type: 'boolean', value: true, variant: null, reason: 'STATIC' });

    const defaultVal = { threshold: 0, enabled: false };
    const client = new FlareClient(config);
    const result = await client.getObjectValue('config', defaultVal, ctx);

    expect(result.value).toEqual(defaultVal);
    expect(result.reason).toBe('TYPE_MISMATCH');
  });

  it('returns defaultValue with ERROR on network failure', async () => {
    mockNetworkError();

    const defaultVal = { x: 1 };
    const client = new FlareClient(config);
    const result = await client.getObjectValue('config', defaultVal, ctx);

    expect(result.value).toEqual(defaultVal);
    expect(result.reason).toBe('ERROR');
  });
});

// ---------------------------------------------------------------------------
// setContext / default context
// ---------------------------------------------------------------------------
describe('FlareClient.setContext', () => {
  it('uses default context when no per-call context given', async () => {
    mockResponse({ flagKey: 'my-flag', type: 'boolean', value: true, variant: null, reason: 'STATIC' });

    const client = new FlareClient(config);
    client.setContext({ scope: 'default-scope', targetingKey: 'default-user' });

    await client.getBooleanValue('my-flag', false);

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.context.scope).toBe('default-scope');
    expect(body.context.targetingKey).toBe('default-user');
  });

  it('per-call context overrides the default context', async () => {
    mockResponse({ flagKey: 'my-flag', type: 'boolean', value: true, variant: null, reason: 'STATIC' });

    const client = new FlareClient(config);
    client.setContext({ scope: 'default-scope', targetingKey: 'default-user' });

    const overrideCtx: EvaluationContext = { scope: 'override-scope', targetingKey: 'override-user' };
    await client.getBooleanValue('my-flag', false, overrideCtx);

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.context.scope).toBe('override-scope');
    expect(body.context.targetingKey).toBe('override-user');
  });

  it('getContext returns the set context', () => {
    const client = new FlareClient(config);
    expect(client.getContext()).toBeUndefined();

    const defaultCtx: EvaluationContext = { scope: 'test', targetingKey: 'u1' };
    client.setContext(defaultCtx);
    expect(client.getContext()).toEqual(defaultCtx);
  });
});

// ---------------------------------------------------------------------------
// evaluateAll
// ---------------------------------------------------------------------------
describe('FlareClient.evaluateAll', () => {
  it('POSTs to /sdk/v1/flags/evaluate-all with context', async () => {
    mockResponse({ flags: [] });

    const client = new FlareClient(config);
    await client.evaluateAll(ctx);

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:5001/sdk/v1/flags/evaluate-all');

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.context.scope).toBe('test-scope');
    expect(body.context.targetingKey).toBe('user-123');
  });

  it('returns a record keyed by flagKey', async () => {
    mockResponse({
      flags: [
        { flagKey: 'flag-a', type: 'boolean', value: true, variant: 'on', reason: 'STATIC' },
        { flagKey: 'flag-b', type: 'string', value: 'hello', variant: null, reason: 'DEFAULT' },
      ],
    });

    const client = new FlareClient(config);
    const result = await client.evaluateAll(ctx);

    expect(result['flag-a']).toEqual({ flagKey: 'flag-a', value: true, reason: 'STATIC', variant: 'on' });
    expect(result['flag-b']).toEqual({ flagKey: 'flag-b', value: 'hello', reason: 'DEFAULT', variant: null });
  });

  it('returns empty record on network failure', async () => {
    mockNetworkError();

    const client = new FlareClient(config);
    const result = await client.evaluateAll(ctx);

    expect(result).toEqual({});
  });
});
