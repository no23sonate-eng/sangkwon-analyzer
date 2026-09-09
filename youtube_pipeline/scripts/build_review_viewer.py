#!/usr/bin/env python3
"""컷 검수 뷰어 — 268컷을 한 장씩 크게 넘겨 보는 단일 HTML.

검수시트(24컷 한 판)는 인쇄해 놓고 훑기엔 좋지만, 화면 오른쪽 패널에서
보면 타일 하나가 620px 라 글자 크기·자간을 볼 수가 없다. 이건 그 반대다 —
한 번에 한 컷, 패널 폭을 꽉 채워서.

이미지는 WebP 로 줄여 data URI 로 심는다. 아티팩트는 외부 호스트에서
이미지를 못 불러오고(CSP), 이 계정엔 assets 기능이 없다. 16MB 상한 안에서
큰 판(1280px)과 필름스트립용 썸네일(176px)을 따로 굽는다 — 썸네일을 큰
판으로 대신하면 브라우저가 원본 크기로 디코딩해서 메모리가 터진다.

    python3 scripts/build_review_viewer.py 니시아자부
"""
import base64
import io
import json
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BIG_W, BIG_Q = 1280, 72
THUMB_W, THUMB_Q = 176, 58

PHOTO_CARDS = {
    'StageCard', 'ArchiveCard', 'PhotoSplitCard', 'FullBleedCard', 'MediaPlateCard',
    'PaperImageCard', 'SectionPhotoCard', 'AnnotatedShotCard', 'ArticleCard',
    'NewsHeadlineCard', 'BeforeAfterCard', 'PhotoStepsCard', 'TwoPanelCard',
    'SplitProofCard', 'MapCard', 'GeoMapCard',
}


def enc(im, w, q):
    im = im.convert('RGB').resize((w, round(w * 9 / 16)), Image.LANCZOS)
    b = io.BytesIO()
    im.save(b, 'WEBP', quality=q, method=4)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()


def mmss(sec):
    return f'{int(sec) // 60}:{int(sec) % 60:02d}'


def build(project):
    pdir = ROOT / 'projects' / project
    plan = json.loads((pdir / 'scene_plan.json').read_text(encoding='utf-8'))
    design = json.loads((pdir / 'design.json').read_text(encoding='utf-8'))['cuts']
    chapters = plan.get('chapters') or []
    scenes = {s['id']: s for s in plan['scenes']}

    stills = sorted((pdir / 'stills').glob('*.png'),
                    key=lambda f: int(re.match(r'sec(\d+)', f.name).group(1)))
    if not stills:
        sys.exit(f'{project}: stills 가 없다 — render_parkside.py --still 먼저')

    def chapter_of(start):
        for i, c in enumerate(chapters):
            if c['start'] <= start < c['end']:
                return i
        return max(0, len(chapters) - 1)

    frames, thumbs, meta = [], [], []
    for f in stills:
        sid = int(re.match(r'sec(\d+)', f.name).group(1))
        im = Image.open(f)
        frames.append(enc(im, BIG_W, BIG_Q))
        thumbs.append(enc(im, THUMB_W, THUMB_Q))

        sc = scenes.get(sid, {})
        dz = design.get(str(sid)) or ['', '', {}]
        props = dz[2] if len(dz) > 2 and isinstance(dz[2], dict) else {}
        blob = json.dumps(dz, ensure_ascii=False)
        has_media = bool(re.search(r'\.(jpg|jpeg|png|mp4)"', blob))
        kind = ('실사' if dz[0] in PHOTO_CARDS
                else '배경' if has_media else '그래픽')
        # 내레이션 첫 줄은 '3. 특징' 같은 장 표시라 본문과 나눠 둔다
        lines = [l for l in (sc.get('text') or '').split('\n') if l.strip()]
        head = (lines[0] if len(lines) > 1
                and (re.match(r'^\d+\.', lines[0]) or len(lines[0]) <= 14) else '')
        body = ' '.join(lines[1:] if head else lines)
        meta.append({
            'id': sid,
            'card': dz[0] or '—',
            'why': dz[1] or '',
            'head': head,
            'text': body,
            'ch': chapter_of(sc.get('start', 0)),
            'ts': mmss(sc.get('start', 0)),
            'dur': round(sc.get('dur', 0), 1),
            'kind': kind,
            'src': props.get('source', '') or '',
        })
        sys.stdout.write(f'\r  구움 {len(frames)}/{len(stills)}')
        sys.stdout.flush()
    print()

    chs = []
    for i, c in enumerate(chapters):
        ids = [m['id'] for m in meta if m['ch'] == i]
        chs.append({'name': c['name'], 'ts': c.get('ts', ''),
                    'first': ids[0] if ids else 0,
                    'span': (f"{ids[0]:03d}–{ids[-1]:03d}" if ids else '')})

    html = TEMPLATE.replace('__META__', json.dumps(meta, ensure_ascii=False)) \
                   .replace('__CHS__', json.dumps(chs, ensure_ascii=False)) \
                   .replace('__FRAMES__', json.dumps(frames)) \
                   .replace('__THUMBS__', json.dumps(thumbs)) \
                   .replace('__PROJECT__', project)
    out = pdir / '컷검수.html'
    out.write_text(html, encoding='utf-8')
    print(f'{out}  {out.stat().st_size / 1e6:.1f}MB  {len(meta)}컷')
    return out


