#!/usr/bin/env python3
"""타이포 하한 검사 — 폰에서 안 읽히는 글씨를 막는다.

영상은 대부분 휴대폰으로 본다. 1920x1080 프레임에서 26px 아래는
폰 화면에서 사실상 안 읽힌다(사용자 지적, 2026-08-19).

하한: 26px. 예외는 우하단 출처 한 줄(22px) 뿐이다 — 읽으라고 쓰는 글이 아니라
라이선스 표기라서. 그 외에 26 미만이 나오면 실패로 잡는다.

사용: python3 youtube_pipeline/scripts/type_floor.py
"""
import glob
import os
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, 'motion', 'src')
FLOOR = 26
EXEMPT = {
    # 파일: {허용 크기}  — 우하단 크레딧만 예외
    'v4.jsx': {22},
}
# v4 디자인 체계를 쓰는 파일만 본다 (구형 Y*/Cleo* 카드는 대상 아님)
FILES = ['v4.jsx', 'PaperStatCard.jsx', 'PaperElevationCard.jsx', 'PaperFlowCard.jsx',
         'FootageCard.jsx', 'ArchiveKit.jsx']
FILES += [os.path.basename(p) for p in sorted(glob.glob(os.path.join(SRC, 'PaperKit*.jsx')))]

NUM = re.compile(r'fontSize:\s*(\d+)\b')


def main():
    bad = []
    for name in FILES:
        path = os.path.join(SRC, name)
        if not os.path.exists(path):
            continue
        allowed = EXEMPT.get(name, set())
        for i, line in enumerate(open(path, encoding='utf-8'), 1):
            for m in NUM.finditer(line):
                v = int(m.group(1))
                if v < FLOOR and v not in allowed:
                    bad.append((name, i, v, line.strip()[:80]))
    if bad:
        print(f'✗ 타이포 하한({FLOOR}px) 미만 {len(bad)}건')
        for name, i, v, txt in bad:
            print(f'  {name}:{i}  {v}px  {txt}')
        return 1
    print(f'✓ 타이포 하한 {FLOOR}px 통과 ({len(FILES)}개 파일)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
