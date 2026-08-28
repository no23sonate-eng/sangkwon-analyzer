#!/usr/bin/env python3
"""프리미어에 올리기 전 검사 — 열어 보고 나서 아는 건 늦다.

FCP7 XML 은 **틀려도 조용히 열린다.** 요소 순서가 어긋나면 그 클립 하나만
빠진 채 나머지가 멀쩡히 들어오고, 경로가 틀리면 전부 오프라인으로 뜬다.
182컷을 눈으로 세어 확인할 수는 없으니 기계가 센다.

보는 것:
  1. XML 이 문법적으로 성립하는가
  2. 요소 **순서**가 FCP7 규격대로인가 (프리미어가 클립을 조용히 버리는 원인)
  3. id 가 겹치지 않는가
  4. 컷이 하나도 안 빠졌는가 · 틈이나 겹침이 없는가
  5. 길이 합이 시퀀스 길이와 같은가
  6. pathurl 이 **실제로 있는 파일**을 가리키는가
  7. 그 파일의 영상 프레임 수가 XML 이 요구하는 길이 이상인가
  8. 해상도·프레임레이트가 시퀀스와 맞는가
  9. 라벨 색이 프리미어가 아는 이름인가

    python3 scripts/check_premiere.py 더그랜드롯데
    python3 scripts/check_premiere.py 더그랜드롯데 --deep   # 모든 클립 실측
"""
import argparse
import json
import pathlib
import re
import subprocess
import urllib.parse
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent.parent

# FCP7 DTD 가 정한 자식 순서. 있는 것만 보고 **상대 순서**를 검사한다
ORDER = {
    'sequence': ['uuid', 'duration', 'rate', 'name', 'media', 'timecode', 'marker'],
    # 프리미어가 스스로 내보내는 순서. 규격서보다 이쪽을 기준으로 본다
    'clipitem': ['masterclipid', 'name', 'enabled', 'duration', 'rate',
                 'start', 'end', 'in', 'out', 'file', 'logginginfo',
                 'labels', 'comments'],
    'file': ['name', 'pathurl', 'rate', 'duration', 'timecode', 'media'],
    'media': ['video', 'audio'],
    'video': ['format', 'track'],
}
LABELS = {'Violet', 'Iris', 'Caribbean', 'Lavender', 'Cerulean', 'Forest', 'Rose',
          'Mango', 'Purple', 'Blue', 'Teal', 'Magenta', 'Tan', 'Green', 'Brown',
          'Yellow', 'White'}


