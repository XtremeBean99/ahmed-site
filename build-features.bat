@echo off
title DeepSeek agents - Breakout + Hussain pages
cd /d "%~dp0"
if "%DEEPSEEK_API_KEY%"=="" (
    set /p DEEPSEEK_API_KEY=Paste your DeepSeek API key ^(sk-...^) and press Enter:
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-feature-agents.ps1"
echo.
pause
