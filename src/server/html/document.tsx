export function renderHtmlDocument(
  title: string,
  initialStatus: string,
): string {
  const decodedStatus = decodeURIComponent(initialStatus);
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
    <script>window.__HERMES_INITIAL_STATUS__ = ${decodedStatus};</script>
    <script type="module" src="/assets/main.js"></script>
  </body>
</html>`;
}
