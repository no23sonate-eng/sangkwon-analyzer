#!/usr/bin/env python3
"""검수 페이지를 만든다 — 스틸 + 나레이션 + 설계 이유를 한 화면에.

컷 이미지를 하나씩 대화에 올리면 **보면서 고칠 수가 없다.** 스크롤을 올려
그림을 찾고, 내려와서 번호를 적고, 다시 올라간다. 옆에 띄워 놓고 짚는
물건이 따로 있어야 한다.

이 페이지가 하는 일:
  · 컷마다 스틸 · 나레이션 · 카드 · 설계 이유를 같이 보여 준다
  · 고칠 컷을 **체크해서 `#13, #15, #55` 로 복사** — 그대로 붙여넣으면 된다
  · 장(章)으로 건너뛰고, 카드 종류로 거르고, 나레이션을 검색한다

이미지는 data URI 로 박는다. 아티팩트는 외부 호스트를 못 부르고,
로컬 경로는 열리지 않는다. 16MB 안에 들어가야 해서 폭과 품질을 재 본 뒤
정한다. 182컷이 다 나오면서 1280px q78 이 14.9MB 가 됐다 — 16MB 상한에
너무 붙는다. 1120px q74 로 내린다 (→ 약 11MB). 검수는 배치와 글자 크기를
보는 일이라 이 해상도로 충분하다.

  python3 scripts/build_review_page.py 더그랜드롯데
"""
import argparse
import base64
import html
import io
import json
import pathlib
import re

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
W, Q = 1120, 74

