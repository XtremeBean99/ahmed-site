# Launches Claude Code backed by DeepSeek to build the Breakout and Hussain
# pages defined in agent-tasks/. Run from the repo root.
#   $env:DEEPSEEK_API_KEY = "sk-..."
#   .\run-feature-agents.ps1            # interactive
#   .\run-feature-agents.ps1 -Headless  # unattended
param([switch]$Headless)
$ErrorActionPreference = "Stop"
if (-not $env:DEEPSEEK_API_KEY) { Write-Error "Set DEEPSEEK_API_KEY first: `$env:DEEPSEEK_API_KEY = 'sk-...'" }
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    npm install -g @anthropic-ai/claude-code
    if ($LASTEXITCODE -ne 0) { Write-Error "Claude Code install failed." }
}
$env:ANTHROPIC_BASE_URL = "https://api.deepseek.com/anthropic"
$env:ANTHROPIC_AUTH_TOKEN = $env:DEEPSEEK_API_KEY
$env:ANTHROPIC_MODEL = "deepseek-v4-pro[1m]"
$env:ANTHROPIC_DEFAULT_OPUS_MODEL = "deepseek-v4-pro[1m]"
$env:ANTHROPIC_DEFAULT_SONNET_MODEL = "deepseek-v4-pro[1m]"
$env:ANTHROPIC_DEFAULT_HAIKU_MODEL = "deepseek-v4-flash"
$env:CLAUDE_CODE_SUBAGENT_MODEL = "deepseek-v4-flash"
$env:ANTHROPIC_API_KEY = ""
Set-Location $PSScriptRoot
$Kickoff = Get-Content -Raw (Join-Path $PSScriptRoot "agent-tasks\KICKOFF.md")
if ($Headless) { claude -p $Kickoff --permission-mode acceptEdits --verbose } else { claude $Kickoff }
