#!/usr/bin/env python3
"""레퍼런스 이미지에서 **디자인 규칙의 재료**를 뽑아낸다.

design_reference.md 는 지금까지 내가 프레임을 눈으로 보고 적어 온 문서다.
눈으로만 보면 두 가지를 놓친다 — (1) "이 회색이 몇 %인가" 같은 값,
(2) 30장 넘어가면 기억이 뭉개져서 **평균이 아니라 인상**을 적게 된다.
실제로 B1M 780프레임을 볼 때도 평탄도·채도·엣지밀도로 먼저 갈라 놓고서야
그래픽 판만 추려낼 수 있었다 (§32).

그래서 이 스크립트가 먼저 재고, 그 위에서 내가 규칙을 쓴다.
**측정과 해석을 섞지 않는다** — 여기서 나오는 건 전부 잰 값이고,
"그래서 이렇게 하자"는 문서 쪽에 쓴다.

재는 것
  팔레트      k-means(직접 구현) 6색 + 각 색 화면 점유율
  바탕        가장 넓은 색 · 밝기 · 이 판이 밝은판/먹판/중간 중 어디인지
  채도        평균/상위. 회색조인지 컬러인지
  엣지밀도    소벨 근사. 글자·도표가 많은 판일수록 높다
  잉크 무게   어두운(또는 밝은) 전경 픽셀이 화면 어디에 쏠려 있는지 — 3×3 격자
  여백        가장자리 12%가 비어 있는지 (B1M 은 늘 비운다)
  글자 띠     가로 줄 단위 엣지 프로파일에서 글자 줄로 보이는 띠의 y 위치
  가로세로비  16:9 가 아닌 소재가 섞여 있으면 잡아낸다

내는 것
  <out>/analysis.json   장별 측정값 + 무리(cluster) 배정
  <out>/sheet_NN.jpg    컨택트 시트 (번호·팔레트 띠를 같이 찍는다 — 눈으로 볼 것)
  <out>/summary.md      집계표. design_reference.md 에 붙일 초안의 재료

    python3 scripts/learn_refs.py <이미지폴더> --out refs/<이름> --name "데스크톱 레퍼런스"
"""
import argparse, colorsys, json, os, sys
import numpy as np
from PIL import Image, ImageDraw

EXT = ('.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tif', '.tiff')
W = 480                      # 분석 해상도. 이보다 크면 느리기만 하고 값은 안 변한다


# ── 팔레트 ────────────────────────────────────────────────────────────────
# sklearn 이 없는 환경이라 k-means 를 직접 돌린다. 색 6개면 20회로 충분히 는다.
def kmeans(px, k=6, iters=20, seed=0):
    rng = np.random.default_rng(seed)
    c = px[rng.choice(len(px), k, replace=False)].astype(np.float64)
    for _ in range(iters):
        d = ((px[:, None, :] - c[None, :, :]) ** 2).sum(2)
        lab = d.argmin(1)
        for j in range(k):
            m = lab == j
            if m.any():
                c[j] = px[m].mean(0)
    cnt = np.bincount(lab, minlength=k)
    order = np.argsort(-cnt)
    return c[order].astype(int), (cnt[order] / len(px))


def hexof(rgb):
    return '#%02X%02X%02X' % tuple(int(v) for v in rgb)


def sat_of(rgb):
    r, g, b = [v / 255 for v in rgb]
    return colorsys.rgb_to_hsv(r, g, b)[1]


