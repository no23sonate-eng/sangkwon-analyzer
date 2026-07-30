#!/usr/bin/env python3
"""⑤ 리뷰 갤러리 — output.mp4 전체를 다시 돌려보지 않고, 구간(카드)별
대표 프레임 + 설명을 한 페이지에 나열해서 "몇 번 카드를 바꿔달라"는
식으로 피드백하기 쉽게 만든다(2026-07-29, 사용자 요청: "차라리 모든
장표를 나열해서 보여줘").

selections.json 의 각 section 에서 대표 프레임 1장을 뽑아
review_gallery.html 로 저장한다. 실제 재생 여부 확인은 여전히
output.mp4 로 하고, 이 페이지는 "어떤 구간을 바꿀지 짚는" 용도.

CLI:
  python3 -m pipeline.review_gallery <프로젝트명>
"""

from __future__ import annotations

import argparse
import base64
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402

log = common.get_logger("review_gallery")

FONT_DIR = common.ROOT_DIR / "assets" / "fonts"


def _font_face_css() -> str:
    faces = [("A2Z Light", "A2Z-3Light.ttf"), ("A2Z Regular", "A2Z-4Regular.ttf"),
             ("A2Z Medium", "A2Z-5Medium.ttf")]
    out = []
    for fam, fname in faces:
        p = FONT_DIR / fname
        if not p.exists():
            continue
        b64 = base64.b64encode(p.read_bytes()).decode("ascii")
        out.append(f"@font-face{{font-family:'{fam}';src:url(data:font/truetype;base64,{b64}) format('truetype');}}")
    return "\n".join(out)


def _extract_frame(video: Path, timestamp: float, out: Path, width: int = 480) -> bool:
    cmd = ["ffmpeg", "-y", "-ss", f"{timestamp:.3f}", "-i", str(video),
           "-frames:v", "1", "-vf", f"scale={width}:-1", str(out), "-loglevel", "error"]
    return subprocess.run(cmd).returncode == 0


# 그리드용 썸네일은 작게(480px, 빠른 로딩), 클릭해서 확대할 때는 실제
# 디테일(텍스트/사진 화질)을 제대로 볼 수 있게 더 큰 해상도(1280px)로
# 따로 뽑아 라이트박스에 쓴다(2026-07-30 "클릭하면 이미지 커져서 제대로
# 확인할 수 있게" 피드백).
LIGHTBOX_WIDTH = 1280


TYPE_LABEL = {"remotion": ("그래픽", "graphic"), "prnewswire": ("실사", "photo"),
              "pexels": ("실사", "photo"), "wikimedia": ("실사", "photo")}


def _fmt_t(sec: float) -> str:
    m, s = divmod(sec, 60)
    return f"{int(m)}:{s:04.1f}"


