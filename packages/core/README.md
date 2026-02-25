# @flrapp/core

OpenFeature-compatible provider for [Flare](https://github.com/flrapp) feature flag management.

## Installation

```bash
npm install @flrapp/core @openfeature/core
```

## Usage

```typescript
import { OpenFeature } from '@openfeature/web-sdk';
import { FlareProvider } from '@flrapp/core';

await OpenFeature.setProviderAndWait(new FlareProvider({
  baseUrl: 'http://localhost:5001',
  apiKey: 'your-api-key',
  scope: 'production',
}));

const client = OpenFeature.getClient();
const isEnabled = await client.getBooleanValue('my-feature', false);
```

## Configuration

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `baseUrl` | `string` | ✅ | Flare API base URL |
| `apiKey` | `string` | ✅ | Project API key |
| `scope` | `string` | ✅ | Scope alias (e.g. `production`, `dev`) |
| `timeout` | `number` | ❌ | Request timeout in ms |
| `pollingIntervalMs` | `number` | ❌ | Cache refresh interval in ms |

## How it works

On initialization the provider fetches all flags at once and caches them in memory. Subsequent evaluations read from cache without HTTP requests. Cache is refreshed when context changes or on polling interval if configured.
