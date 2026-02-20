import { type ReactNode, useEffect, useState } from 'react';
import { type Provider, OpenFeature, OpenFeatureProvider } from '@openfeature/react-sdk';
import { FlareProvider as FlareOpenFeatureProvider } from '@flare/core';
import type { FlareConfig } from '@flare/core';

interface FlareProviderProps {
  config: FlareConfig;
  children: ReactNode;
  loadingComponent?: ReactNode;
}

export function FlareProvider({ config, children, loadingComponent }: FlareProviderProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    // FlareOpenFeatureProvider implements the server-side CommonProvider interface.
    // Cast to Provider for compatibility with the web SDK at the call site.
    OpenFeature.setProviderAndWait(new FlareOpenFeatureProvider(config) as unknown as Provider).then(() => {
      setReady(true);
    });
  }, [config]);

  if (!ready) {
    return loadingComponent ?? null;
  }

  return <OpenFeatureProvider>{children}</OpenFeatureProvider>;
}
