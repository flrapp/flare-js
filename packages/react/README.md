# @flrapp/react

React SDK for [Flare](https://github.com/flrapp) feature flag management.

## Installation

```bash
npm install @flrapp/react @flrapp/core
```

## Setup

Register the provider **before** rendering, then wrap your app with `FlareProvider`:

```tsx
// main.tsx
import { OpenFeature } from '@openfeature/react-sdk';
import { FlareOpenFeatureProvider, FlareProvider } from '@flrapp/react';

const provider = new FlareOpenFeatureProvider({
  baseUrl: 'http://localhost:5001',
  apiKey: 'your-api-key',
  scope: 'production',
});

OpenFeature.setProvider(provider);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FlareProvider>
      <App />
    </FlareProvider>
  </StrictMode>
);
```

## Hooks

### `useFlag`

```tsx
import { useFlag } from '@flrapp/react';

function MyComponent() {
  const { value } = useFlag('my-feature', false);

  return <div>{value ? 'Feature enabled' : 'Feature disabled'}</div>;
}
```

### `useClient`

```tsx
import { useClient } from '@flrapp/react';

function MyComponent() {
  const client = useClient();

  async function evaluate() {
    const value = await client.getBooleanValue('my-feature', false);
  }
}
```
