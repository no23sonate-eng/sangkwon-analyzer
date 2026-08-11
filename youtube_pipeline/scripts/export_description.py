#!/usr/bin/env python3
"""유튜브 설명문 초안 생성.

B1M 설명문 180편을 뜯어보니 형태가 고정돼 있다 (design_reference §31-5).

  1줄  로그라인 — 영상 전체를 한 문장으로. 중앙 61자
       "This massive 175-kilometre tunnel is quietly saving the windy city."
  빈줄
  챕터 타임스탬프 — 180편 중 117편(65%)에 있다. 00:00 부터 시작해야 유튜브가 목차로 잡는다
  빈줄
  "Additional footage and images:" 크레딧 블록 — **180편 중 153편(85%)**
  빈줄
  구독·링크

크레딧 블록이 특히 중요하다. B1M 은 방송 푸티지를 인용하고 설명문에 적는 걸로
정리한다. 내 파이프라인은 CC 소재만 쓰지만 **표기 의무는 오히려 더 빡세다** —
CC BY 는 저작자 표시가 라이선스 조건이라 안 적으면 위반이다.
그 표는 이미 `motion/public/<project>/CREDITS.md` 가 만들고 있으니 옮기기만 하면 된다.

    python3 youtube_pipeline/scripts/export_description.py 더파크사이드서울 \
        --logline "서울 한복판에 11조짜리 도시가 생기고 있습니다."

챕터 제목은 scene_plan.json 의 chapters[].name 을 쓴다. 비어 있으면
`(제목 미정)` 으로 찍고 경고한다 — **제목 짓기는 기획의 일이라 자동화하지 않는다.**
자동으로 지으면 전부 "배경", "공사", "정리" 가 된다.
"""
import argparse, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, 'motion', 'public')

TAIL = """━━━━━━━━━━━━━━━━━━━━━━━━
이 채널은 상권·개발사업을 자료로 확인해서 다룹니다.
사실관계 오류나 제보는 댓글로 남겨 주세요."""


def read_credits(project):
    """CREDITS.md 표 → 설명문 크레딧 줄.

    표는 `| 파일 | 원본 | 출처 / 라이선스 | 화면 표기 |` 형식이다.
    설명문에는 **저작자 + 라이선스**만 나가면 된다 (파일명은 시청자에게 의미 없다).
    """
    p = os.path.join(PUBLIC, project, 'CREDITS.md')
    if not os.path.exists(p):
        return [], p
    rows = []
    for ln in open(p, encoding='utf-8'):
        cells = [c.strip() for c in ln.strip().strip('|').split('|')]
        if len(cells) < 4 or cells[0] in ('파일', '---') or set(cells[0]) <= set('-'):
            continue
        origin = re.sub(r'\s*\((commons|openverse|mixkit)\)$', '', cells[1])
        who = cells[2].replace('**', '')
        rows.append((origin, who))
    # 같은 저작자가 여러 파일이면 한 줄로 합친다 — 설명문에 같은 이름이 다섯 번 나오면 지저분하다
    seen, out = set(), []
    for origin, who in rows:
        if who in seen:
            continue
        seen.add(who)
        out.append(f'· {origin} — {who}')
    return out, p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--logline', default='', help='한 문장 요약 (없으면 자리만 비워 둔다)')
    ap.add_argument('--link', action='append', default=[], help='"라벨|URL" (여러 번)')
    a = ap.parse_args()

    pdir = os.path.join(ROOT, 'projects', a.project)
    planp = os.path.join(pdir, 'scene_plan.json')
    if not os.path.exists(planp):
        sys.exit(f'{planp} 가 없다. plan_from_script.py 부터 돌릴 것.')
    plan = json.load(open(planp, encoding='utf-8'))
    chs = plan.get('chapters') or []

    warn = []
    L = []
    L.append(a.logline or '[로그라인 — 한 문장. B1M 실측 중앙 61자]')
    if not a.logline:
        warn.append('로그라인이 비었다. 첫 줄은 피드에서 제목 다음으로 읽히는 자리다.')
    L.append('')

    if chs:
        if chs[0]['ts'] != '0:00':
            warn.append('첫 챕터가 0:00 이 아니다 — 유튜브가 목차로 안 잡는다.')
        L.append('목차')
        for c in chs:
            name = c.get('name') or '(제목 미정)'
            L.append(f"{c['ts']} {name}")
            if not c.get('name'):
                warn.append(f"{c['ts']} 챕터 제목이 비었다 — {c.get('hint', '')[:30]}…")
        L.append('')
    else:
        warn.append('챕터가 없다. scene_plan.json 에 chapters 가 안 들어 있다.')

    creds, cpath = read_credits(a.project)
    if creds:
        L.append('자료 출처')
        L += creds
        L.append('')
    else:
        warn.append(f'{cpath} 가 없거나 비었다 — CC BY 소재는 표기가 라이선스 조건이다.')

    for spec in a.link:
        if '|' in spec:
            lab, url = spec.split('|', 1)
            L.append(f'{lab.strip()} — {url.strip()}')
    if a.link:
        L.append('')
    L.append(TAIL)

    out = os.path.join(pdir, f'{a.project}_설명문.txt')
    open(out, 'w', encoding='utf-8').write('\n'.join(L) + '\n')
    print('\n'.join(L))
    print(f'\n→ {out}')
    if warn:
        print('\n채우고 갈 것:')
        for w in warn:
            print(f'  · {w}')


if __name__ == '__main__':
    main()
