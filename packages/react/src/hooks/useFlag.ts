import { useBooleanFlagDetails } from '@openfeature/react-sdk';
import type { EvaluationDetails } from '@openfeature/react-sdk';

export function useFlag(flagKey: string, defaultValue: boolean): EvaluationDetails<boolean> {
  return useBooleanFlagDetails(flagKey, defaultValue);
}
