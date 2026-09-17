#!/usr/bin/env bash
# 촬영 폴더를 720p 프록시로 — 맥에서 한 번 돌린다.
#
# 왜: 클라우드 세션에는 원본이 안 올라간다(한도·디스크). 720p 프록시는 원본의
#     1/10~1/20 이고, 프리미어는 프록시로 편집하고 원본에 재연결하는 게 표준이다.
#     우리 XML 은 파일 이름만 들고 있으니 `_proxy` 를 원본으로 한 번 바꾸면 끝.
#
#   brew install ffmpeg
#   bash bin/프록시만들기.sh ~/촬영폴더 [출력폴더=~/촬영폴더_proxy]
#
# 나온 폴더를 Drive/Dropbox 에 올리고 공유 링크를 세션에 준다.
set -euo pipefail
SRC="${1:?촬영 폴더}"; OUT="${2:-${SRC%/}_proxy}"; mkdir -p "$OUT"
n=0; tot=0
for f in "$SRC"/*.{mp4,mov,MP4,MOV,mxf,MXF}; do
  [ -e "$f" ] || continue
  b="$(basename "${f%.*}")"
  # 720p · H.264 crf 28 · 오디오는 AAC 96k 로 (나레이션 싱크 확인용) · 파일명 그대로 + _proxy
  ffmpeg -v error -y -i "$f" -vf "scale=-2:720" -c:v libx264 -preset veryfast -crf 28 \
         -c:a aac -b:a 96k -movflags +faststart "$OUT/${b}_proxy.mp4"
  s=$(stat -f%z "$OUT/${b}_proxy.mp4" 2>/dev/null || stat -c%s "$OUT/${b}_proxy.mp4")
  o=$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f")
  printf '%-40s %6d MB → %5d MB\n' "$b" $((o/1048576)) $((s/1048576)); n=$((n+1)); tot=$((tot+s))
done
echo; echo "$n 개 · 합계 $((tot/1048576)) MB → $OUT"
echo "이 폴더를 Drive/Dropbox 에 올리고 공유 링크를 주면 된다."
