#!/bin/bash
# Volume Studio 원클릭 실행 — 더블클릭하면 서버를 켜고 브라우저를 엽니다.
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
echo "🏗️  Volume Studio 시작 중... (이 창을 닫으면 종료됩니다)"
if [ ! -d node_modules ]; then
  echo "첫 실행: 필요한 파일 설치 중 (1~3분, 한 번만)"
  npm install
fi
( sleep 5 && open "http://localhost:3200" ) &
npm run dev
