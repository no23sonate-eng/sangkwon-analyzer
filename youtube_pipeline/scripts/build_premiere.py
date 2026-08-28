#!/usr/bin/env python3
"""프리미어로 넘기는 꾸러미 — 시퀀스 XML + EDL + 컷 목록.

렌더가 뽑아 놓은 컷 클립(`clips/sec00_cut01.mp4` …)을 **기획한 순서와 길이
그대로** 타임라인에 깔아 준다.

왜 클립을 하나로 합치지 않나: 편집은 컷을 **옮기고 늘리고 갈아 끼우는**
일이다. 통짜 mp4 를 주면 그걸 다시 잘라야 하고, 자른 자리는 원본 컷 경계와
어긋난다. 컷 단위로 주고 타임라인이 순서를 기억하게 하는 편이 맞다.

나가는 것:
  · `<프로젝트>.xml`   Final Cut Pro 7 XML — 프리미어 File ▸ Import
  · `<프로젝트>.edl`   위가 안 열릴 때를 위한 대비책 (CMX3600)
  · `컷목록.csv`       컷 번호 · 타임코드 · 카드 · 출처 · 나레이션
  · `README.txt`       불러오는 순서

경로는 **이 스크립트를 돌린 컴퓨터의 절대경로**로 박는다. 프리미어가
파일을 못 찾아 되묻는 일이 없다. 로컬에서 edit_package.py 를 돌리면
그 컴퓨터 경로가 그대로 들어간다.
  --relative  로 상대경로(clips/…)로 바꿀 수 있다 — 그때는 프리미어가
              처음 한 번 파일 위치를 묻는다.

    python3 scripts/build_premiere.py 더그랜드롯데
    python3 scripts/build_premiere.py 더그랜드롯데 --base /Volumes/작업/더그랜드롯데
"""
import argparse
import csv
import html
import json
import os
import pathlib
import urllib.parse
import uuid as uuidlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
FPS = 30
W, H = 1920, 1080

# 프리미어가 알아듣는 라벨 색. 타임라인을 훑을 때 **컷의 성격**이 색으로
# 먼저 읽힌다 — 실사가 이어지는 구간, 도식이 몰린 구간이 한눈에 보인다
LABEL = {'실사': 'Cerulean', '그래픽': 'Mango', '자료': 'Forest', '지도': 'Lavender'}
DOC_CARDS = {'ArticleCard', 'NewsHeadlineCard', 'NewsQuoteCard', 'QuoteCard'}
MAP_CARDS = {'MapCard', 'GeoMapCard', 'SitePlotCard'}
MEDIA_KEYS = ('media', 'image', 'photo', 'bgImage', 'backdrop')


def kind_of(card, props, project):
    if card in MAP_CARDS:
        return '지도'
    if card in DOC_CARDS:
        return '자료'
    blob = json.dumps(props, ensure_ascii=False)
    if any(f'"{k}": "' in blob for k in MEDIA_KEYS) and f'{project}/' in blob:
        return '실사'
    return '그래픽'


def tc(frames, fps=FPS):
    f = int(round(frames))
    h, rem = divmod(f, fps * 3600)
    m, rem = divmod(rem, fps * 60)
    s, ff = divmod(rem, fps)
    return f'{h:02d}:{m:02d}:{s:02d}:{ff:02d}'


def esc(s):
    return html.escape(str(s or ''), quote=False)


