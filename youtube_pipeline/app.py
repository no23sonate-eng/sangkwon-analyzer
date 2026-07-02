#!/usr/bin/env python3
"""유튜브 편집 자동화 — 로컬 웹앱.

실행:  python youtube_pipeline/app.py
→ 브라우저에서 http://localhost:8500 이 열립니다.

영상 업로드 → ①전사 → ②B-roll(검토) → ③자막(검토) → ④렌더 → ⑤프리미어/캡컷 내보내기
전 과정을 버튼으로 진행합니다. 각 단계는 백그라운드로 돌고 화면이 자동 갱신됩니다.
"""

from __future__ import annotations

import io
import json
import re
import shutil
import sys
import threading
import traceback
import webbrowser
import zipfile
from pathlib import Path

from flask import Flask, jsonify, redirect, request, send_file, send_from_directory

sys.path.insert(0, str(Path(__file__).resolve().parent / "pipeline"))
import broll as broll_mod          # noqa: E402
import common                      # noqa: E402
import export as export_mod        # noqa: E402
import render as render_mod        # noqa: E402
import subtitle as subtitle_mod    # noqa: E402
import transcribe as transcribe_mod  # noqa: E402

app = Flask(__name__)
CONFIG = common.load_config()
PORT = int(CONFIG.get("web", {}).get("port", 8500))

JOBS: dict[str, dict] = {}   # project -> {stage, status, error}
LOCK = threading.Lock()

STAGES = [
    ("transcribe", "① 전사"),
    ("broll", "② B-roll 검색"),
    ("subtitle", "③ 자막"),
    ("render", "④ 렌더"),
    ("export", "⑤ 내보내기"),
]


def _safe_name(name: str) -> str:
    name = re.sub(r"[^\w가-힣.\- ]", "", name).strip().replace(" ", "_")
    return name or "새프로젝트"


PIPE_DIR = Path(__file__).resolve().parent / "pipeline"
STAGE_ARGS = {
    "transcribe": [],
    "broll": ["--no-serve"],
    "subtitle": ["--no-serve"],
    "render": [],
    "export": [],
}


def _run_stage(project: common.Project, stage: str) -> None:
    """각 단계를 별도 프로세스로 실행 — 서버 스레드 안에서 돌릴 때의
    불안정(전사 세그먼트 누락)을 피하고 메모리도 격리한다."""
    import subprocess
    try:
        cmd = [sys.executable, str(PIPE_DIR / f"{stage}.py"),
               str(project.path)] + STAGE_ARGS[stage]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
        if r.returncode != 0:
            tail = (r.stderr or r.stdout or "").strip().splitlines()[-4:]
            raise RuntimeError("\n".join(tail) or f"exit {r.returncode}")
        with LOCK:
            JOBS[project.name] = {"stage": stage, "status": "done", "error": None}
    except Exception as e:
        traceback.print_exc()
        with LOCK:
            JOBS[project.name] = {"stage": stage, "status": "error", "error": str(e)}


def _status(project: common.Project) -> dict:
    p = project.path
    job = JOBS.get(project.name) or {}
    sel = {}
    if (p / "selections.json").exists():
        sel = common.read_json(p / "selections.json")
    plan_confirmed = False
    if (p / "subtitle_plan.json").exists():
        plan_confirmed = common.read_json(p / "subtitle_plan.json").get("user_confirmed", False)
    return {
        "job": job,
        "source": bool(_find_source(p)),
        "transcribe": (p / "transcript.json").exists(),
        "broll": (p / "broll.json").exists(),
        "broll_reviewed": bool(sel.get("sections")),
        "subtitle": (p / "subtitle_plan.json").exists(),
        "subtitle_confirmed": plan_confirmed,
        "render": (p / "output.mp4").exists(),
        "export": (p / "export" / "premiere.xml").exists(),
    }


def _find_source(p: Path):
    try:
        return common.Project(p.name, p).find_source_media()
    except FileNotFoundError:
        return None


# ── 페이지 ─────────────────────────────────────────────────

