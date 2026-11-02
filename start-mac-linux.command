#!/bin/sh
# MathFlow 启动器（macOS / Linux）：双击或在终端执行 ./start-mac-linux.command
cd "$(dirname "$0")" || exit 1

echo
echo "  MathFlow - Markdown 为主、LaTeX 为辅的本地学术写作台"
echo "  ------------------------------------------------"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "  [X] 没有找到 Node.js，请先安装 Node 18+：https://nodejs.org"
  echo
  read -r _
  exit 1
fi

if [ ! -f dist/index.html ]; then
  echo "  [i] 还没有构建前端，正在构建（首次约 10 秒）..."
  npm install --no-audit --no-fund && npm run build
fi

if [ ! -f workspace/00-welcome.md ]; then
  echo "  [i] 首次运行，创建示例工作区 workspace/ ..."
  node bin/mathflow.mjs init workspace
fi

echo "  [i] 正在启动服务，浏览器会自动打开。Ctrl+C 停止。"
echo

exec node bin/mathflow.mjs workspace
