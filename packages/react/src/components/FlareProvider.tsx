import { type ReactNode, useEffect, useRef, useState } from 'react';
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
  const providerRef = useRef<FlareOpenFeatureProvider | null>(null);

  if (!providerRef.current) {
    providerRef.current = new FlareOpenFeatureProvider(config);
  }

  useEffect(() => {
    setReady(false);
    OpenFeature.setProviderAndWait(providerRef.current as unknown as Provider).then(() => {
      setReady(true);
    });
  }, []);

  if (!ready) {
    return loadingComponent ?? null;
  }

  return <OpenFeatureProvider>{children}</OpenFeatureProvider>;
}
