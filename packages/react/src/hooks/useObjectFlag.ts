import { useState, useEffect, useMemo } from 'react';
import type { EvaluationContext, EvaluationResult } from '@flrapp/core';
import { useFlareClient } from '../context/FlareClientContext';

interface ObjectFlagState<T> {
  value: T;
  reason: EvaluationResult<T>['reason'];
  variant: string | null;
  isLoading: boolean;
  isError: boolean;
}

export function useObjectFlag<T>(
  flagKey: string,
  defaultValue: T,
  context?: EvaluationContext,
): ObjectFlagState<T> {
  const client = useFlareClient();

  const stableContext = useMemo(
    () => context,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(context)],
  );

  // Stabilize object defaultValue to avoid re-triggering the effect on every render
  // (object identity changes each render even if the contents are the same)
  const stableDefault = useMemo(
    () => defaultValue,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(defaultValue)],
  );

  const [state, setState] = useState<ObjectFlagState<T>>({
    value: stableDefault,
    reason: 'DEFAULT',
    variant: null,
    isLoading: true,
    isError: false,
  });

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, isLoading: true }));
    client.getObjectValue<T>(flagKey, stableDefault, stableContext).then((result) => {
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
  }, [client, flagKey, stableDefault, stableContext]);

  return state;
}
