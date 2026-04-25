export { FlareProvider } from './components/FlareProvider';
export { FlareProvider as FlareOpenFeatureProvider } from '@flrapp/core';
export { useFlag } from './hooks/useFlag';
export { useClient } from './hooks/useClient';
export { useBooleanFlag } from './hooks/useBooleanFlag';
export { useStringFlag } from './hooks/useStringFlag';
export { useNumberFlag } from './hooks/useNumberFlag';
export { useObjectFlag } from './hooks/useObjectFlag';
export { useFlareClient } from './context/FlareClientContext';
export type {
  FlareConfig,
  EvaluationContext,
  EvaluationResult,
  EvaluationReason,
  FlagType,
} from '@flrapp/core';