CSS = """
:root{
  /* 작품이 크림·먹·노랑이라 갤러리 자체는 중성 암실로 둔다.
     여기서 색을 쓰면 컷 색이 안 믿긴다 */
  --bg:#F2F1EE; --panel:#FFFFFF; --line:#DCDAD5; --line-2:#C9C6C0;
  --text:#1A1D22; --muted:#6B7280; --dim:#9AA0A8;
  --accent:#B8BC00;            /* 밝은 바탕에서 채널 옐로는 안 읽힌다 — 톤을 내린다 */
  --chip-bg:#1A1D22; --chip-fg:#FAFF2E;
  --mark:#FAFF2E;
  --shadow:0 1px 2px rgba(26,29,34,.06),0 8px 24px rgba(26,29,34,.08);
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --bg:#14161A; --panel:#1B1E24; --line:#2A2F37; --line-2:#3A4049;
    --text:#E8EAEE; --muted:#8D95A2; --dim:#6B7280;
    --accent:#FAFF2E;
    --chip-bg:#FAFF2E; --chip-fg:#14161A;
    --mark:#FAFF2E;
    --shadow:0 1px 2px rgba(0,0,0,.4),0 10px 30px rgba(0,0,0,.45);
  }
}
:root[data-theme="dark"]{
  --bg:#14161A; --panel:#1B1E24; --line:#2A2F37; --line-2:#3A4049;
  --text:#E8EAEE; --muted:#8D95A2; --dim:#6B7280;
  --accent:#FAFF2E;
  --chip-bg:#FAFF2E; --chip-fg:#14161A;
  --mark:#FAFF2E;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 10px 30px rgba(0,0,0,.45);
}

*{box-sizing:border-box}
body{
  margin:0; background:var(--bg); color:var(--text);
  font-family:'IBM Plex Sans KR','IBM Plex Sans',system-ui,-apple-system,sans-serif;
  font-size:15px; line-height:1.6; word-break:keep-all;
}
.mono{font-family:'IBM Plex Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}

/* ── 상단 고정 바 ── */
header{
  position:sticky; top:0; z-index:30; background:var(--bg);
  border-bottom:1px solid var(--line); padding:14px 20px 12px;
}
.title{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.title h1{margin:0;font-size:19px;font-weight:600;letter-spacing:-.01em}
.title .meta{font-size:13px;color:var(--muted)}
.tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
input[type=search]{
  flex:1 1 190px; min-width:150px; padding:7px 11px; font:inherit; font-size:14px;
  background:var(--panel); color:var(--text);
  border:1px solid var(--line); border-radius:2px;
}
input[type=search]:focus-visible,button:focus-visible,a:focus-visible{
  outline:2px solid var(--accent); outline-offset:2px;
}
button{
  padding:7px 12px; font:inherit; font-size:13px; cursor:pointer;
  background:var(--panel); color:var(--text);
  border:1px solid var(--line); border-radius:2px;
}
button:hover{border-color:var(--line-2)}
button.primary{background:var(--chip-bg); color:var(--chip-fg); border-color:var(--chip-bg); font-weight:600}
button.primary[disabled]{opacity:.4; cursor:default}

/* 장 이동 */
nav.acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
nav.acts a{
  font-size:12.5px; text-decoration:none; color:var(--muted);
  padding:4px 9px; border:1px solid var(--line); border-radius:2px;
}
nav.acts a:hover{color:var(--text);border-color:var(--line-2)}

/* ── 컷 그리드 ── */
main{padding:20px; display:grid; gap:20px;
     grid-template-columns:repeat(auto-fill,minmax(340px,1fr))}
h2.act{
  grid-column:1/-1; margin:22px 0 0; font-size:13px; font-weight:600;
  letter-spacing:.14em; color:var(--muted); text-transform:uppercase;
  padding-bottom:8px; border-bottom:1px solid var(--line);
}
h2.act:first-of-type{margin-top:0}

figure{
  margin:0; background:var(--panel); border:1px solid var(--line);
  border-radius:2px; overflow:hidden; box-shadow:var(--shadow);
  display:flex; flex-direction:column;
}
figure.marked{border-color:var(--mark); box-shadow:0 0 0 2px var(--mark)}
.shot{position:relative; display:block; width:100%; border:0; padding:0;
      background:#0B0C0E; cursor:zoom-in; line-height:0}
.shot img,.shot video{width:100%; height:auto; display:block}
.shot .play{
  position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
  width:52px; height:52px; border-radius:50%; display:grid; place-items:center;
  background:rgba(11,12,14,.62); color:#fff; font-size:17px; padding-left:3px;
  pointer-events:none; transition:opacity .15s;
}
.shot.playing .play{opacity:0}
.no{
  position:absolute; left:0; top:0; padding:4px 9px;
  background:var(--chip-bg); color:var(--chip-fg);
  font-size:12.5px; font-weight:600; letter-spacing:.04em;
}
.ts{
  position:absolute; right:0; top:0; padding:4px 9px;
  background:rgba(11,12,14,.72); color:#E8EAEE; font-size:12px;
}
figcaption{padding:12px 14px 14px; display:flex; flex-direction:column; gap:7px}
.line{font-size:14.5px; line-height:1.5}
.why{font-size:12.5px; color:var(--muted)}
.foot{display:flex; align-items:center; justify-content:space-between; gap:10px;
      margin-top:2px; padding-top:9px; border-top:1px solid var(--line)}
.card{font-size:12px; color:var(--dim); letter-spacing:.02em}
label.pick{display:flex; align-items:center; gap:6px; font-size:12.5px;
           color:var(--muted); cursor:pointer; user-select:none; white-space:nowrap}
label.pick input{accent-color:var(--accent); width:15px; height:15px; cursor:pointer}

/* ── 확대 ── */
dialog{
  border:0; padding:0; background:transparent; max-width:96vw; max-height:96vh;
}
dialog::backdrop{background:rgba(8,9,11,.9)}
dialog img{max-width:96vw; max-height:88vh; display:block; border-radius:2px}
dialog .bar{display:flex; justify-content:space-between; align-items:center;
            gap:12px; padding:8px 2px; color:#E8EAEE; font-size:13px}

.empty{grid-column:1/-1; padding:48px 0; text-align:center; color:var(--muted)}

@media (max-width:560px){
  main{grid-template-columns:1fr; padding:14px; gap:14px}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
"""

