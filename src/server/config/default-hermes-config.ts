/** Default contents for `config.yaml` when the file is first created. */
export const DEFAULT_HERMES_CONFIG_YAML = `# ~/.hermes/config.yaml

model:
  # Default model Hermes uses.
  default: "anthropic/claude-opus-4.6"

  # Model provider routing.
  provider: "auto"

  # Optional OpenAI-compatible endpoint.
  # base_url: "https://openrouter.ai/api/v1"

  # Optional API key; prefer ~/.hermes/.env.
  # api_key: "\${OPENROUTER_API_KEY}"

  # Optional context window override.
  # context_length: 131072

  # Optional output token cap.
  # max_tokens: 8192

providers:
  openrouter:
    # Request timeout in seconds.
    request_timeout_seconds: 1800

    # Stale non-streaming call timeout.
    stale_timeout_seconds: 300

provider_routing:
  # OpenRouter sort strategy: price, throughput, latency.
  sort: "throughput"

  # Optional allowlist.
  # only: ["anthropic"]

  # Optional blocklist.
  # ignore: ["fireworks"]

  # Optional provider order.
  # order: ["anthropic", "google"]

  # Require providers to support all params.
  require_parameters: false

  # Data collection policy: allow or deny.
  data_collection: "allow"

terminal:
  # Execution backend: local, docker, ssh, modal, daytona, singularity.
  backend: "local"

  # Working directory.
  cwd: "."

  # Command timeout in seconds.
  timeout: 180

  # Keep shell state between commands.
  persistent_shell: false

  # Docker image if backend is docker.
  docker_image: "nikolaik/python-nodejs:python3.11-nodejs20"

  # Optional SSH settings.
  # ssh_host: "server.example.com"
  # ssh_user: "ubuntu"
  # ssh_port: 22
  # ssh_key: "~/.ssh/id_rsa"

security:
  # Enable Tirith command scanner.
  tirith_enabled: false

  # Tirith binary path.
  tirith_path: "tirith"

  # Allow commands if Tirith fails.
  tirith_fail_open: true

approvals:
  # Command approval mode: manual, smart, off.
  mode: "manual"

browser:
  # Close idle browser after seconds.
  inactivity_timeout: 120

  # Browser command timeout.
  command_timeout: 30

  # Optional Chrome DevTools URL.
  # cdp_url: ""

compression:
  # Enable context compression.
  enabled: true

  # Compress when this fraction of context is used.
  threshold: 0.50

  # Keep this fraction as recent tail.
  target_ratio: 0.20

  # Preserve last N messages.
  protect_last_n: 20

context:
  # Context engine.
  engine: "compressor"

prompt_caching:
  # Anthropic cache TTL.
  cache_ttl: "5m"

auxiliary:
  vision:
    # Provider for image/screenshot understanding.
    provider: "auto"

    # Optional model override.
    # model: ""

    # Timeout in seconds.
    timeout: 120

  web_extract:
    # Provider for web extraction.
    provider: "auto"

    # Optional model override.
    # model: ""

    # Timeout in seconds.
    timeout: 360

  approval:
    # Provider for smart approvals.
    provider: "auto"

    # Timeout in seconds.
    timeout: 30

  compression:
    # Provider for compression summaries.
    provider: "auto"

    # Model for compression.
    model: "google/gemini-3-flash-preview"

    # Timeout in seconds.
    timeout: 120

fallback_model:
  # Enable fallback model.
  enabled: false

  # Optional fallback provider/model.
  # provider: "auto"
  # model: ""

memory:
  # Enable persistent memory.
  memory_enabled: true

  # Enable user profile memory.
  user_profile_enabled: true

  # MEMORY.md character limit.
  memory_char_limit: 2200

  # USER.md character limit.
  user_char_limit: 1375

file_read_max_chars: 100000

tool_output:
  # Max terminal output characters.
  max_bytes: 50000

  # Max file-read lines.
  max_lines: 2000

  # Max characters per displayed line.
  max_line_length: 2000

session_reset:
  # Reset mode: both, idle, daily, none.
  mode: "both"

  # Idle reset after minutes.
  idle_minutes: 1440

  # Daily reset hour.
  at_hour: 4

streaming:
  # Enable platform token streaming.
  enabled: false

  # Streaming transport.
  transport: "edit"

  # Edit interval in seconds.
  edit_interval: 0.3

agent:
  # Max tool-call turns.
  max_turns: 90

  # Gateway timeout in seconds.
  gateway_timeout: 1800

  # API retries.
  api_max_retries: 3

  # Verbose logs.
  verbose: false

  # Reasoning effort.
  reasoning_effort: "medium"

platform_toolsets:
  # CLI tools.
  cli: ["hermes-cli"]

  # Telegram tools.
  telegram: ["hermes-telegram"]

  # Discord tools.
  discord: ["hermes-discord"]

  # Slack tools.
  slack: ["hermes-slack"]

mcp_servers:
  # Optional stdio MCP server.
  # time:
  #   command: "uvx"
  #   args: ["mcp-server-time"]

  # Optional HTTP MCP server.
  # notion:
  #   url: "https://mcp.notion.com/mcp"
  #   headers: {}

stt:
  # Enable speech-to-text.
  enabled: true

  # Optional provider: local, groq, openai, mistral.
  # provider: "local"

  local:
    # Local Whisper model size.
    model: "base"

    # Optional language; empty means auto-detect.
    # language: ""

tts:
  # TTS provider.
  provider: "edge"

  # Speech speed.
  speed: 1.0

  edge:
    # Edge TTS voice.
    voice: "en-US-AriaNeural"

web:
  # Web backend: firecrawl, parallel, tavily, exa.
  backend: "firecrawl"

delegation:
  # Max child-agent iterations.
  max_iterations: 50

  # Max parallel child agents.
  max_concurrent_children: 3

  # Max delegation depth.
  max_spawn_depth: 1

  # Allow orchestrator subagents.
  orchestrator_enabled: true

clarify:
  # Clarification wait timeout.
  timeout: 120

display:
  # Compact UI.
  compact: false

  # Tool progress: off, new, all, verbose.
  tool_progress: "all"

  # Show mid-turn assistant updates.
  interim_assistant_messages: true

  # Busy behavior: interrupt or queue.
  busy_input_mode: "interrupt"

  # Show reasoning in UI.
  show_reasoning: false

  # Stream in terminal.
  streaming: true

  # CLI skin.
  skin: "default"

privacy:
  # Redact supported platform PII.
  redact_pii: false

checkpoints:
  # Enable file-operation checkpoints.
  enabled: true

  # Max snapshots.
  max_snapshots: 50

# Local timezone.
timezone: "Asia/Bangkok"

context_files:
  # Load project context files.
  enabled: true

  # Max context-file chars.
  max_chars: 20000

hooks:
  # Optional pre-tool hook.
  # pre_tool_call:
  #   - matcher: "terminal"
  #     command: "~/.hermes/agent-hooks/block-rm-rf.sh"

  # Optional post-tool hook.
  # post_tool_call:
  #   - matcher: "write_file|patch"
  #     command: "~/.hermes/agent-hooks/auto-format.sh"

# Auto-accept hook consent.
hooks_auto_accept: false
`;
