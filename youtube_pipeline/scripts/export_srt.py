#!/usr/bin/env python3
"""scene_plan.json → SRT 자막 초안.

자막은 편집에서 따로 넣지만, **타이밍이 이미 계산돼 있는데** 손으로 다시 찍는 건
낭비다. 장면 내레이션을 읽기 좋은 길이로 쪼개 시간을 배분한다.

  - 한 줄 최대 STEP_CHARS 자 (모바일 2줄 기준)
  - 문장부호 우선, 없으면 어절 경계에서 자름
  - 장면 안에서 글자 수 비례로 시간 배분

    python3 youtube_pipeline/scripts/export_srt.py 더파크사이드서울
    python3 youtube_pipeline/scripts/export_srt.py 더파크사이드서울 --chars 22
"""
import argparse, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STEP_CHARS = 28          # 한 자막 최대 글자 (1920 폭 · 2줄 안에 들어오는 길이)
MIN_SEC = 1.0


ORPHAN = 8               # 이보다 짧은 꼬리는 앞줄에 붙인다


def chunks(text, limit):
    """문장부호 → 어절 순으로 끊어 limit 자 이하 덩어리로.

    숫자 안의 쉼표(1만3,600)에서 끊기면 안 되므로 자리표시자로 잠시 치환한다.
    """
    text = re.sub(r'(?<=\d),(?=\d)', '\x00', text)
    out, buf = [], ''
    for piece in re.split(r'(?<=[.,?!·])\s*', text):
        if not piece:
            continue
        if buf and len(buf) + len(piece) > limit:
            out.append(buf.strip())
            buf = ''
        if len(piece) > limit:                      # 부호 없이 긴 조각은 어절로
            for w in piece.split(' '):
                if buf and len(buf) + len(w) + 1 > limit:
                    out.append(buf.strip())
                    buf = ''
                buf += (' ' if buf else '') + w
        else:
            buf += (' ' if buf else '') + piece
    if buf.strip():
        out.append(buf.strip())
    out = [o.replace('\x00', ',') for o in out]
    # "있습니다." 처럼 꼬리만 남은 줄은 앞줄에 붙인다 (한 글자 자막 방지)
    merged = []
    for o in out:
        if merged and len(o) <= ORPHAN and len(merged[-1]) + len(o) <= limit + ORPHAN:
            merged[-1] = (merged[-1] + ' ' + o).strip()
        else:
            merged.append(o)
    return merged or [text.replace('\x00', ',')]


def ts(sec):
    h = int(sec // 3600)
    m = int(sec % 3600 // 60)
    s = sec % 60
    return f'{h:02d}:{m:02d}:{s:06.3f}'.replace('.', ',')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--chars', type=int, default=STEP_CHARS)
    a = ap.parse_args()

    projdir = os.path.join(ROOT, 'projects', a.project)
    plan = json.load(open(os.path.join(projdir, 'scene_plan.json'), encoding='utf-8'))

    lines, n = [], 0
    for sc in plan['scenes']:
        text = (sc.get('text') or '').strip()
        if not text:
            continue
        parts = chunks(text, a.chars)
        total = sum(len(p) for p in parts) or 1
        t = sc['start']
        for p in parts:
            d = max(MIN_SEC, sc['dur'] * len(p) / total)
            n += 1
            lines.append(f'{n}\n{ts(t)} --> {ts(min(t + d, sc["end"]))}\n{p}\n')
            t += d

    out = os.path.join(projdir, f'{a.project}_자막초안.srt')
    open(out, 'w', encoding='utf-8').write('\n'.join(lines))
    print(f'{out} — 자막 {n}줄 / {plan["scenes"][-1]["end"]:.1f}초')
    print('낭독 후 실제 길이에 맞춰 밀면 된다 (프리미어: 캡션 트랙에 임포트).')


if __name__ == '__main__':
    main()
