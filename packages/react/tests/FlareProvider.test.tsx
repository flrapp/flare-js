import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FlareProvider } from '../src/components/FlareProvider';
import type { FlareConfig } from '@flrapp/core';

const mockSetProviderAndWait = vi.hoisted(() => vi.fn());
const mockOpenFeatureProvider = vi.hoisted(() =>
  vi.fn(({ children }: { children: React.ReactNode }) => <>{children}</>),
);

vi.mock('@openfeature/react-sdk', () => ({
  OpenFeature: {
    setProviderAndWait: mockSetProviderAndWait,
  },
  OpenFeatureProvider: mockOpenFeatureProvider,
}));

vi.mock('@flrapp/core', () => ({
  FlareProvider: class MockFlareProvider {
    constructor(public config: FlareConfig) {}
  },
  FlareClient: class MockFlareClient {
    constructor(public config: FlareConfig) {}
    getBooleanValue = vi.fn();
    getStringValue = vi.fn();
    getNumberValue = vi.fn();
    getObjectValue = vi.fn();
    evaluateAll = vi.fn();
    setContext = vi.fn();
    getContext = vi.fn();
  },
}));

const config: FlareConfig = {
  baseUrl: 'http://localhost:5001',
  apiKey: 'test-api-key',
  scope: 'test-scope',
};

beforeEach(() => {
  mockSetProviderAndWait.mockReset();
  mockOpenFeatureProvider.mockClear();
  mockSetProviderAndWait.mockResolvedValue(undefined);
});

describe('FlareProvider', () => {
  it('renders children after initialization', async () => {
    render(
      <FlareProvider config={config}>
        <div>hello world</div>
      </FlareProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('hello world')).toBeInTheDocument();
    });
  });

  it('shows loadingComponent while initializing', async () => {
    let resolveInit!: () => void;
    mockSetProviderAndWait.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveInit = resolve;
      }),
    );

    render(
      <FlareProvider config={config} loadingComponent={<div>loading...</div>}>
        <div>hello world</div>
      </FlareProvider>,
    );

    expect(screen.getByText('loading...')).toBeInTheDocument();
    expect(screen.queryByText('hello world')).not.toBeInTheDocument();

    resolveInit();

    await waitFor(() => {
      expect(screen.getByText('hello world')).toBeInTheDocument();
      expect(screen.queryByText('loading...')).not.toBeInTheDocument();
    });
  });

  it('renders nothing while initializing when no loadingComponent given', async () => {
    let resolveInit!: () => void;
    mockSetProviderAndWait.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveInit = resolve;
      }),
    );

    const { container } = render(
      <FlareProvider config={config}>
        <div>hello world</div>
      </FlareProvider>,
    );

    expect(container).toBeEmptyDOMElement();

    resolveInit();
    await waitFor(() => {
      expect(screen.getByText('hello world')).toBeInTheDocument();
    });
  });

  it('calls OpenFeature.setProviderAndWait on mount', async () => {
    render(
      <FlareProvider config={config}>
        <div>child</div>
      </FlareProvider>,
    );

    await waitFor(() => {
      expect(mockSetProviderAndWait).toHaveBeenCalledOnce();
    });

    const [provider] = mockSetProviderAndWait.mock.calls[0] as [{ config: FlareConfig }];
    expect(provider.config).toEqual(config);
  });

  it('re-initializes when config changes', async () => {
    const { rerender } = render(
      <FlareProvider config={config}>
        <div>child</div>
      </FlareProvider>,
    );

    await waitFor(() => expect(mockSetProviderAndWait).toHaveBeenCalledTimes(1));

    const newConfig: FlareConfig = { ...config, scope: 'new-scope' };
    rerender(
      <FlareProvider config={newConfig}>
        <div>child</div>
      </FlareProvider>,
    );

    await waitFor(() => expect(mockSetProviderAndWait).toHaveBeenCalledTimes(2));

    const [, secondCall] = mockSetProviderAndWait.mock.calls as [unknown, [{ config: FlareConfig }]];
    expect(secondCall[0].config).toEqual(newConfig);
  });
});
