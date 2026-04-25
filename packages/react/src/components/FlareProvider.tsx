import { useEffect, useState, useMemo } from 'react';
import { OpenFeature, OpenFeatureProvider } from '@openfeature/react-sdk';
import { FlareProvider as FlareOpenFeatureProvider, FlareClient } from '@flrapp/core';
import type { FlareConfig } from '@flrapp/core';
import { FlareClientContext } from '../context/FlareClientContext';

interface FlareProviderProps {
  config: FlareConfig;
  children: React.ReactNode;
  loadingComponent?: React.ReactNode;
}

export function FlareProvider({ config, children, loadingComponent }: FlareProviderProps) {
  const [ready, setReady] = useState(false);

  const client = useMemo(() => new FlareClient(config), [config]);

  useEffect(() => {
    setReady(false);
    const provider = new FlareOpenFeatureProvider(config);
    OpenFeature.setProviderAndWait(provider).then(() => {
      setReady(true);
    });
  }, [config]);

  if (!ready) {
    return loadingComponent ?? null;
  }

  return (
    <FlareClientContext.Provider value={client}>
      <OpenFeatureProvider>{children}</OpenFeatureProvider>
    </FlareClientContext.Provider>
  );
}
