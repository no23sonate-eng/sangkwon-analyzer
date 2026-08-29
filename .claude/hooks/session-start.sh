#!/bin/bash
# 세션이 열릴 때 한 번 — **되돌아간 컨테이너를 스스로 일으켜 세운다.**
#
# 이 환경은 컨테이너가 임시다. 쓰다 보면 파일시스템이 예전 스냅샷으로
# 되돌아가고, 그 순간 커밋 안 된 것은 전부 사라진다. 그건 막을 수 없다 —
# 컨테이너를 안 되돌리는 설정 같은 건 없다. 막을 수 없으니 **되돌아간
# 자리에서 자동으로 복구되게** 만든다.
#
# 되돌아가면 실제로 이런 일이 벌어졌다:
#   · 작업 브랜치가 옛 커밋을 가리켜 프로젝트 폴더가 통째로 없어짐
#   · motion/public 의 스톡 영상이 사라져 렌더가 404 로 멈춤
#   · node_modules 가 비어 remotion 이 안 뜸
# 세 가지를 여기서 차례로 되돌린다. 이미 멀쩡하면 몇 초 만에 끝난다.
#
# 원칙: **세션 시작을 절대 실패시키지 않는다.** 어느 단계가 깨져도
# 무엇이 안 됐는지만 적고 넘어간다. 그리고 **커밋을 잃는 짓은 하지 않는다**
# — 되돌리기는 fast-forward 만, 그것도 작업 트리가 깨끗할 때만 한다.
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
YP=youtube_pipeline
say() { echo "[세션시작] $*"; }

# ── 1. 브랜치를 원격에 맞춘다 ────────────────────────────────────────────
# 되돌아간 뒤엔 로컬 브랜치가 옛 커밋에 있다. 원격이 앞서 있으면 그냥
# 감아 올리면 된다. 반대로 로컬에만 있는 커밋이 있거나 고친 파일이
# 남아 있으면 **건드리지 않는다** — 그건 되돌아간 게 아니라 작업 중이다.
BR=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')
if [ -n "$BR" ] && [ "$BR" != HEAD ] && [ "$BR" != master ] && [ "$BR" != main ]; then
  if git fetch -q origin "$BR" 2>/dev/null; then
    if [ -z "$(git status --porcelain)" ]; then
      if git merge --ff-only -q FETCH_HEAD 2>/dev/null; then
        say "브랜치 $BR → $(git rev-parse --short HEAD)"
      else
        say "브랜치 $BR 는 원격과 갈라져 있다 — 손대지 않았다"
      fi
    else
      say "고친 파일이 남아 있어 브랜치는 그대로 뒀다"
    fi
  else
    say "원격을 못 읽었다 — 브랜치는 그대로"
  fi
fi

# ── 2. 의존성 ────────────────────────────────────────────────────────────
# 스냅샷에 들어 있으면 그대로 살아 있다. 없을 때만 깐다.
if [ -f "$YP/requirements.txt" ]; then
  if ! python3 -c 'import yaml, requests' 2>/dev/null; then
    say 'python 의존성 설치'
    pip install -q -r "$YP/requirements.txt" 2>&1 | tail -3
  fi
fi
if [ -f "$YP/motion/package.json" ] && [ ! -d "$YP/motion/node_modules/remotion" ]; then
  say 'remotion 설치 (motion/)'
  (cd "$YP/motion" && npm install --no-audit --no-fund 2>&1 | tail -3)
fi
# 웹앱(상권분석기)도 같이 세워 둔다 — CLAUDE.md 의 기본이 "테스트·타입 체크
# 통과 후 push" 라, 여기가 비어 있으면 그 두 가지를 아예 못 돌린다
if [ -f web/package.json ] && [ ! -d web/node_modules/next ]; then
  say 'web/ 의존성 설치'
  (cd web && npm install --no-audit --no-fund 2>&1 | tail -3)
fi

# ── 3. 스톡 영상 되받기 ──────────────────────────────────────────────────
# mp4 는 저장소에 안 들어간다(편당 수십 MB). 대신 **받아오는 방법**을
# VIDEOS.tsv 에 커밋해 두었다. 여기서 없는 것만 다시 받는다.
# 있으면 건너뛰므로 멀쩡한 세션에서는 몇 초다.
for tsv in "$YP"/motion/public/*/VIDEOS.tsv; do
  [ -e "$tsv" ] || continue
  d=$(dirname "$tsv"); p=$(basename "$d")
  want=$(grep -cve '^\s*$' -e '^\s*#' "$tsv")
  have=$(find "$d" -maxdepth 1 -name '*.mp4' | wc -l)
  if [ "$have" -lt "$want" ]; then
    say "영상 소재 $p: $have/$want — 없는 것 다시 받는다"
    python3 "$YP/scripts/fetch_videos.py" "$p" 2>&1 | tail -2
  fi
done

# ── 4. 무엇이 비어 있는지만 알려 준다 ────────────────────────────────────
# 클립(렌더 결과)은 되받을 데가 없다. 다시 렌더하는 수밖에 없어서
# 복구는 안 하고, **비어 있다는 사실만** 띄운다. 모르고 넘어가면
# 다 끝난 줄 알고 낡은 꾸러미를 보내게 된다.
for d in "$YP"/projects/*/; do
  [ -f "$d/design.json" ] || continue
  p=$(basename "$d")
  n=$(find "$d/clips" -maxdepth 1 -name '*.mp4' 2>/dev/null | wc -l)
  [ "$n" -eq 0 ] && say "클립 없음: $p — 보내기 전에 렌더가 필요하다"
done

exit 0
