import { useOpenFeatureClient } from '@openfeature/react-sdk';
import type { Client } from '@openfeature/react-sdk';

export function useClient(): Client {
  return useOpenFeatureClient();
}
