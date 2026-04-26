import type { ReactNode } from "react";

export function Layout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <link rel="stylesheet" href="/assets/app.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm/css/xterm.css" />
      </head>
      <body>
        {children}
        <script type="module" src="/assets/workspace.js" />
        <script type="module" src="/assets/main.js" />
      </body>
    </html>
  );
}
