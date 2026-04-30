---
"@saenyakorn/hermes-ui": patch
---

Bootstrap the authenticated Basic token from the initial HTML response into `window.__HERMES_AUTHORIZATION__`, and have `ApiFetcher` fall back to it when the page URL does not embed credentials. This keeps POST requests (config save, env mutations, model-provider settings, messaging-related writes) authorized in environments where fetch does not reliably resend browser Basic auth.

Spawn the Hermes gateway with `detached: true` and stdin ignored (`stdio: ["ignore", "pipe", "pipe"]`) so the child is not tied to a piped stdin / session that can close when the browser disconnects, reducing unintended gateway exits after closing the web UI.
