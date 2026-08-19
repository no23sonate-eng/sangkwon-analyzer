#!/usr/bin/env python3
"""흰 글자 뒤가 너무 밝은 컷을 찾아낸다.

눈으로 123컷을 훑으면 "밝은 사진 위 흰 글자"를 반드시 몇 개 놓친다 —
실제로 #83 "핵심 사업장", #37 "하얀 도화지가 클수록" 이 그렇게 나갔다.
사람 눈 대신 **렌더된 프레임의 밝기를 직접 재서** 잡는다.

라벨이 앉는 띠(가로 10~90%, 세로 40~62%)의 밝은 쪽 30% 평균을 본다.
평균만 보면 어두운 배경에 밝은 얼룩 하나가 글자를 먹는 경우를 놓친다.

    python3 scripts/check_contrast.py 올리브영성수 --frames <프레임디렉터리>
    → 임계 초과 컷과 **권장 scrim** 을 같이 뽑는다 (지금 값에서 얼마나 더 어둡게)
"""
import argparse, glob, json, os, re, sys
from PIL import Image

TARGET = 150      # 흰 글자가 편하게 읽히는 배경 밝기 상한
LIMIT = 175       # 이 위는 경고


def band_hi(path):
    im = Image.open(path).convert('L')
    W, H = im.size
    b = im.crop((int(W * .10), int(H * .40), int(W * .90), int(H * .62)))
    px = sorted(b.getdata())
    k = int(len(px) * .70)
    return sum(px[k:]) / max(1, len(px) - k)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--frames', required=True)
    a = ap.parse_args()
    root = os.path.join(os.path.dirname(__file__), '..', 'projects', a.project)
    scenes = json.load(open(os.path.join(root, 'scene_props.json'),
                            encoding='utf-8'))['scenes']

    hits = []
    for f in glob.glob(os.path.join(a.frames, '*.jpg')):
        m = re.search(r'sec(\d+)', os.path.basename(f))
        if not m:
            continue
        e = scenes.get(str(int(m[1]))) or {}
        p = e.get('props') or {}
        # 어두운 톤(= 흰 글자) 실사 자막 카드만 본다. 종이·먹 그래픽 카드는
        # 글자가 검정이라 배경이 밝은 게 정상이다
        if e.get('card') != 'LowerThirdCard' or p.get('tone') == 'light':
            continue
        hi = band_hi(f)
        if hi <= LIMIT:
            continue
        s = p.get('scrim', 0.5)
        old = s + 0.16                       # LowerThirdCard 의 중심 알파
        new = 1 - (1 - old) * TARGET / hi
        hits.append((int(m[1]), round(hi), s, round(min(0.78, new - 0.16), 2)))

    hits.sort()
    for sid, hi, s, rec in hits:
        print(f'#{sid:<4} 밝기 {hi:>3}  scrim {s} → {rec}')
    print(f'{len(hits)}컷 초과 (임계 {LIMIT})', file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
