@echo off
chcp 65001 >nul
title MathFlow
cd /d "%~dp0"

echo.
echo   MathFlow - Markdown 为主、LaTeX 为辅的本地学术写作台
echo   ------------------------------------------------
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [X] 没有找到 Node.js。
  echo       请先安装 Node 18 或更高版本： https://nodejs.org
  echo       安装完重新双击本文件即可。
  echo.
  pause
  exit /b 1
)

if not exist "dist\index.html" (
  echo   [i] 还没有构建前端，正在构建（首次约 10 秒）...
  call npm install --no-audit --no-fund
  call npm run build
)

rem 首次运行：生成示例工作区（已有文档则跳过，绝不覆盖）
if not exist "workspace\00-welcome.md" (
  echo   [i] 首次运行，创建示例工作区 workspace\ ...
  node bin\mathflow.mjs init workspace
)

echo   [i] 正在启动服务，浏览器会自动打开。关掉这个窗口即停止。
echo.

node bin\mathflow.mjs workspace

echo.
echo   MathFlow 已退出。直接关闭窗口即可。
pause
