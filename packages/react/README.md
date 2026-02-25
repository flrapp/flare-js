# @flrapp/react

React SDK for [Flare](https://github.com/flrapp) feature flag management.

## Installation

```bash
npm install @flrapp/react @flrapp/core
```

## Setup

Wrap your app with `FlareProvider`:

```tsx
import { FlareProvider } from '@flrapp/react';

function App() {
  return (
    <FlareProvider
      config={{
        baseUrl: 'http://localhost:5001',
        apiKey: 'your-api-key',
        scope: 'production',
      }}
    >
      {/* your app */}
    </FlareProvider>
  );
}
```

## Hooks

### `useFlag`

```tsx
import { useFlag } from '@flrapp/react';

function MyComponent() {
  const isEnabled = useFlag('my-feature', false);

  return <div>{isEnabled ? 'Feature enabled' : 'Feature disabled'}</div>;
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

## Props

### `FlareProvider`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `config` | `FlareConfig` | ✅ | Flare configuration |
| `children` | `ReactNode` | ✅ | Child components |
| `loadingComponent` | `ReactNode` | ❌ | Shown while provider initializes |
