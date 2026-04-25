import { createContext, useContext } from 'react';
import type { FlareClient } from '@flrapp/core';

export const FlareClientContext = createContext<FlareClient | null>(null);

export function useFlareClient(): FlareClient {
  const client = useContext(FlareClientContext);
  if (!client) {
    throw new Error('useFlareClient must be used within a FlareProvider');
  }
  return client;
}