CSS = """
:root { color-scheme: dark; }
body { font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif; background:#14171c; color:#e8eaed; margin:0; padding:28px; max-width:900px; margin:auto; }
h1 { font-size:22px; } a { color:#8ab4f8; text-decoration:none; }
.card { background:#1d2129; border:1px solid #2a2f3a; border-radius:12px; padding:18px; margin:14px 0; }
button, .btn { background:#8ab4f8; color:#14171c; border:0; padding:9px 18px; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer; display:inline-block; }
button:disabled { background:#3a4050; color:#9aa0a6; cursor:default; }
.stage { display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid #2a2f3a; }
.stage:last-child { border-bottom:0; }
.dot { width:12px; height:12px; border-radius:99px; background:#3a4050; flex:none; }
.dot.done { background:#81c995; } .dot.running { background:#fbbc04; animation:p 1s infinite alternate; }
.dot.error { background:#f28b82; }
@keyframes p { to { opacity:.4 } }
.hint { color:#9aa0a6; font-size:13px; }
input[type=file],input[type=text] { background:#14171c; border:1px solid #2a2f3a; color:#e8eaed; border-radius:8px; padding:8px; }
.err { color:#f28b82; font-size:13px; white-space:pre-wrap; }
"""

DASH = """<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>유튜브 편집 자동화</title>
<style>{css}</style></head><body>
<h1>🎬 유튜브 편집 자동화</h1>
<div class="card">
  <h3 style="margin-top:0">새 영상 업로드</h3>
  <form action="/upload" method="post" enctype="multipart/form-data">
    <input type="file" name="video" accept="video/*,audio/*" required>
    <input type="text" name="name" placeholder="프로젝트 이름 (비우면 파일명)">
    <button>업로드</button>
  </form>
  <div class="hint" style="margin-top:8px">업로드하면 프로젝트가 만들어지고, 단계별 버튼으로 진행합니다.</div>
</div>
<h3>프로젝트</h3>
{projects}
</body></html>"""

PROJ = """<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>{name}</title>
<style>{css}</style></head><body>
<a href="/">← 전체 프로젝트</a>
<h1>{name}</h1>
<div class="card" id="stages"></div>
<div class="card" id="outputs" style="display:none">
  <h3 style="margin-top:0">결과물</h3>
  <div id="outlinks"></div>
</div>
<script>
const NAME = {name_js};
const STAGES = [
  ["transcribe","① 전사","음성을 글자로 (몇 분 걸릴 수 있음)"],
  ["broll","② B-roll 검색","AI 키워드로 스톡 검색·다운로드"],
  ["subtitle","③ 자막","스타일링 + 타이포 계획"],
  ["render","④ 렌더","B-roll+자막 합성 → output.mp4"],
  ["export","⑤ 내보내기","프리미어 XML / SRT / 타이포 PNG"],
];
async function refresh() {{
  const st = await (await fetch(`/p/${{NAME}}/status`)).json();
  const box = document.getElementById('stages');
  box.innerHTML = '';
  const job = st.job || {{}};
  for (const [key, label, desc] of STAGES) {{
    const running = job.stage === key && job.status === 'running';
    const error = job.stage === key && job.status === 'error';
    const done = st[key];
    const row = document.createElement('div'); row.className = 'stage';
    let extra = '';
    if (key === 'broll' && st.broll)
      extra = `<a class="btn" style="background:#81c995" href="/p/${{NAME}}/files/review.html" target="_blank">후보 고르기</a>` +
              (st.broll_reviewed ? ' <span class="hint">선택 저장됨 ✓</span>' : ' <span class="hint">← 저장해야 렌더에 반영</span>');
    if (key === 'subtitle' && st.subtitle)
      extra = `<a class="btn" style="background:#81c995" href="/p/${{NAME}}/files/subtitle_review.html" target="_blank">자막 검토</a>` +
              (st.subtitle_confirmed ? ' <span class="hint">확정됨 ✓</span>' : '');
    row.innerHTML = `
      <div class="dot ${{running ? 'running' : error ? 'error' : done ? 'done' : ''}}"></div>
      <div style="flex:1"><b>${{label}}</b> <span class="hint">${{desc}}</span>
        ${{error ? `<div class="err">${{job.error}}</div>` : ''}}</div>
      ${{extra}}
      <button onclick="run('${{key}}')" ${{running || (job.status === 'running') ? 'disabled' : ''}}>
        ${{running ? '실행 중…' : done ? '다시 실행' : '실행'}}</button>`;
    box.appendChild(row);
  }}
  const outs = [];
  if (st.render) outs.push(`<a class="btn" href="/p/${{NAME}}/files/output.mp4" download>⬇ output.mp4</a>`);
  if (st.export) outs.push(`<a class="btn" href="/p/${{NAME}}/export.zip">⬇ 프리미어/캡컷 패키지 (zip)</a>`);
  document.getElementById('outputs').style.display = outs.length ? '' : 'none';
  document.getElementById('outlinks').innerHTML = outs.join(' ');
  if (job.status === 'running') setTimeout(refresh, 2000);
}}
async function run(stage) {{
  await fetch(`/p/${{NAME}}/run/${{stage}}`, {{method:'POST'}});
  refresh();
  const t = setInterval(async () => {{
    const st = await (await fetch(`/p/${{NAME}}/status`)).json();
    if (!st.job || st.job.status !== 'running') {{ clearInterval(t); }}
    refresh();
  }}, 2500);
}}
refresh();
</script></body></html>"""


