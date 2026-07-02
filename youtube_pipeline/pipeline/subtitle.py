#!/usr/bin/env python3
"""③ 자막 단계 — 전체 맥락 기반 AI 스타일링 → 검토 표 → ASS 변환.

입력: projects/<영상명>/transcript.json
출력: projects/<영상명>/subtitle_plan.json    (문장별 색상·크기·강조 단어·판단 이유)
      projects/<영상명>/subtitle_review.html  (검토/수정 표)
      projects/<영상명>/subtitle.ass          (ffmpeg 굽기용 — 저장할 때마다 재생성)

실행:
    python youtube_pipeline/pipeline/subtitle.py <영상명>           # 전체 파이프라인
    python youtube_pipeline/pipeline/subtitle.py <영상명> --review  # 검토 서버만
    python youtube_pipeline/pipeline/subtitle.py <영상명> --mock    # API 없이 데모

원칙:
- transcript 전체를 Claude 에 **한 번에** 보낸다 (문장별 개별 호출 금지).
  영상 전체 맥락에서 핵심 주장/부연을 구분해야 하기 때문.
- 판단 기준은 style_guide.md '자막 스타일 규칙' 섹션을 프롬프트에 그대로 포함.
- 검토 표에서의 수정 내역은 feedback_log.json 에 자동 누적.
- 폰트: 프로젝트 포함 Pretendard Bold (assets/fonts/) — ffmpeg 굽기 시
  `-vf "ass=subtitle.ass:fontsdir=<assets/fonts 경로>"` 로 지정 (render.py 담당).
- 한 화면 2줄 초과 금지, 하단 중앙 배치.
"""

from __future__ import annotations

import argparse
import http.server
import json
import os
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

log = common.get_logger("subtitle")

PLAN_JSON = "subtitle_plan.json"
REVIEW_HTML = "subtitle_review.html"
ASS_FILE = "subtitle.ass"
FEEDBACK_JSON = "feedback_log.json"


# ══════════════════════════════════════════════════════════
# 1~2. AI 스타일링 — transcript 전체를 한 번에, style_guide 주입
# ══════════════════════════════════════════════════════════

def _style_rules(config: dict) -> str:
    guide = common.load_style_guide(config)
    parts = re.split(r"^## ", guide, flags=re.M)
    for p in parts:
        if "자막" in p.splitlines()[0]:
            return ("## " + p).strip()
    raise ValueError("style_guide.md 에서 '자막 스타일 규칙' 섹션을 찾지 못했습니다.")


