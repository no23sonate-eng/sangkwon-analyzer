#!/usr/bin/env bash
# 작업 상태 복구 — 한 줄로.
#
# 이 컨테이너는 파일시스템이 스냅샷으로 되돌아간다 (오늘만 여섯 번).
# git 이 되돌리는 게 아니다 — .git 의 reflog·COMMIT_EDITMSG 까지 옛날로
# 돌아가는데 푸시한 커밋은 원격에 멀쩡히 다 있다. 푸시는 성공했고 그 뒤
# 로컬 디스크가 통째로 롤백된 것이다. 세션 안에서는 막을 수 없다.
#
# 그래서 **되돌아가도 잃을 게 없게** 만든다:
#   · 대본·설계(design.json)·소재·코드·스킬 → 전부 커밋된다. 이건 살아남는다
#   · scene_plan.json·scene_props.json → design.json 에서 다시 만든다
#   · 스틸(렌더 산출물) → 이것만 다시 뽑으면 된다
#
#   bash scripts/restore.sh 더그랜드롯데            # 설계까지 복구
#   bash scripts/restore.sh 더그랜드롯데 --render   # 스틸까지 다시 뽑는다
set -euo pipefail
cd "$(dirname "$0")/.."
PROJ="${1:?프로젝트 이름을 달라}"
BRANCH="${BRANCH:-claude/youtube-editing-pipeline-khz454}"

echo "① 원격에서 되받는다"
git fetch -q origin "$BRANCH"
git reset --hard -q "origin/$BRANCH"
git log --oneline -1

echo "② scene_plan · scene_props 를 design.json 에서 다시 만든다"
python3 scripts/plan_from_script.py "projects/$PROJ/script.md" --project "$PROJ" >/dev/null
python3 scripts/apply_design.py "$PROJ" --placeholder | tail -4

if [ "${2:-}" = "--render" ]; then
  echo "③ 스틸을 다시 뽑는다 (약 30분)"
  python3 scripts/render_parkside.py --still --project "$PROJ"
  python3 scripts/name_stills.py "$PROJ"
  python3 scripts/build_review_page.py "$PROJ"
fi
echo "복구 끝"
