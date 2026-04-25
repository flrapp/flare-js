import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FlareClientContext } from '../src/context/FlareClientContext';
import { useBooleanFlag } from '../src/hooks/useBooleanFlag';
import { useStringFlag } from '../src/hooks/useStringFlag';
import { useNumberFlag } from '../src/hooks/useNumberFlag';
import { useObjectFlag } from '../src/hooks/useObjectFlag';
import type { FlareClient, EvaluationContext, EvaluationResult } from '@flrapp/core';

// ---------------------------------------------------------------------------
// Mock client factory
// ---------------------------------------------------------------------------
function makeClient(overrides: Partial<FlareClient> = {}): FlareClient {
  return {
    getBooleanValue: vi.fn(),
    getStringValue: vi.fn(),
    getNumberValue: vi.fn(),
    getObjectValue: vi.fn(),
    evaluateAll: vi.fn(),
    setContext: vi.fn(),
    getContext: vi.fn(),
    ...overrides,
  } as unknown as FlareClient;
}

function withClient(client: FlareClient, children: ReactNode) {
  return (
    <FlareClientContext.Provider value={client}>
      {children}
    </FlareClientContext.Provider>
  );
}

const ctx: EvaluationContext = {
  scope: 'test-scope',
  targetingKey: 'user-123',
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// useBooleanFlag
// ---------------------------------------------------------------------------
describe('useBooleanFlag', () => {
  function BoolConsumer({
    flagKey,
    defaultValue,
    context,
  }: {
    flagKey: string;
    defaultValue: boolean;
    context?: EvaluationContext;
  }) {
    const { value, reason, variant, isLoading, isError } = useBooleanFlag(flagKey, defaultValue, context);
    return (
      <div>
        <span data-testid="value">{String(value)}</span>
        <span data-testid="reason">{reason}</span>
        <span data-testid="variant">{String(variant)}</span>
        <span data-testid="isLoading">{String(isLoading)}</span>
        <span data-testid="isError">{String(isError)}</span>
      </div>
    );
  }

  it('shows defaultValue while loading', () => {
    const client = makeClient({
      getBooleanValue: vi.fn(() => new Promise(() => {})),
    });

    render(withClient(client, <BoolConsumer flagKey="f" defaultValue={true} />));

    expect(screen.getByTestId('value')).toHaveTextContent('true');
    expect(screen.getByTestId('isLoading')).toHaveTextContent('true');
  });

  it('resolves to server value after fetch', async () => {
    const result: EvaluationResult<boolean> = {
      flagKey: 'f',
      value: false,
      reason: 'TARGETING_MATCH',
      variant: 'off',
    };
    const client = makeClient({
      getBooleanValue: vi.fn().mockResolvedValue(result),
    });

    render(withClient(client, <BoolConsumer flagKey="f" defaultValue={true} />));

    await waitFor(() => {
      expect(screen.getByTestId('value')).toHaveTextContent('false');
      expect(screen.getByTestId('reason')).toHaveTextContent('TARGETING_MATCH');
      expect(screen.getByTestId('variant')).toHaveTextContent('off');
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
      expect(screen.getByTestId('isError')).toHaveTextContent('false');
    });
  });

  it('sets isError=true when reason is ERROR', async () => {
    const result: EvaluationResult<boolean> = {
      flagKey: 'f',
      value: true,
      reason: 'ERROR',
      variant: null,
    };
    const client = makeClient({
      getBooleanValue: vi.fn().mockResolvedValue(result),
    });

    render(withClient(client, <BoolConsumer flagKey="f" defaultValue={true} />));

    await waitFor(() => {
      expect(screen.getByTestId('isError')).toHaveTextContent('true');
    });
  });

  it('passes context to client', async () => {
    const getBooleanValue = vi.fn().mockResolvedValue({
      flagKey: 'f',
      value: false,
      reason: 'STATIC',
      variant: null,
    });
    const client = makeClient({ getBooleanValue });

    render(withClient(client, <BoolConsumer flagKey="f" defaultValue={true} context={ctx} />));

    await waitFor(() => {
      expect(getBooleanValue).toHaveBeenCalledWith('f', true, ctx);
    });
  });

  it('uses client default context when no per-hook context given', async () => {
    const getBooleanValue = vi.fn().mockResolvedValue({
      flagKey: 'f',
      value: true,
      reason: 'STATIC',
      variant: null,
    });
    const client = makeClient({ getBooleanValue });

    render(withClient(client, <BoolConsumer flagKey="f" defaultValue={false} />));

    await waitFor(() => {
      expect(getBooleanValue).toHaveBeenCalledWith('f', false, undefined);
    });
  });

  it('returns defaultValue with TYPE_MISMATCH when type mismatches', async () => {
    const result: EvaluationResult<boolean> = {
      flagKey: 'f',
      value: false,
      reason: 'TYPE_MISMATCH',
      variant: null,
    };
    const client = makeClient({
      getBooleanValue: vi.fn().mockResolvedValue(result),
    });

    render(withClient(client, <BoolConsumer flagKey="f" defaultValue={false} />));

    await waitFor(() => {
      expect(screen.getByTestId('reason')).toHaveTextContent('TYPE_MISMATCH');
      expect(screen.getByTestId('value')).toHaveTextContent('false');
    });
  });
});

// ---------------------------------------------------------------------------
// useStringFlag
// ---------------------------------------------------------------------------
describe('useStringFlag', () => {
  function StringConsumer({ flagKey, defaultValue }: { flagKey: string; defaultValue: string }) {
    const { value, reason, isLoading } = useStringFlag(flagKey, defaultValue, ctx);
    return (
      <div>
        <span data-testid="value">{value}</span>
        <span data-testid="reason">{reason}</span>
        <span data-testid="isLoading">{String(isLoading)}</span>
      </div>
    );
  }

  it('resolves to string value', async () => {
    const client = makeClient({
      getStringValue: vi.fn().mockResolvedValue({
        flagKey: 's',
        value: 'blue',
        reason: 'STATIC',
        variant: 'blue',
      }),
    });

    render(withClient(client, <StringConsumer flagKey="s" defaultValue="red" />));

    await waitFor(() => {
      expect(screen.getByTestId('value')).toHaveTextContent('blue');
      expect(screen.getByTestId('reason')).toHaveTextContent('STATIC');
    });
  });

  it('returns defaultValue with TYPE_MISMATCH on mismatch', async () => {
    const client = makeClient({
      getStringValue: vi.fn().mockResolvedValue({
        flagKey: 's',
        value: 'red',
        reason: 'TYPE_MISMATCH',
        variant: null,
      }),
    });

    render(withClient(client, <StringConsumer flagKey="s" defaultValue="red" />));

    await waitFor(() => {
      expect(screen.getByTestId('reason')).toHaveTextContent('TYPE_MISMATCH');
      expect(screen.getByTestId('value')).toHaveTextContent('red');
    });
  });
});

// ---------------------------------------------------------------------------
// useNumberFlag
// ---------------------------------------------------------------------------
describe('useNumberFlag', () => {
  function NumberConsumer({ flagKey, defaultValue }: { flagKey: string; defaultValue: number }) {
    const { value, reason } = useNumberFlag(flagKey, defaultValue, ctx);
    return (
      <div>
        <span data-testid="value">{value}</span>
        <span data-testid="reason">{reason}</span>
      </div>
    );
  }

  it('resolves to number value', async () => {
    const client = makeClient({
      getNumberValue: vi.fn().mockResolvedValue({
        flagKey: 'n',
        value: 42,
        reason: 'STATIC',
        variant: null,
      }),
    });

    render(withClient(client, <NumberConsumer flagKey="n" defaultValue={0} />));

    await waitFor(() => {
      expect(screen.getByTestId('value')).toHaveTextContent('42');
    });
  });

  it('returns defaultValue with ERROR on network failure', async () => {
    const client = makeClient({
      getNumberValue: vi.fn().mockResolvedValue({
        flagKey: 'n',
        value: 0,
        reason: 'ERROR',
        variant: null,
      }),
    });

    render(withClient(client, <NumberConsumer flagKey="n" defaultValue={0} />));

    await waitFor(() => {
      expect(screen.getByTestId('reason')).toHaveTextContent('ERROR');
    });
  });
});

// ---------------------------------------------------------------------------
// useObjectFlag
// ---------------------------------------------------------------------------
describe('useObjectFlag', () => {
  interface FlagPayload {
    threshold: number;
    label: string;
  }

  function ObjConsumer({
    flagKey,
    defaultValue,
  }: {
    flagKey: string;
    defaultValue: FlagPayload;
  }) {
    const { value, reason } = useObjectFlag<FlagPayload>(flagKey, defaultValue, ctx);
    return (
      <div>
        <span data-testid="threshold">{value.threshold}</span>
        <span data-testid="label">{value.label}</span>
        <span data-testid="reason">{reason}</span>
      </div>
    );
  }

  it('resolves to object value', async () => {
    const payload: FlagPayload = { threshold: 0.8, label: 'high' };
    const client = makeClient({
      getObjectValue: vi.fn().mockResolvedValue({
        flagKey: 'o',
        value: payload,
        reason: 'TARGETING_MATCH',
        variant: null,
      }),
    });

    render(withClient(client, <ObjConsumer flagKey="o" defaultValue={{ threshold: 0, label: 'low' }} />));

    await waitFor(() => {
      expect(screen.getByTestId('threshold')).toHaveTextContent('0.8');
      expect(screen.getByTestId('label')).toHaveTextContent('high');
      expect(screen.getByTestId('reason')).toHaveTextContent('TARGETING_MATCH');
    });
  });

  it('returns defaultValue with TYPE_MISMATCH on type mismatch', async () => {
    const defaultVal: FlagPayload = { threshold: 0, label: 'default' };
    const client = makeClient({
      getObjectValue: vi.fn().mockResolvedValue({
        flagKey: 'o',
        value: defaultVal,
        reason: 'TYPE_MISMATCH',
        variant: null,
      }),
    });

    render(withClient(client, <ObjConsumer flagKey="o" defaultValue={defaultVal} />));

    await waitFor(() => {
      expect(screen.getByTestId('reason')).toHaveTextContent('TYPE_MISMATCH');
      expect(screen.getByTestId('label')).toHaveTextContent('default');
    });
  });
});

// ---------------------------------------------------------------------------
// setContext override per hook
// ---------------------------------------------------------------------------
describe('setContext default overridden by per-hook context', () => {
  it('uses per-hook context when provided, ignoring client default', async () => {
    const getBooleanValue = vi.fn().mockResolvedValue({
      flagKey: 'f',
      value: true,
      reason: 'STATIC',
      variant: null,
    });
    const getContext = vi.fn().mockReturnValue({
      scope: 'default-scope',
      targetingKey: 'default-user',
    });
    const client = makeClient({ getBooleanValue, getContext });

    const perHookCtx: EvaluationContext = { scope: 'override-scope', targetingKey: 'override-user' };

    function TestHook() {
      const { value } = useBooleanFlag('f', false, perHookCtx);
      return <span data-testid="v">{String(value)}</span>;
    }

    render(withClient(client, <TestHook />));

    await waitFor(() => {
      expect(getBooleanValue).toHaveBeenCalledWith('f', false, perHookCtx);
    });
  });
});
