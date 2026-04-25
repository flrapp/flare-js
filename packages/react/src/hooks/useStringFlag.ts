import { useState, useEffect, useMemo } from 'react';
import type { EvaluationContext, EvaluationResult } from '@flrapp/core';
import { useFlareClient } from '../context/FlareClientContext';

interface StringFlagState {
  value: string;
  reason: EvaluationResult<string>['reason'];
  variant: string | null;
  isLoading: boolean;
  isError: boolean;
}

export function useStringFlag(
  flagKey: string,
  defaultValue: string,
  context?: EvaluationContext,
): StringFlagState {
  const client = useFlareClient();

  const stableContext = useMemo(
    () => context,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(context)],
  );

  const [state, setState] = useState<StringFlagState>({
    value: defaultValue,
    reason: 'DEFAULT',
    variant: null,
    isLoading: true,
    isError: false,
  });

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, isLoading: true }));
    client.getStringValue(flagKey, defaultValue, stableContext).then((result) => {
      if (!cancelled) {
        setState({
          value: result.value,
          reason: result.reason,
          variant: result.variant,
          isLoading: false,
          isError: result.reason === 'ERROR',
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [client, flagKey, defaultValue, stableContext]);

  return state;
}
