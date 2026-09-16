#!/usr/bin/env bash
# 소재 사진을 공식 사이트에서 다시 받는다.
#
# 이 폴더에는 소재가 안 들어 있다 — 저작권 출처가 제각각이라 통째로
# 재배포할 물건이 아니다. 공식 사이트 쪽은 여기서 자동으로 복구되고,
# Wikimedia·Pexels 쪽은 사람이 골라야 한다.
set -euo pipefail
P="${1:-니시아자부}"
cd "$(dirname "$0")/.."

echo "== ${P} 공식 사이트에서 받는다 =="
python3 scripts/refetch_official.py "$P" --write   # 원본 크기로
python3 scripts/harvest_official.py "$P" --write   # 아직 안 쓴 사진 + 컨택트시트

echo
echo "== 남은 것 =="
python3 - "$P" <<'PY'
import json, pathlib, re, sys
p = sys.argv[1]
root = pathlib.Path(__file__).resolve().parent if False else pathlib.Path('.')
design = json.load(open(root / 'projects' / p / 'design.json', encoding='utf-8'))['cuts']
want = set()
for v in design.values():
    if isinstance(v, list) and len(v) > 2:
        for m in re.findall(r'"([^"]+\.(?:jpg|jpeg|png|webp|svg|mp4|webm|mov))"',
                            json.dumps(v[2], ensure_ascii=False)):
            want.add(m)
have = {f.name for f in (root / 'motion' / 'public' / p).glob('*')}
miss = sorted(w for w in want if w.split('/')[-1] not in have)
print(f'design.json 이 부르는 소재 {len(want)} · 갖고 있는 것 {len(want)-len(miss)}')
if miss:
    print(f'아직 없는 것 {len(miss)}:')
    for m in miss[:40]:
        print('   ', m)
    print('\nscripts/fetch_sources.py 로 받고 컨택트시트를 보고 채택해라.')
    print('자동 채택은 하지 않는다 — AGENTS.md 6장.')
PY