def plan_ai(config: dict, sentences: list[dict]) -> list[dict]:
    """전체 문장을 한 번에 보내 문장별 스타일 계획을 받는다."""
    sconf = config.get("subtitle", {})
    aconf = config.get("anthropic", {})
    client = common.anthropic_client()

    numbered = "\n".join(f"{s['id']}. {s['text']}" for s in sentences)
    system = (
        "너는 유튜브 자막 디자이너다. 아래 스타일 가이드가 판단의 유일한 기준이다.\n\n"
        f"{_style_rules(config)}"
        f"{common.feedback_prompt_block('subtitle')}"
    )
    user = (
        "다음은 영상 전체 나레이션이다 (문장 번호 포함):\n\n"
        f"{numbered}\n\n"
        "영상 **전체 맥락**에서 어떤 문장이 핵심 주장이고 어떤 문장이 부연인지 판단해,\n"
        "문장별 자막 스타일을 정하라.\n"
        f"- size: 핵심 주장은 \"large\", 부연은 \"normal\"\n"
        f"- color: 강조 단어에 적용할 색. 기본 강조색 {sconf.get('accent_color', '#FFD84D')} 를 쓰되,"
        " 가이드가 허용하는 범위에서만 바꾼다\n"
        "- emphasis: 강조할 단어들(원문 그대로, 수치·지명·브랜드명·공간 용어만, 문장당 최대 2개, 없으면 빈 배열)\n"
        "- reason: 판단 이유 한 줄 (한국어)\n\n"
        "모든 문장에 대해 아래 JSON 배열 형식으로만 답하라 (설명 금지):\n"
        '[{"id": 0, "size": "normal", "color": "#FFD84D", "emphasis": ["단어"], "reason": "..."}, ...]'
    )
    resp = client.messages.create(
        model=aconf.get("model", "claude-sonnet-4-6"),
        max_tokens=int(aconf.get("max_tokens", 2048)),
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    text = next(b.text for b in resp.content if b.type == "text")
    text = re.sub(r"^```(json)?|```$", "", text.strip(), flags=re.M).strip()
    items = {it["id"]: it for it in json.loads(text)}

    cues = []
    for s in sentences:
        it = items.get(s["id"], {})
        cues.append(_make_cue(s, it, sconf))
    return cues


def plan_mock(config: dict, sentences: list[dict]) -> list[dict]:
    """API 없이 휴리스틱: 수치가 든 문장 = 핵심(large), 수치·긴 명사 강조."""
    sconf = config.get("subtitle", {})
    cues = []
    for s in sentences:
        nums = re.findall(r"\d[\d,.]*\s?(?:%|퍼센트|만원|억|평|층|년|개)?", s["text"])
        nums = [n.strip() for n in nums if n.strip()]
        core = bool(nums) or ("가장" in s["text"]) or ("핵심" in s["text"])
        emphasis = nums[:2]
        if not emphasis and core:
            words = [w for w in re.findall(r"[가-힣]{3,}", s["text"])]
            emphasis = words[:1]
        it = {"size": "large" if core else "normal",
              "color": sconf.get("accent_color", "#FFD84D"),
              "emphasis": emphasis,
              "reason": "mock: " + ("수치/핵심 표현 포함 → 핵심 주장" if core else "부연 설명")}
        cues.append(_make_cue(s, it, sconf))
    return cues


def _make_cue(s: dict, it: dict, sconf: dict) -> dict:
    return {
        "id": s["id"], "start": s["start"], "end": s["end"], "text": s["text"],
        "size": it.get("size", "normal"),
        "color": it.get("color", sconf.get("accent_color", "#FFD84D")),
        "emphasis": [e for e in it.get("emphasis", []) if e and e in s["text"]][:2],
        "reason": it.get("reason", ""),
    }


# ══════════════════════════════════════════════════════════
# 긴 문장 분할 — 단어 타임스탬프로 호흡 단위 큐 쪼개기
# ══════════════════════════════════════════════════════════

def _words_in_range(segments: list[dict], start: float, end: float) -> list[dict]:
    out = []
    for seg in segments or []:
        for w in seg.get("words") or []:
            if w["start"] >= start - 0.05 and w["end"] <= end + 0.05:
                out.append(w)
    return out


def split_long_cues(cues: list[dict], segments: list[dict],
                    max_sec: float, max_chars_2lines: int) -> list[dict]:
    """긴 문장 큐를 단어 타임스탬프 기준으로 여러 큐로 나눈다.

    - 기준 초과(시간 또는 2줄 분량 글자수) 시에만 분할
    - 단어 사이 간격이 큰 곳(호흡)을 우선 분할점으로 선택
    - 스타일(size/color)은 유지, 강조 단어는 해당 단어가 든 조각에만 적용
    - 단어 타임스탬프가 없으면 원본 유지
    """
    out: list[dict] = []
    for c in cues:
        dur = c["end"] - c["start"]
        if dur <= max_sec and len(c["text"]) <= max_chars_2lines:
            out.append(c)
            continue
        words = _words_in_range(segments, c["start"], c["end"])
        if len(words) < 4:
            out.append(c)
            continue

        n_chunks = max(int(dur // max_sec) + 1, (len(c["text"]) // max_chars_2lines) + 1)
        target = len(words) / n_chunks
        # 분할점: 목표 지점 근처에서 단어 간 간격(침묵)이 가장 큰 곳
        cuts = []
        for k in range(1, n_chunks):
            center = round(k * target)
            best, best_gap = center, -1.0
            for j in range(max(1, center - 2), min(len(words) - 1, center + 3)):
                gap = words[j]["start"] - words[j - 1]["end"]
                if gap > best_gap:
                    best, best_gap = j, gap
            cuts.append(best)
        cuts = sorted(set(cuts))

        pieces = []
        prev = 0
        for cut in cuts + [len(words)]:
            chunk = words[prev:cut]
            if chunk:
                pieces.append(chunk)
            prev = cut

        for i, chunk in enumerate(pieces):
            text = "".join(w["word"] for w in chunk).strip()
            emphasis = [e for e in c.get("emphasis", []) if e in text]
            out.append({**c,
                        "id": c["id"] if i == 0 else f"{c['id']}.{i}",
                        "start": round(chunk[0]["start"], 3),
                        "end": round(chunk[-1]["end"], 3),
                        "text": text, "emphasis": emphasis})
        log.info("긴 문장 #%s 를 %d개 큐로 분할 (%.1fs)", c["id"], len(pieces), dur)
    return out


# ══════════════════════════════════════════════════════════
# 5. ASS 변환 — Pretendard Bold, 2줄 제한, 하단 중앙
# ══════════════════════════════════════════════════════════

def _break_lines(text: str, max_chars: int) -> str:
    """공백 기준 줄바꿈, 최대 2줄. 한 줄이면 그대로."""
    if len(text) <= max_chars:
        return text
    words = text.split(" ")
    # 두 줄 길이 균형이 가장 좋은 분할점 탐색
    best, best_score = None, None
    for i in range(1, len(words)):
        l1, l2 = " ".join(words[:i]), " ".join(words[i:])
        score = abs(len(l1) - len(l2)) + (100 if max(len(l1), len(l2)) > max_chars * 1.4 else 0)
        if best_score is None or score < best_score:
            best, best_score = (l1, l2), score
    return best[0] + r"\N" + best[1] if best else text


def _hex_to_ass(color: str) -> str:
    """#RRGGBB → &HBBGGRR& (ASS 는 BGR)."""
    c = color.lstrip("#")
    r, g, b = c[0:2], c[2:4], c[4:6]
    return f"&H00{b}{g}{r}".upper()


def _ts(sec: float) -> str:
    h = int(sec // 3600)
    m = int(sec % 3600 // 60)
    s = sec % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def build_ass(config: dict, cues: list[dict], out_path: Path,
              segments: list[dict] | None = None) -> None:
    sconf = config.get("subtitle", {})
    if segments:
        cues = split_long_cues(
            cues, segments,
            max_sec=float(sconf.get("max_cue_sec", 5.0)),
            max_chars_2lines=int(sconf.get("max_chars_per_line", 22)) * 2,
        )
    profile = common.get_render_profile(config)
    w, h = profile["width"], profile["height"]
    scale = h / 1080  # 설정값은 1080p 기준
    fam_n = sconf.get("font_family_normal") or sconf.get("font_family", "Pretendard")
    fam_l = sconf.get("font_family_large") or fam_n
    size_n = round(int(sconf.get("size_normal", 60)) * scale)
    size_l = round(int(sconf.get("size_large", 76)) * scale)
    margin_v = round(int(sconf.get("margin_bottom", 110)) * scale)
    base = _hex_to_ass(sconf.get("base_color", "#FFFFFF"))
    maxc = int(sconf.get("max_chars_per_line", 22))

    # Alignment 2 = 하단 중앙. Outline+Shadow 로 가독성 확보(반투명 검정 테두리).
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Normal,{fam_n},{size_n},{base},{base},&H78000000,&HB4000000,0,0,0,0,100,100,0,0,1,1.5,0.5,2,60,60,{margin_v},1
Style: Large,{fam_l},{size_l},{base},{base},&H78000000,&HB4000000,0,0,0,0,100,100,0,0,1,1.5,0.5,2,60,60,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = []
    for c in cues:
        text = c["text"]
        # 강조 단어 인라인 색 (원문 그대로 매칭)
        accent = _hex_to_ass(c.get("color", "#FFD84D"))
        for word in c.get("emphasis", []):
            if word in text:
                text = text.replace(word, f"{{\\c{accent}}}{word}{{\\c{base}}}", 1)
        text = _break_lines(text, maxc)
        style = "Large" if c.get("size") == "large" else "Normal"
        lines.append(f"Dialogue: 0,{_ts(c['start'])},{_ts(c['end'])},{style},,0,0,0,,{text}")

    out_path.write_text(header + "\n".join(lines) + "\n", encoding="utf-8")
    log.info("ASS 생성: %s (%d개 자막)", out_path, len(lines))


# ══════════════════════════════════════════════════════════
# 4. 검토 표 (HTML) — 행별 직접 수정 가능
# ══════════════════════════════════════════════════════════

def build_review_html(project: common.Project, plan: dict, config: dict) -> Path:
    sconf = config.get("subtitle", {})
    payload = json.dumps({"plan": plan, "conf": {
        "size_normal": sconf.get("size_normal", 60),
        "size_large": sconf.get("size_large", 76),
        "base_color": sconf.get("base_color", "#FFFFFF"),
    }}, ensure_ascii=False)
    html = """<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>자막 검토 — __PROJECT__</title>
<style>
  :root { color-scheme: dark; }
  @font-face { font-family: 'Pretendard'; src: url('assets/fonts/Pretendard-Bold.otf'); font-weight: 700; }
  body { font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif; background:#14171c; color:#e8eaed; margin:0; padding:24px; }
  h1 { font-size:20px; margin:0 0 4px; }
  .sub { color:#9aa0a6; font-size:13px; margin-bottom:18px; }
  table { border-collapse:collapse; width:100%; }
  th,td { border-bottom:1px solid #2a2f3a; padding:12px 10px; text-align:left; vertical-align:top; font-size:13px; }
  th { color:#9aa0a6; font-weight:600; position:sticky; top:0; background:#14171c; }
  .time { color:#8ab4f8; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .preview { background:#000; border-radius:8px; padding:18px 14px 10px; text-align:center; min-width:300px; }
  .preview .cap { font-family:'Pretendard',sans-serif; font-weight:700; line-height:1.35;
                  text-shadow:0 0 6px rgba(0,0,0,.9), 2px 2px 2px rgba(0,0,0,.9); }
  .reason { color:#9aa0a6; max-width:220px; }
  .edited .reason::after { content:' (수정됨)'; color:#e07a5f; }
  input[type=text] { background:#1d2129; border:1px solid #2a2f3a; color:#e8eaed; border-radius:6px; padding:6px 8px; width:150px; }
  input[type=color] { width:40px; height:28px; border:0; background:transparent; cursor:pointer; }
  select { background:#1d2129; border:1px solid #2a2f3a; color:#e8eaed; border-radius:6px; padding:6px; }
  #savebar { position:sticky; bottom:0; background:#1d2129; border-top:1px solid #2a2f3a; margin:0 -24px; padding:14px 24px; display:flex; gap:14px; align-items:center; }
  #save { background:#8ab4f8; color:#14171c; border:0; padding:10px 22px; border-radius:8px; font-size:15px; font-weight:700; cursor:pointer; }
  #status { font-size:13px; color:#9aa0a6; }
</style></head><body>
<h1>자막 검토 — __PROJECT__</h1>
<div class="sub">크기/강조색/강조 단어를 직접 수정할 수 있습니다. '확정 저장'을 누르면
subtitle_plan.json 이 갱신되고 <b>subtitle.ass 가 재생성</b>되며, 수정 내역은 feedback_log.json 에 누적됩니다.</div>
<table><thead><tr>
  <th>#</th><th>시간</th><th>문장 / 적용 스타일 미리보기</th><th>크기</th><th>강조색</th><th>강조 단어 (쉼표 구분)</th><th>AI 판단 이유</th>
</tr></thead><tbody id="rows"></tbody></table>
<div id="savebar"><button id="save">확정 저장 (plan + ASS 재생성)</button><span id="status"></span></div>
<script>
const BOOT = __DATA__;
const CONF = BOOT.conf;
const cues = BOOT.plan.cues.map(c => ({...c, emphasis: [...(c.emphasis||[])]}));
const orig = JSON.parse(JSON.stringify(cues));
const tbody = document.getElementById('rows');

function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
function renderPreview(c) {
  const px = (c.size === 'large' ? CONF.size_large : CONF.size_normal) * 0.45;
  let t = esc(c.text);
  for (const w of c.emphasis) {
    if (w && c.text.includes(w))
      t = t.replace(esc(w), `<span style="color:${c.color}">${esc(w)}</span>`);
  }
  return `<div class="cap" style="font-size:${px}px;color:${CONF.base_color}">${t}</div>`;
}
function t(s){ const m=Math.floor(s/60), ss=(s%60).toFixed(1); return m+':'+String(ss).padStart(4,'0'); }

for (const c of cues) {
  const tr = document.createElement('tr');
  tr.dataset.id = c.id;
  tr.innerHTML = `
    <td>${c.id}</td>
    <td class="time">${t(c.start)}<br>→ ${t(c.end)}</td>
    <td><div class="preview" id="pv${c.id}">${renderPreview(c)}</div></td>
    <td><select data-f="size">
        <option value="normal" ${c.size==='normal'?'selected':''}>normal</option>
        <option value="large" ${c.size==='large'?'selected':''}>large (핵심)</option></select></td>
    <td><input type="color" data-f="color" value="${c.color}"></td>
    <td><input type="text" data-f="emphasis" value="${c.emphasis.join(', ')}"></td>
    <td class="reason">${esc(c.reason||'')}</td>`;
  tr.addEventListener('input', e => {
    const f = e.target.dataset.f;
    if (f === 'size') c.size = e.target.value;
    if (f === 'color') c.color = e.target.value;
    if (f === 'emphasis') c.emphasis = e.target.value.split(',').map(s=>s.trim()).filter(Boolean).slice(0,2);
    document.getElementById('pv'+c.id).innerHTML = renderPreview(c);
    const o = orig.find(x=>x.id===c.id);
    tr.classList.toggle('edited', JSON.stringify({s:c.size,c:c.color,e:c.emphasis})
                                !== JSON.stringify({s:o.size,c:o.color,e:o.emphasis}));
  });
  tbody.appendChild(tr);
}

document.getElementById('save').onclick = async () => {
  const st = document.getElementById('status');
  try {
    const r = await fetch('/api/save', { method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ project: BOOT.plan.project, cues }) });
    if (!r.ok) throw new Error(await r.text());
    const res = await r.json();
    st.textContent = `✅ 저장 완료 — ASS 재생성, 피드백 ${res.feedback_added}건 기록 (${new Date().toLocaleTimeString()})`;
  } catch (e) {
    const blob = new Blob([JSON.stringify({cues}, null, 2)], {type:'application/json'});
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'subtitle_edits.json' });
    a.click();
    st.textContent = '서버가 없어 수정본을 파일로 내려받았습니다.';
  }
};
</script></body></html>"""
    html = html.replace("__PROJECT__", project.name).replace("__DATA__", payload)
    out = project.path / REVIEW_HTML
    out.write_text(html, encoding="utf-8")
    log.info("검토 표 생성: %s", out)
    return out


# ══════════════════════════════════════════════════════════
# 검토 서버 — 저장 시 plan 갱신 + ASS 재생성 + 피드백 누적
# ══════════════════════════════════════════════════════════

def _append_feedback(project: common.Project, old_cues: list[dict], new_cues: list[dict]) -> int:
    fb_path = project.path / FEEDBACK_JSON
    feedback = common.read_json(fb_path) if fb_path.exists() else []
    old_by_id = {c["id"]: c for c in old_cues}
    added = 0
    for c in new_cues:
        o = old_by_id.get(c["id"])
        if not o:
            continue
        changed = {k: {"ai": o.get(k), "user": c.get(k)}
                   for k in ("size", "color", "emphasis") if o.get(k) != c.get(k)}
        if not changed:
            continue
        feedback.append({
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "stage": "subtitle",
            "project": project.name,
            "sentence_id": c["id"],
            "sentence_text": c["text"],
            "ai_reason": o.get("reason", ""),
            "changes": changed,
        })
        added += 1
    if added:
        common.write_json(fb_path, feedback)
    return added


def serve_review(project: common.Project, config: dict, port: int) -> None:
    proj_dir = str(project.path)
    # 검토 페이지 미리보기에서 폰트를 쓸 수 있게 assets 링크
    assets_link = project.path / "assets"
    if not assets_link.exists():
        try:
            assets_link.symlink_to(common.ROOT_DIR / "assets")
        except OSError:
            pass

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=proj_dir, **kw)

        def log_message(self, fmt, *args):
            pass

        def do_POST(self):
            if self.path != "/api/save":
                self.send_error(404)
                return
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length))
            plan_path = project.path / PLAN_JSON
            plan = common.read_json(plan_path)
            added = _append_feedback(project, plan["cues"], payload["cues"])
            plan["cues"] = payload["cues"]
            plan["user_confirmed"] = True
            common.write_json(plan_path, plan)
            transcript = common.read_json(project.transcript_path)
            build_ass(config, plan["cues"], project.path / ASS_FILE,
                      segments=transcript.get("segments"))
            body = json.dumps({"ok": True, "feedback_added": added}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    server = http.server.ThreadingHTTPServer(("0.0.0.0", port), Handler)
    log.info("검토 서버: http://localhost:%d/%s  (Ctrl+C 로 종료)", port, REVIEW_HTML)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


# ══════════════════════════════════════════════════════════
# 메인
# ══════════════════════════════════════════════════════════

def run(project: common.Project, config: dict, mock: bool = False) -> dict:
    if not project.transcript_path.exists():
        raise FileNotFoundError(f"{project.transcript_path} 없음. 먼저 transcribe 를 실행하세요.")
    transcript = common.read_json(project.transcript_path)
    sentences = transcript["sentences"]

    if mock:
        cues = plan_mock(config, sentences)
    else:
        try:
            common.load_env()
            cues = plan_ai(config, sentences)
        except Exception as e:
            log.warning("AI 스타일링 실패(%s) — 휴리스틱 폴백", e)
            cues = plan_mock(config, sentences)

    plan = {
        "project": project.name,
        "model": config.get("anthropic", {}).get("model"),
        "mock": mock,
        "font": config.get("subtitle", {}).get("font_file"),
        "user_confirmed": False,
        "cues": cues,
    }
    common.write_json(project.path / PLAN_JSON, plan)
    for c in cues:
        log.info("  #%d [%s] 강조=%s — %s", c["id"], c["size"], c["emphasis"], c["reason"])

    build_review_html(project, plan, config)
    build_ass(config, cues, project.path / ASS_FILE,
              segments=transcript.get("segments"))  # 초안 ASS (확정 저장 시 재생성)
    return plan


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="③ 자막 스타일링 → 검토 표 → ASS")
    parser.add_argument("project", help="영상명 또는 projects/영상명 경로")
    parser.add_argument("--config", default=str(common.CONFIG_PATH))
    parser.add_argument("--mock", action="store_true", help="API 없이 휴리스틱 데모")
    parser.add_argument("--review", action="store_true", help="검토 서버만 실행")
    parser.add_argument("--no-serve", action="store_true", help="검토 서버 띄우지 않음")
    args = parser.parse_args(argv)

    config = common.load_config(args.config)
    project = common.resolve_project(args.project)
    port = int(config.get("subtitle", {}).get("review_port", 8788))

    if args.review:
        if not (project.path / REVIEW_HTML).exists():
            log.error("%s 가 없습니다. 먼저 subtitle 파이프라인을 실행하세요.", REVIEW_HTML)
            return 1
        serve_review(project, config, port)
        return 0

    run(project, config, mock=args.mock)
    if not args.no_serve:
        serve_review(project, config, port)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