def vframes(path):
    """영상 스트림의 실제 프레임 수. 컨테이너 길이가 아니라 프레임을 센다."""
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(path), '-map', '0:v:0',
                        '-f', 'null', '-'], capture_output=True, text=True)
    m = re.findall(r'frame=\s*(\d+)', r.stderr)
    wh = re.search(r'(\d{3,5})x(\d{3,5})', r.stderr)
    fps = re.search(r'([\d.]+) fps', r.stderr)
    return (int(m[-1]) if m else 0,
            (int(wh.group(1)), int(wh.group(2))) if wh else (0, 0),
            float(fps.group(1)) if fps else 0.0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--deep', action='store_true', help='모든 클립을 ffmpeg 로 실측')
    a = ap.parse_args()

    pdir = ROOT / 'projects' / a.project
    xmlp = pdir / '프리미어' / f'{a.project}.xml'
    errs, warns = [], []

    # 1 ─ 문법
    try:
        root = ET.parse(xmlp).getroot()
    except ET.ParseError as e:
        print(f'✗ XML 이 깨졌다: {e}')
        raise SystemExit(1)
    if root.tag != 'xmeml' or root.get('version') != '4':
        errs.append(f'루트가 <xmeml version="4"> 가 아니다: <{root.tag} version={root.get("version")}>')
    head = xmlp.read_text(encoding='utf-8')[:120]
    if '<!DOCTYPE xmeml>' not in head:
        errs.append('<!DOCTYPE xmeml> 선언이 없다 — 프리미어가 파일 종류를 못 알아본다')

    seq = root.find('sequence')
    if seq is None:
        print('✗ <sequence> 가 없다')
        raise SystemExit(1)

    # 2 ─ 요소 순서
    def check_order(el):
        want = ORDER.get(el.tag)
        if want:
            seen = [c.tag for c in el if c.tag in want]
            idx = [want.index(t) for t in seen]
            if idx != sorted(idx):
                errs.append(f'<{el.tag}> 자식 순서가 규격과 다르다: {seen}')
        for c in el:
            check_order(c)
    check_order(seq)

    # 3 ─ id 중복
    ids = [e.get('id') for e in seq.iter() if e.get('id')]
    dup = {i for i in ids if ids.count(i) > 1}
    if dup:
        errs.append(f'id 가 겹친다: {sorted(dup)}')

    # 4·5 ─ 컷 수 · 틈 · 겹침 · 길이 합
    plan = json.load(open(pdir / 'scene_plan.json', encoding='utf-8'))['scenes']
    clips = seq.findall('.//video/track/clipitem')
    if len(clips) != len(plan):
        errs.append(f'컷 수가 안 맞는다: 계획 {len(plan)} · XML {len(clips)}')
    seq_dur = int(seq.findtext('duration') or 0)
    at, missing_file = 0, 0
    fps = int(seq.findtext('.//rate/timebase') or 30)
    for i, ci in enumerate(clips):
        s, e = int(ci.findtext('start')), int(ci.findtext('end'))
        d, o = int(ci.findtext('duration')), int(ci.findtext('out'))
        if s != at:
            errs.append(f'{ci.findtext("name")}: {at} 에서 시작해야 하는데 {s} — '
                        f'{"틈" if s > at else "겹침"}이 있다')
        if e - s != d or o != d:
            errs.append(f'{ci.findtext("name")}: 길이가 안 맞는다 '
                        f'(end-start={e - s}, duration={d}, out={o})')
        lab = ci.findtext('labels/label2')
        if lab and lab not in LABELS:
            errs.append(f'{ci.findtext("name")}: 프리미어가 모르는 라벨 색 "{lab}"')
        f = ci.find('file')
        if f is None or not f.findtext('pathurl'):
            errs.append(f'{ci.findtext("name")}: <file><pathurl> 이 없다')
            missing_file += 1
        at = e
    if at != seq_dur:
        errs.append(f'클립 길이 합 {at} ≠ 시퀀스 duration {seq_dur}')

    # 6·7·8 ─ 실제 파일
    checked = 0
    gone = []
    for i, ci in enumerate(clips):
        pu = ci.findtext('file/pathurl') or ''
        if pu.startswith('file://'):
            p = pathlib.Path(urllib.parse.unquote(pu.split('file://localhost', 1)[-1]
                                                  .split('file://', 1)[-1]))
        else:
            p = (xmlp.parent / pu).resolve()
        if not p.exists():
            gone.append(f'#{i} {p.name}')
            continue
        if a.deep or i < 6 or i == len(clips) - 1:
            n, (w, h), f = vframes(p)
            checked += 1
            need = int(ci.findtext('duration'))
            if n < need:
                errs.append(f'{p.name}: 영상이 {n}프레임인데 XML 은 {need}프레임을 요구한다 '
                            f'— 끝이 오프라인으로 뜬다')
            if (w, h) != (1920, 1080):
                errs.append(f'{p.name}: 해상도 {w}x{h} — 시퀀스는 1920x1080')
            if abs(f - fps) > 0.01:
                errs.append(f'{p.name}: {f}fps — 시퀀스는 {fps}fps')
    if gone:
        errs.append(f'파일이 없다 ({len(gone)}개): ' + ', '.join(gone[:6])
                    + (' …' if len(gone) > 6 else ''))

    # 9 ─ EDL 도 같이 본다
    edlp = pdir / '프리미어' / f'{a.project}.edl'
    if edlp.exists():
        n = len(re.findall(r'^\d{3}\s+AX', edlp.read_text(encoding='utf-8'), re.M))
        if n != len(plan):
            warns.append(f'EDL 이벤트 {n}개 ≠ 컷 {len(plan)}개')
    else:
        warns.append('EDL 대비책이 없다')

    mk = seq.findall('marker')
    print(f'검사: {xmlp.name}')
    print(f'  컷 {len(clips)}개 · {seq_dur}프레임 ({seq_dur / fps / 60:.1f}분) · '
          f'{fps}fps · 마커 {len(mk)}개')
    print(f'  파일 실측 {checked}개' + ('' if a.deep else ' (--deep 이면 전부)'))
    for w in warns:
        print(f'  ! {w}')
    if errs:
        print(f'\n✗ 문제 {len(errs)}건')
        for e in errs[:30]:
            print(f'  · {e}')
        raise SystemExit(1)
    print('\n✓ 프리미어에 그대로 올릴 수 있다')


if __name__ == '__main__':
    main()