TEMPLATE = r'''<title>니시아자부 컷 검수</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+KR:wght@300;400;500;600&display=swap">
<style>
/* 필름이 쓰는 팔레트 그대로 — paper.jsx 의 먹·종이·청사진·형광 */
:root{
  --ink:#242830; --paper:#EFEAE3; --blueprint:#16233A; --acid:#FAFF2E;
  --bg:#EFEAE3; --panel:#F6F3ED; --stage:#22262E;
  --fg:#242830; --muted:#6E6759; --rule:#D6CFC2; --chip:#E4DED2;
  --shadow:0 1px 0 rgba(36,40,48,.06), 0 12px 30px rgba(36,40,48,.10);
}
:root:not([data-theme="light"]){ @media (prefers-color-scheme: dark){
  --bg:#14181F; --panel:#1A1F28; --stage:#0D1015;
  --fg:#E7E3DA; --muted:#8B8677; --rule:#2C333F; --chip:#242B36;
  --shadow:0 1px 0 rgba(0,0,0,.4), 0 14px 34px rgba(0,0,0,.45);
}}
:root[data-theme="dark"]{
  --bg:#14181F; --panel:#1A1F28; --stage:#0D1015;
  --fg:#E7E3DA; --muted:#8B8677; --rule:#2C333F; --chip:#242B36;
  --shadow:0 1px 0 rgba(0,0,0,.4), 0 14px 34px rgba(0,0,0,.45);
}
*{box-sizing:border-box}
body{
  margin:0; background:var(--bg); color:var(--fg);
  font-family:"IBM Plex Sans KR", system-ui, -apple-system, sans-serif;
  font-weight:400; -webkit-font-smoothing:antialiased;
}
.mono{font-family:"IBM Plex Mono", ui-monospace, monospace; font-variant-numeric:tabular-nums}

/* ── 조작 막대 ───────────────────────────────────────────────────── */
.bar{
  position:sticky; top:0; z-index:20; background:var(--bg);
  border-bottom:1px solid var(--rule); padding:12px 18px 10px;
  display:flex; flex-direction:column; gap:10px;
}
.bar .row{display:flex; align-items:center; gap:12px; flex-wrap:wrap}
.no{font-size:26px; font-weight:600; letter-spacing:-.02em; line-height:1}
.no small{font-size:14px; font-weight:400; color:var(--muted); margin-left:2px}
.chap{
  font-size:13px; color:var(--muted); letter-spacing:.01em;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1 1 120px; min-width:0;
}
.nav{display:flex; gap:6px; margin-left:auto}
button{
  font:inherit; color:var(--fg); background:var(--panel);
  border:1px solid var(--rule); border-radius:2px; padding:6px 12px;
  cursor:pointer; line-height:1.2;
}
button:hover{background:var(--chip)}
button:focus-visible{outline:2px solid var(--acid); outline-offset:2px}
button[disabled]{opacity:.35; cursor:default}
.nav button{padding:6px 14px; font-size:15px}

input[type=range]{
  -webkit-appearance:none; appearance:none; width:100%; height:22px;
  background:transparent; cursor:pointer; margin:0;
}
input[type=range]::-webkit-slider-runnable-track{height:3px; background:var(--rule)}
input[type=range]::-moz-range-track{height:3px; background:var(--rule)}
input[type=range]::-webkit-slider-thumb{
  -webkit-appearance:none; width:13px; height:13px; margin-top:-5px;
  background:var(--acid); border:1.5px solid var(--ink); border-radius:50%;
}
input[type=range]::-moz-range-thumb{
  width:13px; height:13px; background:var(--acid);
  border:1.5px solid var(--ink); border-radius:50%;
}
input[type=range]:focus-visible{outline:2px solid var(--acid); outline-offset:3px}

/* ── 판 ─────────────────────────────────────────────────────────── */
.wrap{padding:16px 18px 40px; display:flex; flex-direction:column; gap:16px}
.stage{
  background:var(--stage); border:1px solid var(--rule);
  box-shadow:var(--shadow); line-height:0;
}
.stage img{width:100%; aspect-ratio:16/9; display:block; object-fit:cover}

.meta{display:flex; flex-direction:column; gap:14px}
.tags{display:flex; gap:8px; align-items:center; flex-wrap:wrap}
.tag{
  font-size:11.5px; letter-spacing:.06em;
  border:1px solid var(--rule); padding:3px 8px; color:var(--muted);
}
.tag:not(.mono){text-transform:uppercase}
.tag.kind{border-color:var(--fg); color:var(--fg)}
.narr{font-size:17px; line-height:1.62; letter-spacing:-.01em; max-width:62ch}
.narr .head{
  display:block; font-size:12px; letter-spacing:.08em; color:var(--muted);
  margin-bottom:6px; text-transform:none;
}
.why{
  font-size:13.5px; line-height:1.6; color:var(--muted); max-width:62ch;
  border-left:2px solid var(--rule); padding-left:12px;
}
.src{font-size:12px; color:var(--muted)}

/* ── 필름스트립 ─────────────────────────────────────────────────── */
.strip{
  display:flex; gap:6px; overflow-x:auto; padding:10px 0 12px;
  border-top:1px solid var(--rule); border-bottom:1px solid var(--rule);
  scrollbar-width:thin;
}
.strip figure{margin:0; flex:0 0 auto; cursor:pointer; position:relative}
.strip img{
  display:block; width:118px; aspect-ratio:16/9; object-fit:cover;
  border:1px solid var(--rule); opacity:.62; transition:opacity .12s;
}
.strip figure:hover img{opacity:1}
.strip figure[aria-current="true"] img{opacity:1; border-color:var(--fg)}
.strip figure[aria-current="true"]::after{
  content:""; position:absolute; left:0; right:0; bottom:-1px; height:3px; background:var(--acid);
}
.strip figcaption{
  font-family:"IBM Plex Mono", monospace; font-size:10px; color:var(--muted);
  text-align:center; padding-top:3px;
}

.chips{display:flex; flex-wrap:wrap; gap:6px}
.chips button{
  font-size:12.5px; padding:5px 10px; display:flex; gap:7px; align-items:center;
  text-align:left;
}
.chips button[aria-pressed="true"]{background:var(--ink); color:var(--paper); border-color:var(--ink)}
:root[data-theme="dark"] .chips button[aria-pressed="true"],
:root:not([data-theme="light"]) .chips button[aria-pressed="true"]{}
.chips .n{font-family:"IBM Plex Mono", monospace; font-size:11px; opacity:.62;
           font-variant-numeric:tabular-nums}
.filter{display:flex; gap:6px; align-items:center; flex-wrap:wrap}
.filter .lab{font-size:11.5px; letter-spacing:.06em; color:var(--muted); text-transform:uppercase}
.filter button[aria-pressed="true"]{border-color:var(--fg); background:var(--chip)}

h2{font-size:11.5px; letter-spacing:.09em; text-transform:uppercase;
   color:var(--muted); margin:0 0 8px; font-weight:500}
.hint{font-size:12px; color:var(--muted)}
kbd{
  font-family:"IBM Plex Mono", monospace; font-size:11px; border:1px solid var(--rule);
  border-bottom-width:2px; padding:1px 5px; margin:0 1px;
}

@media (min-width:1080px){
  .wrap{display:grid; grid-template-columns:minmax(0,1.55fr) minmax(280px,.95fr);
        gap:22px; align-items:start; padding:20px 26px 48px}
  .stage{grid-column:1}
  .meta{grid-column:2; grid-row:1 / span 2}
  .strip, .foot{grid-column:1}
}
@media (prefers-reduced-motion:reduce){*{transition:none !important}}
</style>

<div class="bar">
  <div class="row">
    <div class="no mono"><span id="cutNo">000</span><small id="cutTs">0:00</small></div>
    <div class="chap" id="chapName">—</div>
    <div class="nav">
      <button id="prev" aria-label="이전 컷">←</button>
      <button id="next" aria-label="다음 컷">→</button>
    </div>
  </div>
  <input type="range" id="scrub" min="0" max="0" value="0" aria-label="컷 이동">
</div>

<div class="wrap">
  <div class="stage"><img id="frame" alt="" decoding="async"></div>

  <div class="meta">
    <div class="tags">
      <span class="tag kind" id="kind">그래픽</span>
      <span class="tag mono" id="card">Card</span>
      <span class="tag mono" id="dur">0.0s</span>
    </div>
    <p class="narr" id="narr"></p>
    <p class="why" id="why"></p>
    <p class="src" id="src"></p>
  </div>

  <div class="strip" id="strip"></div>

  <div class="foot">
    <p class="hint" style="margin:0 0 14px"><kbd>←</kbd><kbd>→</kbd> 컷 이동 · <kbd>Home</kbd><kbd>End</kbd> 처음·끝 · 아래 칩으로 장 건너뛰기</p>
    <div class="filter" style="margin-bottom:16px">
      <span class="lab">보기</span>
      <button data-f="all" aria-pressed="true">전체</button>
      <button data-f="실사" aria-pressed="false">실사</button>
      <button data-f="배경" aria-pressed="false">배경 깔린 판</button>
      <button data-f="그래픽" aria-pressed="false">글자·도형만</button>
    </div>
    <h2>장</h2>
    <div class="chips" id="chips"></div>
  </div>
</div>

<script>
const META = __META__;
const CHS = __CHS__;
const FRAMES = __FRAMES__;
const THUMBS = __THUMBS__;

const $ = (id) => document.getElementById(id);
let i = 0;
let filter = 'all';

const pool = () => filter === 'all' ? META.map((_, k) => k)
                                    : META.map((_, k) => k).filter((k) => META[k].kind === filter);

function go(n) {
  i = Math.max(0, Math.min(META.length - 1, n));
  render();
}
function step(d) {
  const p = pool();
  if (!p.length) return;
  const at = p.indexOf(i);
  if (at === -1) { go(p.reduce((b, k) => Math.abs(k - i) < Math.abs(b - i) ? k : b, p[0])); return; }
  go(p[Math.max(0, Math.min(p.length - 1, at + d))]);
}

// 필름스트립은 현재 컷 둘레만 붙인다. 268장을 다 붙이면 브라우저가
// 원본 크기로 디코딩해서 탭이 먹는다
function strip() {
  const el = $('strip');
  const p = pool();
  const at = Math.max(0, p.indexOf(i));
  const win = p.slice(Math.max(0, at - 14), at + 15);
  el.innerHTML = '';
  for (const k of win) {
    const fig = document.createElement('figure');
    fig.setAttribute('aria-current', k === i ? 'true' : 'false');
    fig.tabIndex = 0;
    const img = new Image();
    img.src = THUMBS[k]; img.alt = '컷 ' + META[k].id; img.decoding = 'async';
    const cap = document.createElement('figcaption');
    cap.textContent = String(META[k].id).padStart(3, '0');
    fig.append(img, cap);
    fig.addEventListener('click', () => go(k));
    fig.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(k); } });
    el.append(fig);
  }
  const cur = el.querySelector('[aria-current="true"]');
  if (cur) cur.scrollIntoView({block: 'nearest', inline: 'center'});
}

function render() {
  const m = META[i];
  $('frame').src = FRAMES[i];
  $('frame').alt = '컷 ' + m.id + ' — ' + m.card;
  $('cutNo').textContent = String(m.id).padStart(3, '0');
  $('cutTs').textContent = ' ' + m.ts;
  const c = CHS[m.ch];
  $('chapName').textContent = c ? c.name : '';
  $('kind').textContent = m.kind;
  $('card').textContent = m.card;
  $('dur').textContent = m.dur.toFixed(1) + 's';
  $('narr').innerHTML = (m.head ? '<span class="head">' + m.head + '</span>' : '') + esc(m.text);
  $('why').textContent = m.why;
  $('src').textContent = m.src ? 'Source : ' + m.src : '';
  $('scrub').value = i;
  const p = pool();
  $('prev').disabled = p.indexOf(i) <= 0;
  $('next').disabled = p.indexOf(i) === p.length - 1;
  for (const b of document.querySelectorAll('#chips button'))
    b.setAttribute('aria-pressed', String(+b.dataset.ch === m.ch));
  strip();
  // 다음·이전 판을 미리 물려 둔다 — 넘길 때 흰 칸이 안 보이게
  for (const k of [i + 1, i - 1]) if (FRAMES[k]) { const im = new Image(); im.src = FRAMES[k]; }
}
function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

// 장 칩
$('chips').innerHTML = CHS.map((c, k) =>
  '<button data-ch="' + k + '" aria-pressed="false"><span class="n">' +
  esc(c.span) + '</span>' + esc(c.name) + '</button>').join('');
for (const b of document.querySelectorAll('#chips button'))
  b.addEventListener('click', () => go(CHS[+b.dataset.ch].first));

for (const b of document.querySelectorAll('.filter button'))
  b.addEventListener('click', () => {
    filter = b.dataset.f;
    for (const o of document.querySelectorAll('.filter button'))
      o.setAttribute('aria-pressed', String(o === b));
    step(0);
  });

$('prev').addEventListener('click', () => step(-1));
$('next').addEventListener('click', () => step(1));
$('scrub').max = META.length - 1;
$('scrub').addEventListener('input', (e) => go(+e.target.value));
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  else if (e.key === 'Home') { e.preventDefault(); go(0); }
  else if (e.key === 'End') { e.preventDefault(); go(META.length - 1); }
});

render();
</script>
'''

if __name__ == '__main__':
    build(sys.argv[1] if len(sys.argv) > 1 else '니시아자부')
