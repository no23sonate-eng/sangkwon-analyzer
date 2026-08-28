#!/usr/bin/env python3
"""프리미어로 넘기는 꾸러미 — 시퀀스 XML + 컷 목록.

렌더가 뽑아 놓은 컷 클립(`clips/sec00_cut01.mp4` …)을 **기획한 순서와 길이
그대로** 타임라인에 깔아 주는 Final Cut Pro 7 XML 을 만든다. 프리미어가
그대로 읽는 교환 규격이라 별도 플러그인이 필요 없다.

왜 클립을 하나로 합치지 않나: 편집은 컷을 **옮기고 늘리고 갈아 끼우는**
일이다. 통짜 mp4 를 주면 그걸 다시 잘라야 하고, 자른 자리는 원본 컷 경계와
어긋난다. 컷 단위로 주고 타임라인이 순서를 기억하게 하는 편이 맞다.

같이 나가는 것:
  · `더그랜드롯데.xml`   프리미어 File ▸ Import 로 여는 시퀀스
  · `컷목록.csv`        컷 번호 · 타임코드 · 카드 · 출처 · 나레이션
  · `README.txt`        불러오는 순서

    python3 scripts/build_premiere.py 더그랜드롯데
    python3 scripts/build_premiere.py 더그랜드롯데 --base /Users/나/Movies/더그랜드롯데
"""
import argparse
import csv
import html
import json
import os
import pathlib
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
FPS = 30
W, H = 1920, 1080


def tc(frames, fps=FPS):
    f = int(round(frames))
    h, rem = divmod(f, fps * 3600)
    m, rem = divmod(rem, fps * 60)
    s, ff = divmod(rem, fps)
    return f'{h:02d}:{m:02d}:{s:02d}:{ff:02d}'


