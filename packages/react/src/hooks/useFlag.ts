import { useBooleanFlagValue } from '@openfeature/react-sdk';

export function useFlag(flagKey: string, defaultValue: boolean): boolean {
  return useBooleanFlagValue(flagKey, defaultValue);
}