def build(project: common.Project) -> Path:
    selections = common.read_json(project.path / "selections.json")
    broll_plan = common.read_json(project.path / "broll_plan.json") if (project.path / "broll_plan.json").exists() else None
    reasons = {}
    if broll_plan:
        for s in broll_plan.get("sections", []):
            reasons[s["id"]] = s.get("reason", "")

    output = project.path / "output.mp4"
    if not output.exists():
        raise FileNotFoundError(f"{output} 없음 — 먼저 render.py 를 돌려서 output.mp4 를 만들 것")

    thumbs_dir = project.path / "_review_thumbs"
    thumbs_dir.mkdir(exist_ok=True)

    cards = []
    for sec in selections["sections"]:
        sid = sec["id"]
        start, end = sec["start"], sec["end"]
        dur = end - start
        mid = start + min(dur - 0.3, max(dur * 0.75, 0.1))
        thumb = thumbs_dir / f"sec{sid}.jpg"
        full = thumbs_dir / f"sec{sid}_full.jpg"
        ok = _extract_frame(output, mid, thumb)
        ok_full = _extract_frame(output, mid, full, width=LIGHTBOX_WIDTH)
        source = sec["choice"].get("source", "")
        label, kind = TYPE_LABEL.get(source, (source or "?", "graphic"))
        cards.append({
            "id": sid, "start": start, "end": end, "dur": dur,
            "text": sec.get("text", ""), "reason": reasons.get(sid, ""),
            "label": label, "kind": kind, "thumb": thumb if ok else None,
            "full": full if ok_full else (thumb if ok else None),
        })

    total_dur = selections["sections"][-1]["end"] if selections["sections"] else 0

    def _img_data_uri(p: Path | None) -> str:
        if not p or not p.exists():
            return ""
        return "data:image/jpeg;base64," + base64.b64encode(p.read_bytes()).decode("ascii")

    tiles = []
    lightbox_data = []
    for c in cards:
        chip_class = "chip-graphic" if c["kind"] == "graphic" else "chip-photo"
        reason_html = c["reason"].replace("&", "&amp;").replace("<", "&lt;")
        text_html = c["text"].replace("&", "&amp;").replace("<", "&lt;")
        img = _img_data_uri(c["thumb"])
        full_img = _img_data_uri(c["full"])
        lightbox_data.append({
            "id": c["id"], "full": full_img,
            "caption": f"#{c['id']} · {_fmt_t(c['start'])}–{_fmt_t(c['end'])} ({c['dur']:.1f}s) · {c['label']}",
            "reason": c["reason"], "text": c["text"],
        })
        tiles.append(f"""
        <article class="tile" onclick="openLightbox({c['id']})">
          <div class="thumb">
            {f'<img src="{img}" alt="section {c["id"]} thumbnail" loading="lazy">' if img else '<div class="thumb-missing">프레임 추출 실패</div>'}
            <span class="badge">#{c['id']}</span>
            <span class="chip {chip_class}">{c['label']}</span>
          </div>
          <div class="meta">
            <div class="time">{_fmt_t(c['start'])} – {_fmt_t(c['end'])} <span class="dur">({c['dur']:.1f}s)</span></div>
            <p class="reason" title="{reason_html}">{reason_html or '—'}</p>
            <p class="text">{text_html}</p>
          </div>
        </article>""")

    lightbox_json = json.dumps(lightbox_data, ensure_ascii=False).replace("</script>", "<\\/script>")

    html = f"""<!doctype html>
<html lang="ko"><head>
<meta charset="utf-8">
<title>{project.name} — 리뷰 갤러리</title>
<style>
{_font_face_css()}
*{{box-sizing:border-box;margin:0;padding:0;}}
:root{{
  --bg:#101317; --bg-soft:#0c0e12; --panel:#191c21; --panel-hover:#212530; --border:rgba(255,255,255,.08);
  --border-soft:rgba(255,255,255,.05); --border-strong:rgba(255,255,255,.16);
  --text:#edeff3; --text-dim:#8d96a0; --text-faint:#5c636b; --text-ghost:#3e434b;
  --accent:#8e939d; --chip-graphic:#7b9bc2; --chip-photo:#c98a9e;
  --radius:12px; --radius-sm:8px;
  --ease:cubic-bezier(.2,.7,.3,1);
}}
html{{background:var(--bg);}}
html,body{{color:var(--text);font-family:'A2Z Regular',sans-serif;
  font-variant-numeric:tabular-nums;min-height:100%;-webkit-font-smoothing:antialiased;}}
body{{background:radial-gradient(ellipse 1200px 600px at 50% -10%,rgba(123,155,194,.05),transparent),var(--bg);
  padding:0 0 96px;}}
header{{position:sticky;top:0;z-index:5;background:linear-gradient(180deg,var(--bg) 74%,transparent);
  padding:40px 48px 22px;display:flex;flex-direction:column;gap:10px;
  border-bottom:1px solid transparent;}}
h1{{font-family:'A2Z Medium',sans-serif;font-size:28px;font-weight:400;letter-spacing:.005em;text-wrap:balance;}}
.sub{{color:var(--text-dim);font-size:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  letter-spacing:.01em;}}
.sub .dot{{width:3px;height:3px;border-radius:50%;background:var(--text-ghost);}}
.hint{{color:var(--text-faint);font-size:12.5px;font-family:'A2Z Light',sans-serif;margin-top:2px;
  letter-spacing:.01em;padding-top:14px;border-top:1px solid var(--border-soft);}}
.hint b{{color:var(--accent);font-family:'A2Z Regular',sans-serif;}}
main{{padding:14px 48px 0;}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:28px 24px;}}
.tile{{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;
  transition:transform .22s var(--ease),box-shadow .22s var(--ease),border-color .22s var(--ease),background .22s var(--ease);
  cursor:zoom-in;box-shadow:0 1px 2px rgba(0,0,0,.2);}}
.tile:hover{{background:var(--panel-hover);border-color:var(--border-strong);
  transform:translateY(-3px);box-shadow:0 16px 32px -12px rgba(0,0,0,.55);}}
.tile:hover .thumb img{{transform:scale(1.035);}}
.thumb{{position:relative;aspect-ratio:16/9;background:var(--bg-soft);overflow:hidden;}}
.thumb img{{width:100%;height:100%;object-fit:cover;display:block;
  transition:transform .4s var(--ease);}}
.thumb::after{{content:"";position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(5,7,10,.32) 0%,transparent 22%,transparent 78%,rgba(5,7,10,.4) 100%);
  pointer-events:none;}}
.thumb-missing{{display:flex;align-items:center;justify-content:center;height:100%;
  color:var(--text-faint);font-size:13px;}}
.badge{{position:absolute;top:12px;left:12px;z-index:1;background:rgba(9,11,14,.82);color:var(--text);
  font-size:12.5px;padding:4px 10px;border-radius:20px;border:1px solid rgba(255,255,255,.14);
  font-variant-numeric:tabular-nums;letter-spacing:.03em;backdrop-filter:blur(6px);
  font-family:'A2Z Medium',sans-serif;}}
.chip{{position:absolute;top:12px;right:12px;z-index:1;font-size:11px;padding:4px 11px;border-radius:20px;
  color:#0c0e11;font-family:'A2Z Medium',sans-serif;letter-spacing:.04em;}}
.chip-graphic{{background:var(--chip-graphic);}}
.chip-photo{{background:var(--chip-photo);}}
.meta{{padding:18px 18px 20px;display:flex;flex-direction:column;gap:9px;}}
.time{{font-size:12.5px;color:var(--text-faint);letter-spacing:.04em;
  display:flex;align-items:center;gap:8px;}}
.time .dur{{color:var(--text-ghost);}}
.reason{{font-size:15.5px;color:var(--text);line-height:1.5;font-family:'A2Z Regular',sans-serif;
  letter-spacing:.002em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}}
.text{{font-size:12.5px;color:var(--text-faint);font-family:'A2Z Light',sans-serif;line-height:1.55;
  letter-spacing:.005em;padding-top:8px;border-top:1px solid var(--border-soft);
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}}
@media (max-width:600px){{header,main{{padding-left:22px;padding-right:22px;}}}}

/* 라이트박스 — 클릭하면 실제 해상도로 확대해서 확인(2026-07-30
   "클릭하면 이미지 커져서 제대로 확인" 피드백). */
.lightbox{{position:fixed;inset:0;z-index:50;background:rgba(4,5,7,.94);backdrop-filter:blur(2px);
  display:none;align-items:center;justify-content:center;padding:48px;
  opacity:0;transition:opacity .2s var(--ease);}}
.lightbox.open{{display:flex;}}
.lightbox.show{{opacity:1;}}
.lightbox-inner{{max-width:min(1400px,92vw);max-height:92vh;display:flex;flex-direction:column;
  gap:20px;align-items:center;transform:scale(.98);transition:transform .22s var(--ease);}}
.lightbox.show .lightbox-inner{{transform:scale(1);}}
.lightbox-inner img{{max-width:100%;max-height:72vh;border-radius:10px;box-shadow:0 40px 100px -20px rgba(0,0,0,.7);
  object-fit:contain;background:#05070a;border:1px solid rgba(255,255,255,.08);}}
.lightbox-cap{{color:var(--text);font-size:15px;text-align:center;letter-spacing:.02em;
  font-family:'A2Z Medium',sans-serif;}}
.lightbox-reason{{color:var(--text-dim);font-size:14.5px;text-align:center;max-width:900px;line-height:1.6;
  margin-top:-8px;}}
.lightbox-text{{color:var(--text-faint);font-size:13px;font-family:'A2Z Light',sans-serif;
  text-align:center;max-width:820px;line-height:1.65;padding-top:14px;border-top:1px solid var(--border-soft);}}
.lightbox-close{{position:absolute;top:28px;right:36px;width:44px;height:44px;border-radius:50%;
  background:var(--panel);border:1px solid var(--border);color:var(--text);font-size:22px;
  cursor:pointer;display:flex;align-items:center;justify-content:center;
  transition:background .15s var(--ease),border-color .15s var(--ease);}}
.lightbox-close:hover{{background:var(--panel-hover);border-color:var(--border-strong);}}
.lightbox-nav{{position:absolute;top:50%;transform:translateY(-50%);width:56px;height:56px;
  border-radius:50%;background:var(--panel);border:1px solid var(--border);color:var(--text);
  font-size:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;
  transition:background .15s var(--ease),border-color .15s var(--ease);}}
.lightbox-nav:hover{{background:var(--panel-hover);border-color:var(--border-strong);}}
.lightbox-nav.prev{{left:28px;}}
.lightbox-nav.next{{right:28px;}}
@media (max-width:700px){{.lightbox-nav{{display:none;}}}}
</style>
</head><body>
<header>
  <h1>{project.name}</h1>
  <div class="sub"><span>{len(cards)}개 구간</span><span class="dot"></span><span>총 {_fmt_t(total_dur)}</span></div>
  <div class="hint">번호(<b>#</b>)로 피드백 주시면 됩니다 — 예: "6번 카드 색 바꿔줘", "12번 다른 걸로" · 카드를 클릭하면 확대됩니다</div>
</header>
<main><div class="grid">
{''.join(tiles)}
</div></main>

<div class="lightbox" id="lightbox" onclick="if(event.target===this)closeLightbox()">
  <button class="lightbox-close" onclick="closeLightbox()">&times;</button>
  <button class="lightbox-nav prev" onclick="event.stopPropagation();navLightbox(-1)">&#8249;</button>
  <button class="lightbox-nav next" onclick="event.stopPropagation();navLightbox(1)">&#8250;</button>
  <div class="lightbox-inner">
    <img id="lightbox-img" src="" alt="">
    <div class="lightbox-cap" id="lightbox-cap"></div>
    <div class="lightbox-reason" id="lightbox-reason"></div>
    <div class="lightbox-text" id="lightbox-text"></div>
  </div>
</div>

<script>
const CARDS = {lightbox_json};
let currentIdx = 0;

function openLightbox(id) {{
  currentIdx = CARDS.findIndex(c => c.id === id);
  if (currentIdx < 0) currentIdx = 0;
  renderLightbox();
  const lb = document.getElementById('lightbox');
  lb.classList.add('open');
  requestAnimationFrame(() => requestAnimationFrame(() => lb.classList.add('show')));
}}
function closeLightbox() {{
  const lb = document.getElementById('lightbox');
  lb.classList.remove('show');
  setTimeout(() => lb.classList.remove('open'), 200);
}}
function navLightbox(delta) {{
  currentIdx = (currentIdx + delta + CARDS.length) % CARDS.length;
  renderLightbox();
}}
function renderLightbox() {{
  const c = CARDS[currentIdx];
  document.getElementById('lightbox-img').src = c.full;
  document.getElementById('lightbox-cap').textContent = c.caption;
  document.getElementById('lightbox-reason').textContent = c.reason;
  document.getElementById('lightbox-text').textContent = c.text;
}}
document.addEventListener('keydown', (e) => {{
  if (!document.getElementById('lightbox').classList.contains('open')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') navLightbox(-1);
  if (e.key === 'ArrowRight') navLightbox(1);
}});
</script>
</body></html>"""

    out_path = project.path / "review_gallery.html"
    out_path.write_text(html, encoding="utf-8")
    log.info("리뷰 갤러리 저장: %s (%d개 구간)", out_path, len(cards))
    return out_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="⑤ 리뷰 갤러리 — 구간별 대표 프레임 나열")
    parser.add_argument("project", help="영상명 또는 projects/영상명 경로")
    args = parser.parse_args(argv)

    project = common.resolve_project(args.project)
    out = build(project)
    print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
