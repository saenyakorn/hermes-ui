# @saenyakorn/hermes-ui

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
