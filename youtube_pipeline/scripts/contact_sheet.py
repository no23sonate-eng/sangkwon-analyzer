#!/usr/bin/env python3
"""렌더된 스틸을 한 장짜리 검수 시트로 묶는다.

컷을 하나씩 열어 보면 **흐름이 안 보인다.** 같은 문법이 몇 컷 만에 또
돌아오는지, 밝은 판과 먹 판이 어떻게 번갈아 오는지는 나란히 놓아야 보인다.
컷 번호와 카드 이름을 같이 찍어서, 고칠 컷을 바로 부를 수 있게 한다.

  python3 scripts/contact_sheet.py 더그랜드롯데 [--cols 4] [--per 24]
"""
import argparse
import json
import pathlib
import re

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONT_DIRS = [ROOT / 'motion' / 'public' / 'fonts', pathlib.Path('/usr/share/fonts')]


def font(size):
    for d in FONT_DIRS:
        for f in sorted(d.rglob('*.[to]tf')) if d.exists() else []:
            if re.search(r'(Pretendard|Noto.*KR|NanumGothic|Spoqa)', f.name, re.I):
                try:
                    return ImageFont.truetype(str(f), size)
                except Exception:
                    pass
    return ImageFont.load_default()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--cols', type=int, default=4)
    ap.add_argument('--per', type=int, default=24, help='시트 한 장에 담을 컷 수')
    ap.add_argument('--w', type=int, default=440, help='칸 하나의 가로 픽셀')
    a = ap.parse_args()

    pdir = ROOT / 'projects' / a.project
    design = json.loads((pdir / 'design.json').read_text())['cuts']
    # **번호 순으로 정렬한다.** 파일명순으로 두면 sec266 이 sec26 앞에 와서
    # 시트가 컷 순서와 어긋난다 — 이어 붙인 흐름을 보려고 만든 시트인데
    # 순서가 틀리면 그 목적이 통째로 없어진다
    def num(f):
        m = re.match(r'sec(\d+)', f.name)
        return (int(m.group(1)) if m else 10 ** 9, f.name)
    stills = sorted((pdir / 'stills').glob('*.png'), key=num)
    if not stills:
        raise SystemExit('스틸이 없다 — render_parkside.py --still 먼저')

    CW, CH = a.w, int(a.w * 9 / 16)
    BAR = 42                                   # 컷 번호·카드 이름 줄
    PAD, GAP = 26, 14
    f1, f2 = font(21), font(17)

    sheets = []
    for s in range(0, len(stills), a.per):
        batch = stills[s:s + a.per]
        rows = (len(batch) + a.cols - 1) // a.cols
        W = PAD * 2 + a.cols * CW + (a.cols - 1) * GAP
        H = PAD * 2 + rows * (CH + BAR) + (rows - 1) * GAP
        sheet = Image.new('RGB', (W, H), (24, 25, 28))
        dr = ImageDraw.Draw(sheet)
        for i, f in enumerate(batch):
            r, c = divmod(i, a.cols)
            x = PAD + c * (CW + GAP)
            y = PAD + r * (CH + BAR + GAP)
            im = Image.open(f).convert('RGB').resize((CW, CH), Image.LANCZOS)
            sheet.paste(im, (x, y))
            m = re.search(r'sec(\d+)_', f.name)
            cid = str(int(m.group(1))) if m else '?'
            card, why = (design.get(cid) or ['?', ''])[:2]
            dr.text((x + 2, y + CH + 5), f'#{cid}  {card}', font=f1, fill=(238, 238, 238))
            dr.text((x + 2, y + CH + 25), why[:44], font=f2, fill=(150, 152, 158))
        out = pdir / f'검수시트_{s // a.per + 1}.png'
        sheet.save(out)
        sheets.append(out)
        print(f'  {out.name}  {len(batch)}컷  {W}×{H}')
    return sheets


if __name__ == '__main__':
    main()
