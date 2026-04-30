---
"@saenyakorn/hermes-ui": patch
---

## Features

- Refactored the messaging/model-provider workflow to use shared workspace field sources and integration form helpers, simplifying provider configuration flows in the UI.
- Improved messaging and model provider panels with updated interactions and supporting UI wiring across config/env/app tabs.

## Bug Fixes

- Fixed authorization fallback behavior for client API calls in environments where browser Basic auth is not reliably re-sent, preventing failed config/env/model-provider/messaging writes.
- Improved gateway process reliability by updating spawn behavior so the gateway is less likely to exit unexpectedly when browser sessions disconnect.
