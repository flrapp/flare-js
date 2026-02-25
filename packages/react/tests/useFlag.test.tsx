import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useFlag } from '../src/hooks/useFlag';

const mockUseBooleanFlagValue = vi.hoisted(() => vi.fn());

vi.mock('@openfeature/react-sdk', () => ({
  useBooleanFlagValue: mockUseBooleanFlagValue,
}));

beforeEach(() => {
  mockUseBooleanFlagValue.mockReset();
});

function FlagConsumer({ flagKey, defaultValue }: { flagKey: string; defaultValue: boolean }) {
  const value = useFlag(flagKey, defaultValue);
  return <div data-testid="flag-value">{String(value)}</div>;
}

describe('useFlag', () => {
  it('returns defaultValue when provider is not ready', () => {
    mockUseBooleanFlagValue.mockReturnValue(false);

    render(<FlagConsumer flagKey="my-flag" defaultValue={false} />);

    expect(screen.getByTestId('flag-value')).toHaveTextContent('false');
    expect(mockUseBooleanFlagValue).toHaveBeenCalledWith('my-flag', false);
  });

  it('returns true when flag is enabled', () => {
    mockUseBooleanFlagValue.mockReturnValue(true);

    render(<FlagConsumer flagKey="my-flag" defaultValue={false} />);

    expect(screen.getByTestId('flag-value')).toHaveTextContent('true');
  });

  it('returns false when flag is disabled', () => {
    mockUseBooleanFlagValue.mockReturnValue(false);

    render(<FlagConsumer flagKey="my-flag" defaultValue={true} />);

    expect(screen.getByTestId('flag-value')).toHaveTextContent('false');
  });

  it('passes flagKey and defaultValue to useBooleanFlagValue', () => {
    mockUseBooleanFlagValue.mockReturnValue(true);

    render(<FlagConsumer flagKey="feature-x" defaultValue={true} />);

    expect(mockUseBooleanFlagValue).toHaveBeenCalledWith('feature-x', true);
  });
});