JS = """
const figs = [...document.querySelectorAll('figure')];
const KEY = 'grandlotte-picks';
let picks = new Set();
try { picks = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) {}

const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...picks])); } catch (e) {} };
const sorted = () => [...picks].sort((a, b) => a - b);

const countEl = document.getElementById('count');
const copyBtn = document.getElementById('copy');
const clearBtn = document.getElementById('clear');

function refresh() {
  figs.forEach((f) => {
    const on = picks.has(+f.dataset.id);
    f.classList.toggle('marked', on);
    f.querySelector('input[type=checkbox]').checked = on;
  });
  const n = picks.size;
  countEl.textContent = n ? `고칠 컷 ${n}개` : '고칠 컷을 체크하세요';
  copyBtn.disabled = !n;
  clearBtn.disabled = !n;
}

figs.forEach((f) => {
  f.querySelector('input[type=checkbox]').addEventListener('change', (e) => {
    const id = +f.dataset.id;
    e.target.checked ? picks.add(id) : picks.delete(id);
    save(); refresh();
  });
});

copyBtn.addEventListener('click', async () => {
  const txt = sorted().map((n) => '#' + n).join(', ');
  try { await navigator.clipboard.writeText(txt); copyBtn.textContent = '복사됨'; }
  catch (e) { copyBtn.textContent = txt; }
  setTimeout(() => { copyBtn.textContent = '번호 복사'; }, 1400);
});
clearBtn.addEventListener('click', () => { picks.clear(); save(); refresh(); });

// 검색 — 나레이션·카드 이름·컷 번호
const q = document.getElementById('q');
q.addEventListener('input', () => {
  const s = q.value.trim().toLowerCase();
  let shown = 0;
  figs.forEach((f) => {
    const hit = !s || f.dataset.find.includes(s);
    f.style.display = hit ? '' : 'none';
    if (hit) shown++;
  });
  document.querySelectorAll('h2.act').forEach((h) => {
    let el = h.nextElementSibling, any = false;
    while (el && el.tagName === 'FIGURE') { if (el.style.display !== 'none') any = true; el = el.nextElementSibling; }
    h.style.display = any ? '' : 'none';
  });
  document.getElementById('empty').style.display = shown ? 'none' : '';
});

// 확대
const dlg = document.getElementById('zoom');
const dimg = document.getElementById('zoomimg');
const dcap = document.getElementById('zoomcap');
document.querySelectorAll('.shot').forEach((b) => {
  const v = b.querySelector('video');
  if (v) {
    // 한 번에 하나만 돈다 — 182개가 같이 돌면 탭이 멈춘다
    b.addEventListener('click', () => {
      document.querySelectorAll('.shot video').forEach((o) => {
        if (o !== v) { o.pause(); o.closest('.shot').classList.remove('playing'); }
      });
      if (v.paused) { v.currentTime = 0; v.play(); b.classList.add('playing'); }
      else { v.pause(); b.classList.remove('playing'); }
    });
    return;                       // 영상 컷은 확대 대신 재생
  }
  b.addEventListener('click', () => {
    const f = b.closest('figure');
    dimg.src = f.querySelector('img').src;
    dimg.alt = f.querySelector('img').alt;
    dcap.textContent = '#' + f.dataset.id + '  ' + f.dataset.ts + '  ' + f.dataset.card;
    dlg.showModal();
  });
});
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
document.getElementById('zclose').addEventListener('click', () => dlg.close());

refresh();
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--video', action='store_true',
                    help='스틸 대신 미리보기 영상을 박는다 (모션까지 검수)')
    ap.add_argument('project')
    ap.add_argument('--out', default=None)
    a = ap.parse_args()

    pdir = ROOT / 'projects' / a.project
    design = json.loads((pdir / 'design.json').read_text())['cuts']
    plan = {e['id']: e for e in json.loads((pdir / 'scene_plan.json').read_text())['scenes']}

    acts = {1: '후크 · 객실 수의 의미', 2: '이 자리의 역사', 3: '리뉴얼을 뜯어봅니다',
            4: '서울 도심 격전지', 5: '결론'}

    video = a.video
    # `컷/` 은 name_stills 가 `000_0m00s_카드.png` 로 다시 이름 붙인 것이고
    # 미리보기 영상은 렌더 원본 이름(`sec00_cut01.mp4`)이다. 컷 번호로 잇는다
    previews = {}
    if video:
        for v in (pdir / '검수영상').glob('sec*.mp4'):
            previews[int(re.match(r'sec(\d+)_', v.name).group(1))] = v

    def media(r):
        if not r['vid']:
            return (f'<img loading="lazy" src="data:image/jpeg;base64,{r["b64"]}" '
                    f'alt="컷 {r["id"]}">')
        # 182개를 한꺼번에 자동재생하면 브라우저가 죽는다. 눌러야 돈다.
        # poster 는 안 준다 — 첫 프레임이 그대로 정지 화면이 되고, 스틸을
        # 따로 박으면 컷마다 바이트가 두 배가 되어 16MB 를 넘는다
        return (f'<video class="mv" preload="metadata" muted playsinline loop '
                f'src="data:video/mp4;base64,{r["vid"]}"></video>'
                f'<span class="play" aria-hidden="true">▶</span>')

    rows = []
    for f in sorted((pdir / '컷').glob('*.png')):
        i = int(re.match(r'(\d+)_', f.name).group(1))
        e = plan.get(i, {})
        card, why = (design.get(str(i)) or ['?', ''])[:2]
        t = int(e.get('start', 0))
        # 모션 검수 모드 — 같은 이름의 미리보기 영상이 있으면 그걸 박는다.
        # 정지 화면으로는 형광펜이 언제 그어지는지, 숫자가 굴러 오르는지가 안 보인다
        mp4 = previews.get(i)
        if mp4 is not None and mp4.exists():
            vid = base64.b64encode(mp4.read_bytes()).decode()
        else:
            vid = ''
        im = Image.open(f).convert('RGB')
        im.thumbnail((W, W))
        buf = io.BytesIO()
        im.save(buf, 'JPEG', quality=Q, optimize=True)
        rows.append({
            'id': i, 'card': card, 'why': why,
            'ts': f'{t // 60}:{t % 60:02d}',
            'act': e.get('act', 1),
            'text': ' '.join(str(e.get('text', '')).split()),
            'b64': base64.b64encode(buf.getvalue()).decode(),
            'vid': vid,
        })

    parts = []
    last_act = None
    for r in rows:
        if r['act'] != last_act:
            last_act = r['act']
            parts.append(f'<h2 class="act" id="act{last_act}">'
                         f'{last_act}장 · {html.escape(acts.get(last_act, ""))}</h2>')
        find = f"#{r['id']} {r['card']} {r['text']} {r['why']}".lower()
        parts.append(f"""
