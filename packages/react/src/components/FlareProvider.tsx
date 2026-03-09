import { OpenFeatureProvider } from '@openfeature/react-sdk';

interface FlareProviderProps {
  children: React.ReactNode;
}

export function FlareProvider({ children }: FlareProviderProps) {
  return <OpenFeatureProvider>{children}</OpenFeatureProvider>;
}
