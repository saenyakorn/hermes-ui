type GatewayStatus = {
  state: string;
  health: string;
  pid: number | null;
  cwd: string;
  startedAt: string | null;
  uptimeMs: number | null;
  exitCode: number | null;
  lastError: string | null;
  logWarning: string | null;
};

type LogTail = {
  lines: string[];
  warning: string | null;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(new URL(url, window.location.origin), init);

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T>;
}

function renderStatus(status: GatewayStatus): void {
  const target = document.querySelector<HTMLElement>("#gateway-status");
  if (!target) {
    return;
  }

  target.dataset.state = status.state;
  target.replaceChildren(
    createStatusRow("State", status.state),
    createStatusRow("Health", status.health),
    createStatusRow("PID", status.pid?.toString() ?? "-"),
    createStatusRow("CWD", status.cwd),
    createStatusRow("Last error", status.lastError ?? "-"),
  );
}

function createStatusRow(label: string, value: string): HTMLDivElement {
  const row = document.createElement("div");
  const text = document.createTextNode(`${label}: `);
  const valueElement = document.createElement("span");
  valueElement.className = "text-white";
  valueElement.textContent = value;
  row.append(text, valueElement);
  return row;
}

async function refreshStatus(): Promise<void> {
  const status = await fetchJson<GatewayStatus>("/gateway/status");
  renderStatus(status);
}

async function refreshLogs(): Promise<void> {
  const logs = await fetchJson<LogTail>("/logs/tail");
  const target = document.querySelector<HTMLElement>("#log-tail");
  if (!target) {
    return;
  }

  target.textContent = logs.lines.join("\n");
}

function bindActions(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.action;
      if (!action) {
        return;
      }

      button.disabled = true;
      try {
        const status = await fetchJson<GatewayStatus>(`/gateway/${action}`, { method: "POST" });
        renderStatus(status);
        await refreshLogs();
      } finally {
        button.disabled = false;
      }
    });
  });
}

function bindLogStream(): void {
  const source = new EventSource(new URL("/logs/stream", window.location.origin));
  source.addEventListener("message", () => {
    void refreshLogs();
  });
}

bindActions();
void refreshStatus();
void refreshLogs();
bindLogStream();
setInterval(() => {
  void refreshStatus();
}, 3000);