def esc(s):
    return html.escape(str(s or ''), quote=False)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    # 프리미어는 상대경로를 받으면 처음 한 번 "찾아 달라" 고 묻고, 한 개를
    # 짚어 주면 나머지를 알아서 잇는다. 로컬 절대경로를 아는 경우엔 --base 로
    # 넣어 주면 그 물음도 없다
    ap.add_argument('--base', default='', help='클립 폴더의 로컬 절대경로')
    ap.add_argument('--fps', type=int, default=FPS)
    a = ap.parse_args()

    pdir = ROOT / 'projects' / a.project
    plan = json.load(open(pdir / 'scene_plan.json', encoding='utf-8'))
    design = json.load(open(pdir / 'design.json', encoding='utf-8'))['cuts']
    scenes = plan['scenes']
    # 장 표시는 **설계에서 가져온다.** scene_plan 의 act 는 문단 번호라
    # 1~9 가 뒤섞여 있어 장 경계가 아니다. 장을 여는 컷은 PlanTitleCard 다 —
    # 그 카드의 kicker(장 번호)와 lines(제목)가 곧 마커 이름이다
    def chapter_of(sid):
        v = design.get(str(sid))
        if not v or v[0] != 'PlanTitleCard':
            return None
        pr = v[2] if isinstance(v[2], dict) else {}
        k = str(pr.get('kicker', '')).strip()
        title = ' '.join(str(x) for x in (pr.get('lines') or []) if x).strip()
        return f'{k}. {title}'.lstrip('. ') if (k or title) else None

    outdir = pdir / '프리미어'
    outdir.mkdir(exist_ok=True)
    clipdir = pdir / 'clips'

    # ── 컷을 순서대로 이어 붙인다. **기획한 길이 그대로** ──────────────
    rows, items, files, markers = [], [], [], []
    at = 0                      # 타임라인 위치(프레임)
    for i, sc in enumerate(scenes):
        sid = sc['id']
        name = f"sec{sid:02d}_{sc['key']}"
        mp4 = clipdir / f'{name}.mp4'
        # 렌더도 같은 식(Math.round(durationSec * FPS))으로 프레임 수를 잡으므로
        # 이 값이 곧 그 클립의 영상 프레임 수다.
        # 파일을 ffprobe 로 재면 2프레임쯤 길게 나오는데 그건 무음 AAC 트랙의
        # 프라이밍 패딩이지 영상이 아니다 — 그걸 따라가면 컷마다 2프레임씩
        # 밀려 15분 뒤엔 12초가 어긋난다
        dur = max(1, int(round(sc['dur'] * a.fps)))
        card, why = (design.get(str(sid)) or ['?', ''])[:2]
        props = (design.get(str(sid)) or [None, None, {}])[2]
        source = props.get('source', '') if isinstance(props, dict) else ''
        text = ' '.join(str(sc.get('text', '')).split())

        if a.base:
            p = os.path.join(a.base, 'clips', f'{name}.mp4')
        else:
            p = f'clips/{name}.mp4'
        url = urllib.parse.quote(p.replace(os.sep, '/'), safe='/:')
        if a.base:
            url = 'file://' + ('' if url.startswith('/') else '/') + url

        fid = f'file-{i + 1}'
        files.append(
            f'          <file id="{fid}">\n'
            f'            <name>{esc(name)}.mp4</name>\n'
            f'            <pathurl>{esc(url)}</pathurl>\n'
            f'            <rate><timebase>{a.fps}</timebase><ntsc>FALSE</ntsc></rate>\n'
            f'            <duration>{dur}</duration>\n'
            f'            <media><video><samplecharacteristics>'
            f'<width>{W}</width><height>{H}</height>'
            f'</samplecharacteristics></video></media>\n'
            f'          </file>')
        items.append(
            f'          <clipitem id="clipitem-{i + 1}">\n'
            f'            <name>#{sid} {esc(name)}</name>\n'
            f'            <duration>{dur}</duration>\n'
            f'            <rate><timebase>{a.fps}</timebase><ntsc>FALSE</ntsc></rate>\n'
            f'            <start>{at}</start>\n'
            f'            <end>{at + dur}</end>\n'
            f'            <in>0</in>\n'
            f'            <out>{dur}</out>\n'
            f'            <file id="{fid}" />\n'
            # 프리미어의 Description / Comment 칸에 그대로 뜬다.
            # 편집하면서 대본과 설계 의도를 보려고 파일을 따로 열지 않게 한다
            f'            <comments>\n'
            f'              <mastercomment1>{esc(text)}</mastercomment1>\n'
            f'              <mastercomment2>{esc(why)}</mastercomment2>\n'
            f'              <mastercomment3>{esc(source)}</mastercomment3>\n'
            f'            </comments>\n'
            f'          </clipitem>')

        ch = '후크' if i == 0 else chapter_of(sid)
        if ch:
            markers.append(
                f'      <marker>\n'
                f'        <name>{esc(ch)}</name>\n'
                f'        <comment></comment>\n'
                f'        <in>{at}</in><out>-1</out>\n'
                f'      </marker>')

        rows.append({
            '컷': f'#{sid}', '시작': tc(at, a.fps), '끝': tc(at + dur, a.fps),
            '길이(초)': f"{sc['dur']:.1f}", '카드': card, '파일': f'{name}.mp4',
            '출처': source, '설계 의도': why, '나레이션': text,
            '클립 있음': 'O' if mp4.exists() else '—',
        })
        at += dur

    total = at
    seq = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<!DOCTYPE xmeml>\n'
        '<xmeml version="4">\n'
        '  <sequence id="sequence-1">\n'
        f'    <name>{esc(a.project)} — 편집본</name>\n'
        f'    <duration>{total}</duration>\n'
        f'    <rate><timebase>{a.fps}</timebase><ntsc>FALSE</ntsc></rate>\n'
        '    <timecode>\n'
        f'      <rate><timebase>{a.fps}</timebase><ntsc>FALSE</ntsc></rate>\n'
        '      <string>00:00:00:00</string><frame>0</frame>\n'
        '      <displayformat>NDF</displayformat>\n'
        '    </timecode>\n'
        '    <media>\n'
        '      <video>\n'
        '        <format><samplecharacteristics>\n'
        f'          <rate><timebase>{a.fps}</timebase><ntsc>FALSE</ntsc></rate>\n'
        f'          <width>{W}</width><height>{H}</height>\n'
        '          <pixelaspectratio>square</pixelaspectratio>\n'
        '        </samplecharacteristics></format>\n'
        '        <track>\n' + '\n'.join(items) + '\n        </track>\n'
        # 자막·나레이션·현장음이 들어갈 자리를 미리 비워 둔다
        '      </video>\n'
        '      <audio>\n'
        '        <track><enabled>TRUE</enabled><locked>FALSE</locked></track>\n'
        '        <track><enabled>TRUE</enabled><locked>FALSE</locked></track>\n'
        '      </audio>\n'
        '    </media>\n' + '\n'.join(markers) + '\n'
        '  </sequence>\n'
        '</xmeml>\n')
    # <file> 정의는 clipitem 안에서 처음 나올 때 한 번만 있으면 되는데,
    # 프리미어는 참조가 먼저 와도 파일 정의를 찾아 잇는다. 읽기 편하도록
    # 정의를 clipitem 안에 넣지 않고 따로 두지 않는다 — 대신 첫 참조에 붙인다
    for i, f in enumerate(files):
        block = '\n'.join('  ' + ln for ln in f.splitlines()).lstrip()
        seq = seq.replace(f'            <file id="file-{i + 1}" />',
                          '            ' + block, 1)

    (outdir / f'{a.project}.xml').write_text(seq, encoding='utf-8')

    with open(outdir / '컷목록.csv', 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    have = sum(1 for r in rows if r['클립 있음'] == 'O')
    (outdir / 'README.txt').write_text(
        f'''{a.project} — 프리미어 편집 꾸러미

  컷 {len(rows)}개 · 총 {int(total / a.fps // 60)}분 {int(total / a.fps % 60)}초 · {W}x{H} {a.fps}fps
  지금 이 폴더 기준 클립 상태: {have}/{len(rows)}개

━━ 1. 클립 뽑기 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

저장소에는 **결과물이 아니라 만드는 방법**이 들어 있다. 영상 소재(mp4)와
컷 클립은 용량이 커서 커밋하지 않는다. 아래 한 줄이면 다 만들어진다.

    git pull
    cd youtube_pipeline/motion && npm ci && cd ..
    python3 scripts/edit_package.py {a.project} -j 4

  · 소재 영상 34개를 Pexels 에서 다시 받고
  · 대본에서 장면 계획을 세우고 설계를 반영하고
  · 컷 {len(rows)}개를 렌더하고
  · 이 XML 과 컷목록을 다시 쓴다

두 번째부터는 소재가 이미 있으니 `--skip-video` 를 붙이면 빠르다.
XML·컷목록만 다시 만들 땐 `--skip-render` 까지.

━━ 2. 프리미어로 불러오기 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

폴더 구조는 이대로 두어야 링크가 붙는다.

    projects/{a.project}/
      clips/                컷 클립 {len(rows)}개
      프리미어/
        {a.project}.xml
        컷목록.csv

  1. 프리미어 ▸ File ▸ Import ▸ {a.project}.xml
  2. 클립을 못 찾는다고 물으면 clips 폴더의 **아무 파일이나 하나** 짚어
     준다. 나머지 {len(rows) - 1}개는 알아서 이어진다.
  3. "{a.project} — 편집본" 시퀀스가 생긴다.

━━ 3. 타임라인에 실려 있는 것 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  V1              컷 {len(rows)}개가 기획한 순서·길이 그대로
  A1 · A2         비어 있다 — 나레이션·현장음 자리
  마커            장(章)이 열리는 지점
  클립 이름        #컷번호 + 파일명
  Description     그 컷의 나레이션
  Comment         설계 의도
  Log Note        화면 우측 상단에 뜨는 출처

  Description·Comment 는 프로젝트 패널에서 컬럼 헤더 우클릭 ▸ Metadata
  Display 로 켠다. 편집하면서 대본과 의도를 보려고 파일을 따로 열지
  않아도 된다.

━━ 4. 컷을 고칠 때 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

컷 하나만 다시 뽑으려면 (예: #88)

    python3 scripts/render_parkside.py --project {a.project} 88

같은 파일명으로 덮어쓰므로 프리미어에서는 파일만 다시 읽으면 된다.
타임라인은 그대로다.
''', encoding='utf-8')

    print(f'{len(rows)}컷 · {total} 프레임 ({total / a.fps / 60:.1f}분) → {outdir}')
    print(f'  클립 {have}/{len(rows)}개 존재')


if __name__ == '__main__':
    main()
