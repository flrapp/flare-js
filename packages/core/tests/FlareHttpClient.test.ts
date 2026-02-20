import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlareHttpClient } from '../src/client/FlareHttpClient';
import type { FlareConfig, FlagEvaluationResult, BulkEvaluationResult } from '../src/types';

const config: FlareConfig = {
  baseUrl: 'http://localhost:5001',
  apiKey: 'test-api-key',
  scope: 'test-scope',
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

function mockErrorResponse(status: number, body = '') {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('FlareHttpClient.evaluateFlag', () => {
  it('makes POST to /sdk/v1/flags/evaluate', async () => {
    const result: FlagEvaluationResult = {
      flagKey: 'my-flag',
      value: true,
      variant: 'on',
      reason: 'TARGETING_MATCH',
      flagMetadata: { updatedAt: '2024-01-01T00:00:00Z' },
    };
    mockResponse(result);

    const client = new FlareHttpClient(config);
    await client.evaluateFlag('my-flag', 'test-scope', 'user-123');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:5001/sdk/v1/flags/evaluate');
  });

  it('sends correct request body with flagKey, scope, and targetingKey', async () => {
    mockResponse({ flagKey: 'my-flag', value: false });

    const client = new FlareHttpClient(config);
    await client.evaluateFlag('my-flag', 'prod-scope', 'user-abc');

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body).toEqual({
      flagKey: 'my-flag',
      context: {
        scope: 'prod-scope',
        targetingKey: 'user-abc',
      },
    });
  });

  it('sends null targetingKey when not provided', async () => {
    mockResponse({ flagKey: 'my-flag', value: false });

    const client = new FlareHttpClient(config);
    await client.evaluateFlag('my-flag', 'test-scope');

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.context.targetingKey).toBeNull();
  });

  it('sets X-Api-Key header from config', async () => {
    mockResponse({ flagKey: 'my-flag', value: true });

    const client = new FlareHttpClient(config);
    await client.evaluateFlag('my-flag', 'test-scope');

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['X-Api-Key']).toBe('test-api-key');
  });

  it('sets Content-Type: application/json header', async () => {
    mockResponse({ flagKey: 'my-flag', value: true });

    const client = new FlareHttpClient(config);
    await client.evaluateFlag('my-flag', 'test-scope');

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('returns parsed FlagEvaluationResult on 200', async () => {
    const result: FlagEvaluationResult = {
      flagKey: 'my-flag',
      value: true,
      variant: 'on',
      reason: 'TARGETING_MATCH',
      flagMetadata: { updatedAt: '2024-01-01T00:00:00Z' },
    };
    mockResponse(result);

    const client = new FlareHttpClient(config);
    const response = await client.evaluateFlag('my-flag', 'test-scope', 'user-123');

    expect(response).toEqual(result);
  });

  it('throws error with status code on 401 response', async () => {
    mockErrorResponse(401, 'Unauthorized');

    const client = new FlareHttpClient(config);
    await expect(client.evaluateFlag('my-flag', 'test-scope')).rejects.toThrow('HTTP 401');
  });

  it('throws error with status code on 404 response', async () => {
    mockErrorResponse(404, 'Not Found');

    const client = new FlareHttpClient(config);
    await expect(client.evaluateFlag('my-flag', 'test-scope')).rejects.toThrow('HTTP 404');
  });

  it('throws error with status code on 500 response', async () => {
    mockErrorResponse(500, 'Internal Server Error');

    const client = new FlareHttpClient(config);
    await expect(client.evaluateFlag('my-flag', 'test-scope')).rejects.toThrow('HTTP 500');
  });

  it('aborts request when timeout is exceeded', async () => {
    vi.useFakeTimers();

    const clientWithTimeout = new FlareHttpClient({ ...config, timeout: 100 });

    let abortSignal: AbortSignal | undefined;
    mockFetch.mockImplementationOnce((_url: string, options: RequestInit) => {
      abortSignal = options.signal as AbortSignal;
      return new Promise((_resolve, reject) => {
        // The abort signal will trigger when timeout fires
        (options.signal as AbortSignal).addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    });

    const promise = clientWithTimeout.evaluateFlag('my-flag', 'test-scope');
    vi.advanceTimersByTime(150);

    await expect(promise).rejects.toThrow();
    expect(abortSignal?.aborted).toBe(true);

    vi.useRealTimers();
  });
});

describe('FlareHttpClient.evaluateAll', () => {
  it('makes POST to /sdk/v1/flags/evaluate-all', async () => {
    const result: BulkEvaluationResult = { flags: [] };
    mockResponse(result);

    const client = new FlareHttpClient(config);
    await client.evaluateAll('test-scope', 'user-123');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:5001/sdk/v1/flags/evaluate-all');
  });

  it('sends correct request body with scope and targetingKey', async () => {
    mockResponse({ flags: [] });

    const client = new FlareHttpClient(config);
    await client.evaluateAll('prod-scope', 'user-xyz');

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body).toEqual({
      context: {
        scope: 'prod-scope',
        targetingKey: 'user-xyz',
      },
    });
  });

  it('sends null targetingKey when not provided', async () => {
    mockResponse({ flags: [] });

    const client = new FlareHttpClient(config);
    await client.evaluateAll('test-scope');

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.context.targetingKey).toBeNull();
  });

  it('returns parsed BulkEvaluationResult on 200', async () => {
    const result: BulkEvaluationResult = {
      flags: [
        { flagKey: 'flag-a', value: true, variant: 'on' },
        { flagKey: 'flag-b', value: false, variant: 'off' },
      ],
    };
    mockResponse(result);

    const client = new FlareHttpClient(config);
    const response = await client.evaluateAll('test-scope', 'user-123');

    expect(response).toEqual(result);
  });

  it('throws error on non-2xx response', async () => {
    mockErrorResponse(503, 'Service Unavailable');

    const client = new FlareHttpClient(config);
    await expect(client.evaluateAll('test-scope')).rejects.toThrow('HTTP 503');
  });
});
