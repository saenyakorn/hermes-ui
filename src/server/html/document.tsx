export function renderHtmlDocument(
  title: string,
  initialPayload: string,
  authToken?: string,
): string {
  const decodedPayload = decodeURIComponent(initialPayload);
  const decodedAuthToken = authToken ? decodeURIComponent(authToken) : undefined;
  const authBootstrapScript =
    decodedAuthToken !== undefined
      ? `window.__HERMES_AUTHORIZATION__ = ${JSON.stringify(decodedAuthToken)};`
      : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="stylesheet" href="/assets/app.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm/css/xterm.css" />
  </head>
  <body>
    <div id="root"></div>
    <script>window.__HERMES_INITIAL_GATEWAYS__ = ${decodedPayload};</script>
    <script>${authBootstrapScript}</script>
    <script type="module" src="/assets/main.js"></script>
  </body>
</html>`;
}
