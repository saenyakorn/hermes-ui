# @saenyakorn/hermes-ui

## 1.0.1

### Patch Changes

- [#9](https://github.com/saenyakorn/hermes-ui/pull/9) [`66cc16e`](https://github.com/saenyakorn/hermes-ui/commit/66cc16e1e7d770088f1ffabc269739b2520eb73c) Thanks [@saenyakorn](https://github.com/saenyakorn)! - Bootstrap the authenticated Basic token from the initial HTML response into `window.__HERMES_AUTHORIZATION__`, and have `ApiFetcher` fall back to it when the page URL does not embed credentials. This keeps POST requests (config save, env mutations, model-provider settings, messaging-related writes) authorized in environments where fetch does not reliably resend browser Basic auth.

  Spawn the Hermes gateway with `detached: true` and stdin ignored (`stdio: ["ignore", "pipe", "pipe"]`) so the child is not tied to a piped stdin / session that can close when the browser disconnects, reducing unintended gateway exits after closing the web UI.

- [#9](https://github.com/saenyakorn/hermes-ui/pull/9) [`c31f564`](https://github.com/saenyakorn/hermes-ui/commit/c31f564b9e298ef7253bdb545404681777b574f0) Thanks [@saenyakorn](https://github.com/saenyakorn)! - Add rg cli to Docker image

- [#11](https://github.com/saenyakorn/hermes-ui/pull/11) [`ba50eb9`](https://github.com/saenyakorn/hermes-ui/commit/ba50eb97bf1508f6cf46f9a9f7ec7c19b6c6ff25) Thanks [@saenyakorn](https://github.com/saenyakorn)! - ## Features

  - Refactored the messaging/model-provider workflow to use shared workspace field sources and integration form helpers, simplifying provider configuration flows in the UI.
  - Improved messaging and model provider panels with updated interactions and supporting UI wiring across config/env/app tabs.

  ## Bug Fixes

  - Fixed authorization fallback behavior for client API calls in environments where browser Basic auth is not reliably re-sent, preventing failed config/env/model-provider/messaging writes.
  - Improved gateway process reliability by updating spawn behavior so the gateway is less likely to exit unexpectedly when browser sessions disconnect.

## 1.0.0

### Major Changes

- [`7d3d485`](https://github.com/saenyakorn/hermes-ui/commit/7d3d485ce290d2b4d8c4d2ad588968b6b3c84aca) Thanks [@saenyakorn](https://github.com/saenyakorn)! - ## Release Notes

  This major release brings a redesigned workspace experience with stronger profile management, cleaner editing workflows, and more resilient runtime controls across the Hermes UI.

  ## Features by Tab

  ### Workspace Header

  - Added workspace profile context and a dedicated profile dialog for clearer profile selection and switching.
  - Improved tab header behavior for smoother cross-tab navigation and state awareness.

  ### Profiles Tab

  - Refined profile management flows and UI interactions for faster profile-focused operations.
  - Improved profile-related state handling for better consistency across workspace views.

  ### Sessions Tab

  - Enhanced session listing and interaction behavior for more predictable session control.
  - Improved session hook/state updates to better reflect live runtime changes.

  ### Config Tab

  - Improved configuration editing UX and structure for clearer configuration workflows.
  - Upgraded editor integration to make config updates more reliable and easier to validate.

  ### Env Tab

  - Improved environment variable editing and persistence behavior.
  - Strengthened server-side env store handling for safer, more stable runtime updates.

  ### Control Tab

  - Refined gateway control interactions and status feedback for better operational visibility.
  - Improved control-related state synchronization with live gateway status/events.

  ### Shell Tab

  - Improved shell tab interaction consistency with the updated workspace tab system.
  - Better alignment with shared runtime status/signaling behavior used across tabs.

  ### Shared Components and Platform

  - Upgraded shared editor and button components (including Markdown and YAML editors) for a cleaner authoring experience.
  - Improved API fetcher behavior and route test coverage to reduce regressions in critical workflows.