<figure data-id="{r['id']}" data-ts="{r['ts']}" data-card="{html.escape(r['card'])}"
        data-find="{html.escape(find, quote=True)}">
  <button class="shot" aria-label="#{r['id']} 크게 보기">
    {media(r)}
    <span class="no mono">#{r['id']}</span>
    <span class="ts mono">{r['ts']}</span>
  </button>
  <figcaption>
    <p class="line">{html.escape(r['text']) or '<span class="why">(나레이션 없음)</span>'}</p>
    <p class="why">{html.escape(r['why'])}</p>
    <div class="foot">
      <span class="card mono">{html.escape(r['card'])}</span>
      <label class="pick"><input type="checkbox"> 고칠 컷</label>
    </div>
  </figcaption>
</figure>""")

    nav = ' '.join(f'<a href="#act{k}">{k}장 {html.escape(v)}</a>' for k, v in acts.items())
    total = json.loads((pdir / 'scene_plan.json').read_text())['scenes'][-1]['end']

    doc = f"""<title>더그랜드롯데 컷 검수</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans+KR:wght@400;500;600&display=swap">
<style>{CSS}</style>

<header>
  <div class="title">
    <h1>더그랜드롯데 서울 — 컷 검수</h1>
    <span class="meta mono">{len(rows)}컷 · 전체 182컷 · {int(total) // 60}분 {int(total) % 60}초</span>
  </div>
  <div class="tools">
    <input type="search" id="q" placeholder="나레이션·카드·컷 번호 검색" aria-label="검색">
    <span class="meta mono" id="count">고칠 컷을 체크하세요</span>
    <button class="primary" id="copy" disabled>번호 복사</button>
    <button id="clear" disabled>해제</button>
  </div>
  <nav class="acts">{nav}</nav>
</header>

<main>
{''.join(parts)}
<p class="empty" id="empty" style="display:none">찾는 컷이 없습니다.</p>
</main>

<dialog id="zoom">
  <div class="bar"><span class="mono" id="zoomcap"></span><button id="zclose">닫기</button></div>
  <img id="zoomimg" alt="">
</dialog>

<script>{JS}</script>
"""
    out = pathlib.Path(a.out) if a.out else pdir / '검수.html'
    out.write_text(doc, encoding='utf-8')
    print(f'{len(rows)}컷 → {out}  ({out.stat().st_size / 1e6:.1f}MB)')


if __name__ == '__main__':
    main()