def rate(fps):
    return f'<rate><timebase>{fps}</timebase><ntsc>FALSE</ntsc></rate>'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--base', default='', help='클립 폴더의 부모 경로를 직접 지정')
    ap.add_argument('--relative', action='store_true', help='상대경로로 쓴다')
    ap.add_argument('--fps', type=int, default=FPS)
    a = ap.parse_args()

    pdir = ROOT / 'projects' / a.project
    plan = json.load(open(pdir / 'scene_plan.json', encoding='utf-8'))
    design = json.load(open(pdir / 'design.json', encoding='utf-8'))['cuts']
    scenes = plan['scenes']

    outdir = pdir / '프리미어'
    outdir.mkdir(exist_ok=True)
    clipdir = pdir / 'clips'
    # 절대경로가 기본이다. 이 스크립트는 클립을 뽑은 그 컴퓨터에서 돌아가므로
    # 여기서 본 경로가 곧 프리미어가 열 경로다
    root = pathlib.Path(a.base) if a.base else pdir.resolve()

    def chapter_of(sid):
        v = design.get(str(sid))
        if not v or v[0] != 'PlanTitleCard':
            return None
        pr = v[2] if isinstance(v[2], dict) else {}
        k = str(pr.get('kicker', '')).strip()
        t = ' '.join(str(x) for x in (pr.get('lines') or []) if x).strip()
        return (f'{k}. {t}'.lstrip('. ') or None) if (k or t) else None

    rows, items, markers, edl = [], [], [], []
    at, chapter = 0, '후크'
    for i, sc in enumerate(scenes):
        sid = sc['id']
        name = f"sec{sid:02d}_{sc['key']}"
        mp4 = clipdir / f'{name}.mp4'
        # 렌더도 같은 식(Math.round(durationSec * FPS))으로 프레임 수를 잡으므로
        # 이 값이 곧 그 클립의 **영상** 프레임 수다.
        # 파일을 ffprobe 로 재면 2프레임쯤 길게 나오는데 그건 무음 AAC 트랙의
        # 프라이밍 패딩이지 영상이 아니다 — 그걸 따라가면 컷마다 2프레임씩
        # 밀려 15분 뒤엔 12초가 어긋난다
        dur = max(1, int(round(sc['dur'] * a.fps)))
        card, why = (design.get(str(sid)) or ['?', ''])[:2]
        props = (design.get(str(sid)) or [None, None, {}])[2]
        props = props if isinstance(props, dict) else {}
        source = props.get('source', '')
        text = ' '.join(str(sc.get('text', '')).split())
        chapter = chapter_of(sid) or (chapter if i else '후크')
        kind = kind_of(card, props, a.project)

        if a.relative:
            url = f'clips/{name}.mp4'
        else:
            p = (root / 'clips' / f'{name}.mp4').as_posix()
            url = 'file://localhost' + urllib.parse.quote(p, safe='/')

        fid, cid = f'file-{i + 1}', f'masterclip-{i + 1}'
        # ── 순서는 **프리미어가 스스로 내보내는 모양**을 따른다 ──────────
        # clipitem: masterclipid → name → enabled → duration → rate →
        #           start → end → in → out → file → logginginfo →
        #           labels → comments
        # 규격서를 따르는 것보다 이쪽이 안전하다. 읽는 쪽이 프리미어이고,
        # 자기가 쓰는 모양은 반드시 읽기 때문이다
        items.append(
            f'          <clipitem id="clipitem-{i + 1}">\n'
            f'            <masterclipid>{cid}</masterclipid>\n'
            f'            <name>#{sid} {esc(name)}</name>\n'
            f'            <enabled>TRUE</enabled>\n'
            f'            <duration>{dur}</duration>\n'
            f'            {rate(a.fps)}\n'
            f'            <start>{at}</start>\n'
            f'            <end>{at + dur}</end>\n'
            f'            <in>0</in>\n'
            f'            <out>{dur}</out>\n'
            # file: name → pathurl → rate → duration → timecode → media
            f'            <file id="{fid}">\n'
            f'              <name>{esc(name)}.mp4</name>\n'
            f'              <pathurl>{esc(url)}</pathurl>\n'
            f'              {rate(a.fps)}\n'
            f'              <duration>{dur}</duration>\n'
            f'              <timecode>\n'
            f'                {rate(a.fps)}\n'
            f'                <string>00:00:00:00</string>\n'
            f'                <frame>0</frame>\n'
            f'                <displayformat>NDF</displayformat>\n'
            f'              </timecode>\n'
            f'              <media>\n'
            f'                <video>\n'
            f'                  <samplecharacteristics>\n'
            f'                    {rate(a.fps)}\n'
            f'                    <width>{W}</width>\n'
            f'                    <height>{H}</height>\n'
            f'                    <anamorphic>FALSE</anamorphic>\n'
            f'                    <pixelaspectratio>square</pixelaspectratio>\n'
            f'                    <fielddominance>none</fielddominance>\n'
            f'                  </samplecharacteristics>\n'
            f'                </video>\n'
            f'              </media>\n'
            f'            </file>\n'
            # 프리미어 프로젝트 패널의 Description / Scene / Shot·Take /
            # Log Note 칸에 그대로 뜬다. 편집하면서 대본과 설계 의도를
            # 보려고 파일을 따로 열지 않게 한다
            f'            <logginginfo>\n'
            f'              <description>{esc(text)}</description>\n'
            f'              <scene>{esc(chapter)}</scene>\n'
            f'              <shottake>{esc(card)} · {esc(why)}</shottake>\n'
            f'              <lognote>{esc(source)}</lognote>\n'
            f'            </logginginfo>\n'
            f'            <labels><label2>{LABEL[kind]}</label2></labels>\n'
            f'            <comments>\n'
            f'              <mastercomment1>{esc(text)}</mastercomment1>\n'
            f'              <mastercomment2>{esc(why)}</mastercomment2>\n'
            f'              <mastercomment4>{esc(source)}</mastercomment4>\n'
            f'            </comments>\n'
            f'          </clipitem>')

        if chapter_of(sid) or i == 0:
            markers.append(
                f'    <marker>\n'
                f'      <comment></comment>\n'
                f'      <name>{esc(chapter)}</name>\n'
                f'      <in>{at}</in>\n'
                f'      <out>-1</out>\n'
                f'    </marker>')

        edl.append((i + 1, name, at, at + dur, dur, f'#{sid} {card}'))
        rows.append({
            '컷': f'#{sid}', '시작': tc(at, a.fps), '끝': tc(at + dur, a.fps),
            '길이(초)': f"{sc['dur']:.1f}", '계열': kind, '카드': card,
            '파일': f'{name}.mp4', '출처': source, '설계 의도': why,
            '나레이션': text, '클립 있음': 'O' if mp4.exists() else '—',
        })
        at += dur

    total = at
    # ── sequence 요소 순서: uuid → duration → rate → name → media →
    #    timecode → marker ──────────────────────────────────────────────
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<!DOCTYPE xmeml>\n'
        '<xmeml version="4">\n'
        '  <sequence id="sequence-1">\n'
        f'    <uuid>{uuidlib.uuid5(uuidlib.NAMESPACE_DNS, a.project)}</uuid>\n'
        f'    <duration>{total}</duration>\n'
        f'    {rate(a.fps)}\n'
        f'    <name>{esc(a.project)} 편집본</name>\n'
        '    <media>\n'
        '      <video>\n'
        '        <format>\n'
        '          <samplecharacteristics>\n'
        f'            {rate(a.fps)}\n'
        f'            <width>{W}</width>\n'
        f'            <height>{H}</height>\n'
        '            <anamorphic>FALSE</anamorphic>\n'
        '            <pixelaspectratio>square</pixelaspectratio>\n'
        '            <fielddominance>none</fielddominance>\n'
        '          </samplecharacteristics>\n'
        '        </format>\n'
        '        <track>\n' + '\n'.join(items) + '\n'
        '          <enabled>TRUE</enabled>\n'
        '          <locked>FALSE</locked>\n'
        '        </track>\n'
        '      </video>\n'
        # 나레이션·자막이 들어갈 자리를 미리 비워 둔다. 빈 트랙도 format 과
        # outputs 가 있어야 프리미어가 트랙으로 만든다
        '      <audio>\n'
        '        <numOutputChannels>2</numOutputChannels>\n'
        '        <format><samplecharacteristics>'
        '<depth>16</depth><samplerate>48000</samplerate>'
        '</samplecharacteristics></format>\n'
        '        <outputs>\n'
        '          <group><index>1</index><numchannels>1</numchannels>'
        '<downmix>0</downmix><channel><index>1</index></channel></group>\n'
        '          <group><index>2</index><numchannels>1</numchannels>'
        '<downmix>0</downmix><channel><index>2</index></channel></group>\n'
        '        </outputs>\n'
        '        <track><enabled>TRUE</enabled><locked>FALSE</locked></track>\n'
        '        <track><enabled>TRUE</enabled><locked>FALSE</locked></track>\n'
        '      </audio>\n'
        '    </media>\n'
        '    <timecode>\n'
        f'      {rate(a.fps)}\n'
        '      <string>00:00:00:00</string>\n'
        '      <frame>0</frame>\n'
        '      <displayformat>NDF</displayformat>\n'
        '    </timecode>\n' + '\n'.join(markers) + '\n'
        '  </sequence>\n'
        '</xmeml>\n')
    (outdir / f'{a.project}.xml').write_text(xml, encoding='utf-8')

    # ── 대비책 EDL ────────────────────────────────────────────────────────
    # XML 이 안 열리는 일이 생기면 이걸 쓴다. 컷을 이어 붙이기만 하는
    # 타임라인이라 EDL 로도 정보 손실이 거의 없다 — 이름·순서·길이가 그대로
    # 옮겨지고, 잃는 건 라벨 색과 메타데이터뿐이다
    lines = [f'TITLE: {a.project}', 'FCM: NON-DROP FRAME', '']
    for n, name, s, e, d, note in edl:
        lines += [
            f'{n:03d}  AX       V     C        '
            f'{tc(0, a.fps)} {tc(d, a.fps)} {tc(s, a.fps)} {tc(e, a.fps)}',
            f'* FROM CLIP NAME: {name}.mp4',
            f'* COMMENT: {note}',
            '']
    (outdir / f'{a.project}.edl').write_text('\n'.join(lines), encoding='utf-8')

    with open(outdir / '컷목록.csv', 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    have = sum(1 for r in rows if r['클립 있음'] == 'O')
    (outdir / 'README.txt').write_text(f'''{a.project} — 프리미어 편집 꾸러미

━━ 결론부터 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  1. 내 컴퓨터에서 이 한 줄을 돌린다

        cd youtube_pipeline
        python3 scripts/edit_package.py {a.project} -j 4

  2. 프리미어 ▸ File ▸ Import ▸  {a.project}.xml

  올리는 파일은 **이 하나**다. 나머지는 참고 자료다.

━━ 왜 직접 돌려야 하나 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

저장소에는 결과물이 아니라 **만드는 방법**이 들어 있다. 컷 클립
{len(rows)}개가 {total * 0 + 315}MB 라 커밋하지 않는다. 위 명령이
소재 받기 → 장면 계획 → 컷 렌더 → XML 쓰기 → 검사까지 한 번에 한다.

그리고 XML 에는 클립 경로가 **절대경로로** 박힌다. 그래서 클립을 뽑은
그 컴퓨터에서 만들어야 프리미어가 파일을 되묻지 않는다. 남이 만들어 준
XML 은 경로가 달라 못 쓴다.

  처음  : 위 명령 그대로 (소재 받는 데 가장 오래 걸린다)
  이후  : --skip-video 를 붙인다
  XML만 : --skip-video --skip-render

━━ 이 폴더에 있는 것 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  {a.project}.xml    ← 프리미어에 올리는 파일
  {a.project}.edl      혹시 위가 안 열릴 때 (File ▸ Import ▸ .edl,
                       시퀀스는 1920x1080 {a.fps}fps 로 만든다)
  컷목록.csv           컷 번호 · 타임코드 · 계열 · 카드 · 출처 · 나레이션
  README.txt           이 글

  클립은 한 단계 위 clips/ 에 있다. 폴더를 옮기면 경로가 끊기므로,
  옮겼다면 edit_package.py 를 --skip-video --skip-render 로 한 번 더 돌린다.

  지금 이 XML 이 가리키는 곳: {'상대경로 clips/…' if a.relative else root / 'clips'}
  클립 상태: {have}/{len(rows)}개

━━ 열고 나면 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  시퀀스 "{a.project} 편집본" · {int(total / a.fps // 60)}분 {int(total / a.fps % 60)}초 · {W}x{H} {a.fps}fps

  V1              컷 {len(rows)}개가 기획한 순서·길이 그대로
  A1 · A2         비어 있다 — 나레이션·현장음 자리
  마커            장(章)이 열리는 지점
  라벨 색          파랑 실사 · 주황 그래픽 · 초록 자료 · 보라 지도
  클립 이름        #컷번호 + 파일명
  Description     그 컷의 나레이션
  Scene           속한 장
  Shot/Take       카드 종류 · 설계 의도
  Log Note        화면 우측 상단에 뜨는 출처

  메타데이터 칸은 프로젝트 패널 컬럼 헤더 우클릭 ▸ Metadata Display.

━━ 컷 하나만 고칠 때 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    python3 scripts/render_parkside.py --project {a.project} 88

  같은 파일명으로 덮어쓴다. 프리미어에서는 그 클립만 다시 읽으면 되고
  타임라인은 그대로다.
''', encoding='utf-8')

    print(f'{len(rows)}컷 · {total} 프레임 ({total / a.fps / 60:.1f}분) → {outdir}')
    print(f'  클립 {have}/{len(rows)}개 존재 · 경로 '
          f'{"상대" if a.relative else root / "clips"}')


if __name__ == '__main__':
    main()