@app.get("/")
def dashboard():
    cards = []
    if common.PROJECTS_DIR.exists():
        for p in sorted(common.PROJECTS_DIR.iterdir()):
            if not p.is_dir():
                continue
            st = _status(common.Project(p.name, p))
            done = sum(1 for k, _ in STAGES if st.get(k))
            cards.append(f'<div class="card"><a href="/p/{p.name}/"><b>{p.name}</b></a> '
                         f'<span class="hint">— {done}/5 단계 완료</span></div>')
    return DASH.format(css=CSS, projects="".join(cards) or '<div class="hint">아직 없음</div>')


@app.post("/upload")
def upload():
    f = request.files["video"]
    name = _safe_name(request.form.get("name") or Path(f.filename).stem)
    proj_dir = common.PROJECTS_DIR / name
    proj_dir.mkdir(parents=True, exist_ok=True)
    ext = Path(f.filename).suffix or ".mp4"
    f.save(proj_dir / f"{name}{ext}")
    return redirect(f"/p/{name}/")


@app.get("/p/<name>/")
def project_page(name):
    return PROJ.format(css=CSS, name=name, name_js=json.dumps(name))


@app.get("/p/<name>/status")
def project_status(name):
    return jsonify(_status(common.resolve_project(name)))


@app.post("/p/<name>/run/<stage>")
def run_stage(name, stage):
    if stage not in {k for k, _ in STAGES}:
        return jsonify({"error": "unknown stage"}), 400
    project = common.resolve_project(name)
    with LOCK:
        job = JOBS.get(name)
        if job and job.get("status") == "running":
            return jsonify({"error": "already running"}), 409
        JOBS[name] = {"stage": stage, "status": "running", "error": None}
    threading.Thread(target=_run_stage, args=(project, stage), daemon=True).start()
    return jsonify({"ok": True})


@app.get("/p/<name>/files/assets/<path:pp>")
def project_assets(name, pp):
    return send_from_directory(common.ROOT_DIR / "assets", pp)


@app.get("/p/<name>/files/<path:pp>")
def project_files(name, pp):
    return send_from_directory(common.PROJECTS_DIR / name, pp)


@app.post("/p/<name>/files/api/save")
def save_broll(name):
    project = common.resolve_project(name)
    payload = request.get_json(force=True)
    added = broll_mod._append_feedback(project, payload)
    common.write_json(project.path / broll_mod.SELECTIONS_JSON, payload)
    return jsonify({"ok": True, "feedback_added": added})


@app.post("/p/<name>/files/api/save-subtitle")
def save_subtitle(name):
    project = common.resolve_project(name)
    payload = request.get_json(force=True)
    plan_path = project.path / subtitle_mod.PLAN_JSON
    plan = common.read_json(plan_path)
    added = subtitle_mod._append_feedback(project, plan["cues"], payload["cues"])
    added += subtitle_mod._append_display_feedback(project, plan.get("displays", []),
                                                   payload.get("displays", []))
    plan["cues"] = payload["cues"]
    plan["displays"] = payload.get("displays", plan.get("displays", []))
    plan["user_confirmed"] = True
    common.write_json(plan_path, plan)
    transcript = common.read_json(project.transcript_path)
    subtitle_mod.build_ass(CONFIG, plan["cues"], project.path / subtitle_mod.ASS_FILE,
                           segments=transcript.get("segments"), displays=plan["displays"])
    return jsonify({"ok": True, "feedback_added": added})


@app.get("/p/<name>/export.zip")
def export_zip(name):
    project = common.resolve_project(name)
    exp = project.path / "export"
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for f in exp.rglob("*"):
            if f.is_file():
                z.write(f, f.relative_to(exp))
    buf.seek(0)
    return send_file(buf, as_attachment=True, download_name=f"{name}_export.zip",
                     mimetype="application/zip")


if __name__ == "__main__":
    common.load_env()
    common.PROJECTS_DIR.mkdir(exist_ok=True)
    print(f"\n  🎬 유튜브 편집 자동화 → http://localhost:{PORT}\n")
    threading.Timer(1.0, lambda: webbrowser.open(f"http://localhost:{PORT}")).start()
    app.run(host="127.0.0.1", port=PORT, debug=False)