def analyze(path):
    im = Image.open(path).convert('RGB')
    ow, oh = im.size
    im = im.resize((W, max(1, round(W * oh / ow))), Image.LANCZOS)
    a = np.asarray(im).astype(np.float64)
    h, w, _ = a.shape
    lum = a @ np.array([0.2126, 0.7152, 0.0722])

    # 팔레트 — 픽셀을 솎아서(4픽셀당 1) 돌린다. 값은 그대로다
    px = a.reshape(-1, 3)[::4]
    cent, share = kmeans(px, 6)
    pal = [{'hex': hexof(c), 'share': round(float(s), 4),
            'lum': round(float(c @ [0.2126, 0.7152, 0.0722]), 1),
            'sat': round(float(sat_of(c)), 3)}
           for c, s in zip(cent, share)]

    bg = pal[0]
    # 판의 성격 — 바탕 밝기로 가른다. 이 채널은 크림/먹/청사진 3종을 쓴다
    kind = ('밝은판' if bg['lum'] > 170 else
            '먹판' if bg['lum'] < 70 else '중간판')

    # 엣지밀도 — 소벨 근사(인접 차분). 글자·도표가 많을수록 높다
    gx = np.abs(np.diff(lum, axis=1))[:-1, :]
    gy = np.abs(np.diff(lum, axis=0))[:, :-1]
    edge = np.hypot(gx, gy)
    edge_d = float((edge > 28).mean())

    # 잉크 무게 — 바탕에서 먼 픽셀이 전경이다. 3×3 격자 분포로 배치를 읽는다
    ink = np.abs(lum - bg['lum']) > 46
    g = np.zeros((3, 3))
    for i in range(3):
        for j in range(3):
            g[i, j] = ink[i * h // 3:(i + 1) * h // 3,
                          j * w // 3:(j + 1) * w // 3].mean()
    gs = g.sum() or 1.0

    # 여백 — 가장자리 12% 띠에 전경이 얼마나 있는지. B1M 은 여기를 비운다
    m = max(1, int(min(h, w) * 0.12))
    edge_mask = np.ones_like(ink)
    edge_mask[m:-m, m:-m] = False
    margin_ink = float(ink[edge_mask].mean())

    # 글자 띠 — 가로 줄별 엣지량이 튀는 구간. 글자 줄이 몇 개이고 어디 있는지
    row = (edge > 28).mean(1)
    thr = row.mean() + row.std() * 0.6
    bands, run = [], None
    for y, v in enumerate(row > thr):
        if v and run is None:
            run = y
        elif not v and run is not None:
            if y - run >= 3:
                bands.append([round(run / h, 3), round(y / h, 3)])
            run = None
    if run is not None:
        bands.append([round(run / h, 3), round(len(row) / h, 3)])

    sat = np.array([sat_of(c) for c in cent])
    return {
        'file': os.path.basename(path),
        'size': [ow, oh],
        'aspect': round(ow / oh, 3),
        'palette': pal,
        'bg': bg['hex'], 'bg_lum': bg['lum'], 'bg_share': bg['share'],
        'kind': kind,
        'sat_mean': round(float((sat * share).sum()), 3),
        'sat_max': round(float(sat.max()), 3),
        'edge_density': round(edge_d, 4),
        'grid': [[round(float(x / gs), 3) for x in r] for r in g],
        'margin_ink': round(margin_ink, 4),
        'text_bands': bands[:8],
        'band_count': len(bands),
    }


# ── 무리 짓기 ─────────────────────────────────────────────────────────────
# 판의 성격(바탕 밝기) · 글자량(엣지밀도) · 컬러 여부(채도) 세 축이면
# "그래픽 판 / 실사 판 / 글자 판" 이 대체로 갈린다. 축을 늘리면 오히려 흐려진다.
def cluster(rows, k=4):
    X = np.array([[r['bg_lum'] / 255, r['edge_density'] * 4, r['sat_mean'] * 2]
                  for r in rows])
    if len(rows) <= k:
        for i, r in enumerate(rows):
            r['cluster'] = i
        return
    rng = np.random.default_rng(7)
    c = X[rng.choice(len(X), k, replace=False)]
    for _ in range(30):
        lab = ((X[:, None, :] - c[None, :, :]) ** 2).sum(2).argmin(1)
        for j in range(k):
            if (lab == j).any():
                c[j] = X[lab == j].mean(0)
    for r, l in zip(rows, lab):
        r['cluster'] = int(l)


def sheet(rows, src, out, per=12):
    """컨택트 시트 — 결국 눈으로 봐야 한다. 팔레트 띠를 같이 찍어 둔다."""
    TW, TH, cols = 380, 214, 3
    for p0 in range(0, len(rows), per):
        chunk = rows[p0:p0 + per]
        r_ = (len(chunk) + cols - 1) // cols
        c = Image.new('RGB', (cols * (TW + 8), r_ * (TH + 52)), (18, 18, 20))
        d = ImageDraw.Draw(c)
        for k, r in enumerate(chunk):
            im = Image.open(os.path.join(src, r['file'])).convert('RGB')
            im.thumbnail((TW, TH))
            rr, cc = divmod(k, cols)
            x, y = cc * (TW + 8) + 4, rr * (TH + 52) + 22
            c.paste(im, (x + (TW - im.width) // 2, y))
            d.text((x, y - 18), f"{p0 + k:02d}  {r['kind']}  "
                                f"엣지{r['edge_density']:.2f} 채도{r['sat_mean']:.2f}",
                   fill=(250, 255, 46))
            # 팔레트 띠 — 점유율만큼 폭을 준다
            bx = x
            for p in r['palette']:
                bw = max(2, int(TW * p['share']))
                d.rectangle([bx, y + im.height + 4, bx + bw, y + im.height + 20],
                            fill=tuple(int(p['hex'][i:i + 2], 16) for i in (1, 3, 5)))
                bx += bw
        c.save(os.path.join(out, f'sheet_{p0 // per:02d}.jpg'), quality=86)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('--out', required=True)
    ap.add_argument('--name', default='레퍼런스')
    a = ap.parse_args()

    files = sorted(f for f in os.listdir(a.src) if f.lower().endswith(EXT))
    if not files:
        print('이미지가 없다', file=sys.stderr)
        return 1
    os.makedirs(a.out, exist_ok=True)

    rows = []
    for i, f in enumerate(files, 1):
        try:
            rows.append(analyze(os.path.join(a.src, f)))
        except Exception as e:
            print(f'[건너뜀] {f}: {e}', file=sys.stderr)
        if i % 10 == 0 or i == len(files):
            print(f'재는 중 {i}/{len(files)}', file=sys.stderr)

    cluster(rows)
    json.dump({'name': a.name, 'n': len(rows), 'items': rows},
              open(os.path.join(a.out, 'analysis.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    sheet(rows, a.src, a.out)

    # ── 집계 ──
    kinds = {}
    for r in rows:
        kinds[r['kind']] = kinds.get(r['kind'], 0) + 1
    allpal = {}
    for r in rows:
        for p in r['palette']:
            key = tuple(int(p['hex'][i:i + 2], 16) // 24 for i in (1, 3, 5))
            allpal.setdefault(key, [0.0, []])
            allpal[key][0] += p['share']
            allpal[key][1].append(p['hex'])
    top = sorted(allpal.items(), key=lambda x: -x[1][0])[:10]

    L = [f'# {a.name} — 측정값 ({len(rows)}장)', '',
         '이 파일은 **잰 값만** 담는다. 해석과 규칙은 design_reference.md 로 간다.', '',
         '## 판의 성격', '', '| 종류 | 장수 | 비율 |', '|---|---:|---:|']
    for k, v in sorted(kinds.items(), key=lambda x: -x[1]):
        L.append(f'| {k} | {v} | {v / len(rows) * 100:.0f}% |')
    L += ['', '## 전체 팔레트 (점유율 합 기준 상위 10)', '',
          '| 색 | 누적 점유 | 밝기 |', '|---|---:|---:|']
    for _, (s, hx) in top:
        c = hx[0]
        lu = sum(int(c[i:i + 2], 16) * w_ for i, w_ in
                 zip((1, 3, 5), (0.2126, 0.7152, 0.0722)))
        L.append(f'| `{c}` | {s / len(rows) * 100:.1f}% | {lu:.0f} |')

    ed = sorted(r['edge_density'] for r in rows)
    sa = sorted(r['sat_mean'] for r in rows)
    mi = sorted(r['margin_ink'] for r in rows)
    bc = sorted(r['band_count'] for r in rows)

    def q(v, p):
        return v[int(len(v) * p)] if v else 0

    L += ['', '## 분포 (중앙값 · 사분위)', '',
          '| 항목 | 하위25% | 중앙 | 상위25% | 뜻 |', '|---|---:|---:|---:|---|',
          f'| 엣지밀도 | {q(ed,.25):.3f} | {q(ed,.5):.3f} | {q(ed,.75):.3f} | '
          '높을수록 글자·도표가 많은 판 |',
          f'| 채도 | {q(sa,.25):.3f} | {q(sa,.5):.3f} | {q(sa,.75):.3f} | '
          '0.1 아래면 사실상 회색조 |',
          f'| 가장자리 전경 | {q(mi,.25):.3f} | {q(mi,.5):.3f} | {q(mi,.75):.3f} | '
          '0 에 가까울수록 테두리를 비운다 |',
          f'| 글자 띠 수 | {q(bc,.25)} | {q(bc,.5)} | {q(bc,.75)} | '
          '한 판에 몇 줄을 얹는가 |', '']

    # 잉크 무게의 평균 분포 — 화면 어디에 내용을 두는가
    G = np.mean([r['grid'] for r in rows], axis=0)
    L += ['## 내용이 앉는 자리 (3×3 평균)', '', '```']
    for row in G:
        L.append('  ' + '  '.join(f'{v * 100:4.1f}%' for v in row))
    L += ['```', '',
          f'가로세로비: ' + ', '.join(
              f'{k}×{v}' for k, v in sorted(
                  {f"{r['aspect']:.2f}": sum(1 for x in rows
                                             if abs(x['aspect'] - r['aspect']) < .01)
                   for r in rows}.items(), key=lambda x: -x[1])[:4]), '',
          '## 무리', '']
    for cl in sorted({r['cluster'] for r in rows}):
        mem = [r for r in rows if r['cluster'] == cl]
        L.append(f"- **{cl}번** {len(mem)}장 · 바탕밝기 "
                 f"{np.mean([m['bg_lum'] for m in mem]):.0f} · 엣지 "
                 f"{np.mean([m['edge_density'] for m in mem]):.3f} · 채도 "
                 f"{np.mean([m['sat_mean'] for m in mem]):.3f}")
        L.append('  ' + ', '.join(m['file'] for m in mem[:8])
                 + (' …' if len(mem) > 8 else ''))

    open(os.path.join(a.out, 'summary.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')
    print(f"{len(rows)}장 → {a.out}/summary.md · sheet_*.jpg", file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
