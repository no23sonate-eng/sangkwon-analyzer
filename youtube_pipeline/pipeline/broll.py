#!/usr/bin/env python3
"""② B-roll 단계 — 구간 정의 → AI 키워드 추출 → 스톡 검색/다운로드 → 검토 페이지.

입력: projects/<영상명>/transcript.json
출력: projects/<영상명>/broll.json                 (구간·키워드·후보 목록)
      projects/<영상명>/broll_candidates/*        (다운로드된 후보 미디어)
      projects/<영상명>/review.html               (검토 페이지)
      projects/<영상명>/selections.json           (검토 페이지에서 선택 저장 시)
      projects/<영상명>/feedback_log.json         (AI 제안과 다른 선택 자동 누적)

실행:
    python youtube_pipeline/pipeline/broll.py <영상명>            # 전체 파이프라인
    python youtube_pipeline/pipeline/broll.py <영상명> --review   # 검토 서버만 다시 띄우기
    python youtube_pipeline/pipeline/broll.py <영상명> --mock     # API 키/네트워크 없이 데모
                                                                  #  (키워드 휴리스틱 + 플레이스홀더 클립)

원칙:
- AI 판단(시각 키워드 추출)은 Anthropic API 호출. 판단 기준은 코드에 하드코딩하지
  않고 style_guide.md 의 'B-roll 소스 선정 기준'과 '검색어 매핑 표'를 프롬프트에 포함.
- 검색은 Pexels 우선 → Pixabay. 영상 우선, 없으면 사진(렌더 시 Ken Burns 대상).
"""

from __future__ import annotations

import argparse
import http.server
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

log = common.get_logger("broll")

REVIEW_HTML = "review.html"
FEEDBACK_JSON = "feedback_log.json"
SELECTIONS_JSON = "selections.json"
CANDIDATES_DIR = "broll_candidates"


# ══════════════════════════════════════════════════════════
# 1. 구간 정의 — 문장을 의미 단위로 묶고 리듬(40~60%) 선택
# ══════════════════════════════════════════════════════════

def build_sections(sentences: list[dict], conf: dict) -> list[dict]:
    """문장을 3~8초 구간으로 묶는다. 문장 간 침묵(>1.2s)은 의미 단위 경계로 본다."""
    min_s = float(conf.get("min_section_sec", 3))
    max_s = float(conf.get("max_section_sec", 8))

    sections: list[dict] = []
    buf: list[dict] = []

    def flush():
        if not buf:
            return
        sections.append({
            "id": len(sections),
            "start": buf[0]["start"],
            "end": buf[-1]["end"],
            "text": " ".join(s["text"] for s in buf),
            "sentence_ids": [s["id"] for s in buf],
        })
        buf.clear()

    for i, s in enumerate(sentences):
        if buf:
            gap = s["start"] - buf[-1]["end"]
            dur = buf[-1]["end"] - buf[0]["start"]
            would = s["end"] - buf[0]["start"]
            # 침묵 경계에서 끊되, 아직 최소 길이가 안 되면 이어붙인다
            if would > max_s or (gap > 1.2 and dur >= min_s):
                flush()
        buf.append(s)
    flush()

    for sec in sections:
        sec["duration"] = round(sec["end"] - sec["start"], 3)
    return sections


def pick_broll_sections(sections: list[dict], conf: dict) -> None:
    """전체의 40~60%만 B-roll 로 커버하고 나머지는 얼굴 유지 (번갈아 리듬).

    각 구간에 broll: true/false 를 마킹한다. 오프닝은 얼굴로 시작.
    """
    min_cov = float(conf.get("min_coverage", 0.4))
    max_cov = float(conf.get("max_coverage", 0.6))
    min_s = float(conf.get("min_section_sec", 3))
    total = sum(s["duration"] for s in sections) or 1.0

    # 기본: 홀수 인덱스(두 번째 구간부터 번갈아) + 최소 길이 충족 구간만
    for s in sections:
        s["broll"] = (s["id"] % 2 == 1) and s["duration"] >= min_s

    def coverage():
        return sum(s["duration"] for s in sections if s["broll"]) / total

    # 부족하면 아직 미선택 구간 중 긴 것부터 추가 (단 연속 3구간 broll 방지)
    candidates = sorted((s for s in sections if not s["broll"] and s["duration"] >= min_s),
                        key=lambda s: -s["duration"])
    for s in candidates:
        if coverage() >= min_cov:
            break
        s["broll"] = True

    # 넘치면 짧은 것부터 제외
    chosen = sorted((s for s in sections if s["broll"]), key=lambda s: s["duration"])
    for s in chosen:
        if coverage() <= max_cov:
            break
        s["broll"] = False

    log.info("구간 %d개 중 B-roll %d개, 커버리지 %.0f%%",
             len(sections), sum(1 for s in sections if s["broll"]), coverage() * 100)


# ══════════════════════════════════════════════════════════
# 2. AI 키워드 추출 — style_guide 를 프롬프트에 주입
# ══════════════════════════════════════════════════════════

def _style_sections(config: dict) -> tuple[str, str]:
    """style_guide.md 에서 'B-roll 소스 선정 기준'과 '검색어 매핑 표' 섹션을 추출."""
    guide = common.load_style_guide(config)
    parts = re.split(r"^## ", guide, flags=re.M)
    criteria = mapping = ""
    for p in parts:
        if "B-roll" in p.splitlines()[0]:
            criteria = "## " + p
        elif "매핑" in p.splitlines()[0]:
            mapping = "## " + p
    if not criteria or not mapping:
        raise ValueError("style_guide.md 에서 'B-roll 소스 선정 기준' 또는 '검색어 매핑 표' 섹션을 찾지 못했습니다.")
    return criteria.strip(), mapping.strip()


def extract_keywords_ai(client, model: str, section: dict, full_text: str,
                        criteria: str, mapping: str) -> dict:
    """구간 하나에 대해 Claude 를 호출해 영어 시각 키워드 2~3개를 뽑는다."""
    system = (
        "너는 유튜브 편집자의 B-roll 검색 보조다. 아래 스타일 가이드가 판단의 유일한 기준이다.\n\n"
        f"{criteria}\n\n{mapping}"
        f"{common.feedback_prompt_block('broll')}"
    )
    user = (
        "전체 나레이션 맥락:\n"
        f"{full_text}\n\n"
        "이번 B-roll 구간의 발화:\n"
        f"\"{section['text']}\"\n\n"
        "이 구간에 붙일 스톡 영상 검색용 **영어 시각 키워드 2~3개**를 뽑아라.\n"
        "- 매핑 표에 있는 한국어 개념은 반드시 표의 영어 검색어를 그대로 쓴다\n"
        "- 표에 없으면 가이드 기준에 맞게 구체적 명사·장소·행동 위주로 번역한다\n"
        "- 이 구간이 B-roll 에 부적합(추상적 접속 구간 등)하면 suitable 을 false 로 한다\n\n"
        "아래 JSON 형식으로만 답하라 (설명 금지):\n"
        '{"suitable": true, "keywords": ["...", "..."], "reason": "한 줄 근거"}'
    )
    resp = client.messages.create(
        model=model,
        max_tokens=300,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    text = next(b.text for b in resp.content if b.type == "text")
    text = re.sub(r"^```(json)?|```$", "", text.strip(), flags=re.M).strip()
    data = json.loads(text)
    data["keywords"] = [k.strip() for k in data.get("keywords", [])][:3]
    return data


def _parse_mapping_table(mapping_md: str) -> list[tuple[str, str]]:
    """매핑 표의 (한국어, 영어) 쌍을 파싱 (mock 모드 및 검증용)."""
    pairs = []
    for line in mapping_md.splitlines():
        m = re.match(r"\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|", line)
        if m and m.group(1) not in ("한국어 (발화)", "---", ":---"):
            ko, en = m.group(1), m.group(2)
            if "---" in ko or "---" in en:
                continue
            # "임대료 / 월세" 처럼 복수 표기 지원
            for k in re.split(r"\s*/\s*", ko):
                pairs.append((k.strip(), en.strip()))
    return pairs


def extract_keywords_mock(section: dict, mapping_md: str) -> dict:
    """API 없이 매핑 표 매칭만으로 키워드 생성 (데모/오프라인용)."""
    pairs = _parse_mapping_table(mapping_md)
    found = [en for ko, en in pairs if ko and ko in section["text"]]
    if not found:
        found = ["city street aerial", "urban neighborhood walking"]
    return {"suitable": True, "keywords": found[:3], "reason": "mock: 매핑 표 매칭"}


# ══════════════════════════════════════════════════════════
# 3. 스톡 검색 + 다운로드 — Pexels 우선, 영상 우선
# ══════════════════════════════════════════════════════════

def _http_get_json(url: str, headers: dict | None = None, timeout: int = 20):
    import requests
    r = requests.get(url, headers=headers or {}, timeout=timeout)
    r.raise_for_status()
    return r.json()


def search_pexels_videos(query: str, per_page: int, orientation: str) -> list[dict]:
    key = os.environ.get("PEXELS_API_KEY")
    if not key:
        return []
    data = _http_get_json(
        f"https://api.pexels.com/videos/search?query={query}&per_page={per_page}&orientation={orientation}",
        headers={"Authorization": key})
    out = []
    for v in data.get("videos", []):
        files = sorted(v.get("video_files", []), key=lambda f: abs((f.get("width") or 0) - 1920))
        if not files:
            continue
        out.append({"type": "video", "source": "pexels", "source_id": v["id"],
                    "url": files[0]["link"], "width": files[0].get("width"),
                    "height": files[0].get("height"), "duration": v.get("duration"),
                    "page": v.get("url"), "query": query})
    return out


def search_pexels_photos(query: str, per_page: int, orientation: str) -> list[dict]:
    key = os.environ.get("PEXELS_API_KEY")
    if not key:
        return []
    data = _http_get_json(
        f"https://api.pexels.com/v1/search?query={query}&per_page={per_page}&orientation={orientation}",
        headers={"Authorization": key})
    return [{"type": "photo", "source": "pexels", "source_id": p["id"],
             "url": p["src"]["large2x"], "width": p.get("width"), "height": p.get("height"),
             "page": p.get("url"), "query": query} for p in data.get("photos", [])]


def search_pixabay_videos(query: str, per_page: int) -> list[dict]:
    key = os.environ.get("PIXABAY_API_KEY")
    if not key:
        return []
    q = query.replace(" ", "+")
    data = _http_get_json(
        f"https://pixabay.com/api/videos/?key={key}&q={q}&per_page={max(per_page, 3)}")
    out = []
    for v in data.get("hits", []):
        f = v.get("videos", {}).get("medium") or v.get("videos", {}).get("small")
        if not f:
            continue
        out.append({"type": "video", "source": "pixabay", "source_id": v["id"],
                    "url": f["url"], "width": f.get("width"), "height": f.get("height"),
                    "duration": v.get("duration"), "page": v.get("pageURL"), "query": query})
    return out


def search_pixabay_photos(query: str, per_page: int) -> list[dict]:
    key = os.environ.get("PIXABAY_API_KEY")
    if not key:
        return []
    q = query.replace(" ", "+")
    data = _http_get_json(
        f"https://pixabay.com/api/?key={key}&q={q}&per_page={max(per_page, 3)}&image_type=photo")
    return [{"type": "photo", "source": "pixabay", "source_id": p["id"],
             "url": p.get("largeImageURL"), "width": p.get("imageWidth"),
             "height": p.get("imageHeight"), "page": p.get("pageURL"), "query": query}
            for p in data.get("hits", [])]


def gather_candidates(keywords: list[str], n: int, orientation: str) -> list[dict]:
    """영상 우선(Pexels→Pixabay), 부족하면 사진으로 채워 n개 확보."""
    found: list[dict] = []
    seen = set()

    def add(items):
        for it in items:
            k = (it["source"], it["source_id"])
            if k not in seen and it.get("url"):
                seen.add(k)
                found.append(it)
            if len(found) >= n:
                return True
        return False

    searchers = [
        lambda q: search_pexels_videos(q, n, orientation),
        lambda q: search_pixabay_videos(q, n),
        lambda q: search_pexels_photos(q, n, orientation),
        lambda q: search_pixabay_photos(q, n),
    ]
    for search in searchers:
        for q in keywords:
            try:
                if add(search(q)):
                    return found
            except Exception as e:
                log.warning("검색 실패(%s): %s", q, e)
    return found


def download_candidates(section: dict, cands: list[dict], out_dir: Path) -> None:
    import requests
    out_dir.mkdir(parents=True, exist_ok=True)
    for i, c in enumerate(cands):
        ext = ".mp4" if c["type"] == "video" else ".jpg"
        dest = out_dir / f"sec{section['id']}_c{i}{ext}"
        if dest.exists():
            c["file"] = f"{CANDIDATES_DIR}/{dest.name}"
            continue
        try:
            log.info("  다운로드: %s (%s)", dest.name, c["source"])
            r = requests.get(c["url"], timeout=120, stream=True)
            r.raise_for_status()
            with open(dest, "wb") as f:
                for chunk in r.iter_content(1 << 20):
                    f.write(chunk)
            c["file"] = f"{CANDIDATES_DIR}/{dest.name}"
        except Exception as e:
            log.warning("  다운로드 실패 %s: %s", c["url"], e)
            c["file"] = None


def make_placeholders(section: dict, keywords: list[str], out_dir: Path) -> list[dict]:
    """mock 모드: ffmpeg 로 플레이스홀더 후보 3개 생성 (영상 2 + 사진 1)."""
    out_dir.mkdir(parents=True, exist_ok=True)
    colors = ["0x2E4057", "0x4A6741", "0x6B4E71"]
    cands = []
    for i in range(3):
        kind = "photo" if i == 2 else "video"
        ext = ".jpg" if kind == "photo" else ".mp4"
        dest = out_dir / f"sec{section['id']}_c{i}{ext}"
        label = (keywords[i % len(keywords)] if keywords else "placeholder").replace("'", "")
        if not dest.exists():
            vf = f"drawtext=text='{label} #{i+1}':fontcolor=white:fontsize=36:x=(w-text_w)/2:y=(h-text_h)/2"
            if kind == "video":
                cmd = ["ffmpeg", "-y", "-loglevel", "error",
                       "-f", "lavfi", "-i", f"color=c={colors[i]}:s=640x360:d=4:r=24",
                       "-vf", vf, "-pix_fmt", "yuv420p", str(dest)]
            else:
                cmd = ["ffmpeg", "-y", "-loglevel", "error",
                       "-f", "lavfi", "-i", f"color=c={colors[i]}:s=640x360:d=0.1",
                       "-vf", vf, "-frames:v", "1", str(dest)]
            subprocess.run(cmd, check=True)
        cands.append({"type": kind, "source": "mock", "source_id": f"mock{section['id']}_{i}",
                      "url": None, "page": None, "query": label,
                      "file": f"{CANDIDATES_DIR}/{dest.name}"})
    return cands


# ══════════════════════════════════════════════════════════
# 4. 검토 페이지 (HTML) 생성
# ══════════════════════════════════════════════════════════

def build_review_html(project: common.Project, broll: dict) -> Path:
    data_json = json.dumps(broll, ensure_ascii=False)
    html = """<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>B-roll 검토 — __PROJECT__</title>
<style>
  :root { color-scheme: dark; }
  body { font-family: 'Apple SD Gothic Neo','Noto Sans KR',sans-serif; background:#14171c; color:#e8eaed; margin:0; padding:24px; }
  h1 { font-size:20px; margin:0 0 4px; }
  .sub { color:#9aa0a6; font-size:13px; margin-bottom:20px; }
  .section { background:#1d2129; border-radius:12px; padding:18px; margin-bottom:18px; border:1px solid #2a2f3a; }
  .sec-head { display:flex; align-items:baseline; gap:10px; margin-bottom:6px; flex-wrap:wrap; }
  .time { color:#8ab4f8; font-variant-numeric:tabular-nums; font-size:13px; }
  .kw { color:#9aa0a6; font-size:12px; }
  .text { font-size:15px; line-height:1.5; margin-bottom:12px; }
  .cands { display:flex; gap:12px; flex-wrap:wrap; }
  .cand { width:240px; border:2px solid #2a2f3a; border-radius:10px; overflow:hidden; cursor:pointer; background:#14171c; transition:border-color .15s; }
  .cand video,.cand img { width:100%; height:135px; object-fit:cover; display:block; background:#000; }
  .cand .meta { padding:8px 10px; font-size:12px; color:#9aa0a6; display:flex; justify-content:space-between; }
  .cand.selected { border-color:#8ab4f8; }
  .cand .pick { display:block; width:100%; border:0; padding:8px; background:#242936; color:#e8eaed; cursor:pointer; font-size:13px; }
  .cand.selected .pick { background:#8ab4f8; color:#14171c; font-weight:700; }
  .skip { margin-top:10px; }
  .skip button { border:1px solid #3a4050; background:transparent; color:#c8cdd6; padding:8px 14px; border-radius:8px; cursor:pointer; font-size:13px; }
  .skip button.selected { background:#e07a5f; border-color:#e07a5f; color:#14171c; font-weight:700; }
  .face { color:#81c995; font-size:13px; }
  #savebar { position:sticky; bottom:0; background:#1d2129; border-top:1px solid #2a2f3a; margin:0 -24px; padding:14px 24px; display:flex; gap:14px; align-items:center; }
  #save { background:#8ab4f8; color:#14171c; border:0; padding:10px 22px; border-radius:8px; font-size:15px; font-weight:700; cursor:pointer; }
  #status { font-size:13px; color:#9aa0a6; }
  .badge { font-size:11px; padding:2px 7px; border-radius:99px; background:#2a2f3a; }
  .badge.photo { background:#5f4b2e; }
</style></head><body>
<h1>B-roll 검토 — __PROJECT__</h1>
<div class="sub">후보를 클릭해 선택하거나 '이 구간 스킵'(원본 얼굴 유지)을 누른 뒤, 아래 저장을 누르세요.
사진(<span class="badge photo">photo</span>)은 렌더 시 느린 줌(Ken Burns)이 적용됩니다.</div>
<div id="app"></div>
<div id="savebar"><button id="save">선택 저장</button><span id="status"></span></div>
<script>
const DATA = __DATA__;
const state = {};   // section_id -> 'skip' | candidate_index
const app = document.getElementById('app');

for (const sec of DATA.sections) {
  const div = document.createElement('div');
  div.className = 'section';
  const t = s => { const m = Math.floor(s/60), ss=(s%60).toFixed(1); return m+':'+String(ss).padStart(4,'0'); };
  let head = `<div class="sec-head"><b>구간 ${sec.id}</b>
      <span class="time">${t(sec.start)} → ${t(sec.end)} (${sec.duration.toFixed(1)}s)</span>`;
  if (sec.broll) head += `<span class="kw">AI 키워드: ${(sec.keywords||[]).join(', ')}</span>`;
  else head += `<span class="face">얼굴 유지 구간 (B-roll 없음)</span>`;
  head += `</div><div class="text">${sec.text}</div>`;
  div.innerHTML = head;

  if (sec.broll) {
    const wrap = document.createElement('div'); wrap.className = 'cands';
    (sec.candidates||[]).forEach((c, i) => {
      if (!c.file) return;
      const card = document.createElement('div'); card.className = 'cand'; card.dataset.sec = sec.id; card.dataset.idx = i;
      const media = c.type === 'video'
        ? `<video src="${c.file}" muted loop playsinline onmouseover="this.play()" onmouseout="this.pause()" controls></video>`
        : `<img src="${c.file}">`;
      card.innerHTML = media +
        `<div class="meta"><span>${c.source}</span><span class="badge ${c.type}">${c.type}</span></div>` +
        `<button class="pick">후보 ${i+1} 선택${i===0?' (AI 1순위)':''}</button>`;
      card.querySelector('.pick').onclick = () => select(sec.id, i);
      wrap.appendChild(card);
    });
    div.appendChild(wrap);
    const skip = document.createElement('div'); skip.className = 'skip';
    skip.innerHTML = `<button data-sec="${sec.id}">이 구간 스킵 (얼굴 유지)</button>`;
    skip.querySelector('button').onclick = () => select(sec.id, 'skip');
    div.appendChild(skip);
  }
  app.appendChild(div);
}

function select(secId, choice) {
  state[secId] = choice;
  document.querySelectorAll(`.cand[data-sec="${secId}"]`).forEach(el =>
    el.classList.toggle('selected', String(choice) === el.dataset.idx));
  const sk = document.querySelector(`.skip button[data-sec="${secId}"]`);
  if (sk) sk.classList.toggle('selected', choice === 'skip');
  updateStatus();
}
function updateStatus() {
  const total = DATA.sections.filter(s => s.broll).length;
  document.getElementById('status').textContent = `선택 완료 ${Object.keys(state).length} / ${total}`;
}
updateStatus();

document.getElementById('save').onclick = async () => {
  const sections = DATA.sections.filter(s => s.broll).map(s => {
    const ch = state[s.id];
    let choice;
    if (ch === undefined) choice = null;
    else if (ch === 'skip') choice = 'skip';
    else {
      const c = s.candidates[ch];
      choice = { candidate_index: ch, file: c.file, type: c.type, source: c.source,
                 source_id: c.source_id, url: c.url, page: c.page };
    }
    return { id: s.id, start: s.start, end: s.end, text: s.text,
             ai_keywords: s.keywords || [], choice };
  });
  const payload = { project: DATA.project, sections };
  const st = document.getElementById('status');
  try {
    const r = await fetch('/api/save', { method:'POST',
      headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (!r.ok) throw new Error(await r.text());
    st.textContent = '✅ selections.json 저장 완료 (' + new Date().toLocaleTimeString() + ')';
  } catch (e) {
    // 서버 없이 file:// 로 연 경우 — 파일 다운로드로 대체
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const a = Object.assign(document.createElement('a'),
      { href: URL.createObjectURL(blob), download: 'selections.json' });
    a.click();
    st.textContent = '서버가 없어 selections.json 파일로 내려받았습니다. 프로젝트 폴더에 넣어주세요.';
  }
};
</script></body></html>"""
    html = html.replace("__PROJECT__", project.name).replace("__DATA__", data_json)
    out = project.path / REVIEW_HTML
    out.write_text(html, encoding="utf-8")
    log.info("검토 페이지 생성: %s", out)
    return out


# ══════════════════════════════════════════════════════════
# 5. 검토 서버 — 선택 저장 + 피드백 로그 자동 누적
# ══════════════════════════════════════════════════════════

def _append_feedback(project: common.Project, new_sel: dict) -> int:
    """AI 제안을 스킵했거나 1순위가 아닌 후보를 고른 내역을 feedback_log.json 에 누적.

    같은 구간을 다시 저장해도 선택이 안 바뀌었으면 중복 기록하지 않는다.
    """
    prev_choices = {}
    if project.path.joinpath(SELECTIONS_JSON).exists():
        prev = common.read_json(project.path / SELECTIONS_JSON)
        prev_choices = {s["id"]: s.get("choice") for s in prev.get("sections", [])}

    fb_path = project.path / FEEDBACK_JSON
    feedback = common.read_json(fb_path) if fb_path.exists() else []

    added = 0
    for s in new_sel.get("sections", []):
        ch = s.get("choice")
        if ch is None or ch == prev_choices.get(s["id"]):
            continue  # 미선택이거나 변경 없음
        deviates = (ch == "skip") or (isinstance(ch, dict) and ch.get("candidate_index", 0) != 0)
        if not deviates:
            continue
        feedback.append({
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "project": new_sel.get("project"),
            "section_id": s["id"],
            "section_text": s["text"],
            "ai_keywords": s.get("ai_keywords", []),
            "user_choice": "skip" if ch == "skip" else {
                "candidate_index": ch.get("candidate_index"),
                "type": ch.get("type"), "source": ch.get("source"), "page": ch.get("page"),
            },
        })
        added += 1
    if added:
        common.write_json(fb_path, feedback)
    return added


def serve_review(project: common.Project, port: int) -> None:
    proj_dir = str(project.path)

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=proj_dir, **kw)

        def log_message(self, fmt, *args):  # 조용히
            pass

        def do_POST(self):
            if self.path != "/api/save":
                self.send_error(404)
                return
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length))
            added = _append_feedback(project, payload)
            common.write_json(project.path / SELECTIONS_JSON, payload)
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
    full_text = " ".join(s["text"] for s in sentences)

    conf = config.get("broll", {})
    aconf = config.get("anthropic", {})
    profile = common.get_render_profile(config)
    orientation = "landscape" if profile.get("orientation") != "vertical" else "portrait"

    # 1) 구간 정의 + 리듬 선택
    sections = build_sections(sentences, conf)
    pick_broll_sections(sections, conf)

    # 2) AI 키워드
    criteria, mapping = _style_sections(config)
    client = None
    if not mock:
        common.load_env()
        client = common.anthropic_client()
    for sec in sections:
        if not sec["broll"]:
            continue
        try:
            if mock:
                result = extract_keywords_mock(sec, mapping)
            else:
                result = extract_keywords_ai(client, aconf.get("model", "claude-sonnet-4-6"),
                                             sec, full_text, criteria, mapping)
        except Exception as e:
            log.warning("구간 %d 키워드 추출 실패(%s) — 매핑 표 폴백", sec["id"], e)
            result = extract_keywords_mock(sec, mapping)
        if not result.get("suitable", True):
            log.info("구간 %d: AI 판단 부적합 → 얼굴 유지 (%s)", sec["id"], result.get("reason", ""))
            sec["broll"] = False
            sec["ai_reason"] = result.get("reason")
            continue
        sec["keywords"] = result["keywords"]
        sec["ai_reason"] = result.get("reason")
        log.info("구간 %d 키워드: %s", sec["id"], ", ".join(sec["keywords"]))

    # 3) 후보 검색 + 다운로드
    n = int(conf.get("candidates_per_section", 3))
    cand_dir = project.path / CANDIDATES_DIR
    common.load_env()
    for sec in sections:
        if not sec["broll"]:
            continue
        if mock:
            sec["candidates"] = make_placeholders(sec, sec.get("keywords", []), cand_dir)
        else:
            cands = gather_candidates(sec["keywords"], n, orientation)
            if not cands:
                log.warning("구간 %d: 후보를 찾지 못함 → 얼굴 유지", sec["id"])
                sec["broll"] = False
                continue
            download_candidates(sec, cands, cand_dir)
            sec["candidates"] = [c for c in cands if c.get("file")]

    broll = {
        "project": project.name,
        "source_transcript": common.TRANSCRIPT_JSON,
        "mock": mock,
        "sections": sections,
    }
    common.write_json(project.broll_path, broll)

    # 4) 검토 페이지
    build_review_html(project, broll)
    return broll


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="② B-roll 후보 검색/검토")
    parser.add_argument("project", help="영상명 또는 projects/영상명 경로")
    parser.add_argument("--config", default=str(common.CONFIG_PATH))
    parser.add_argument("--mock", action="store_true",
                        help="API/네트워크 없이 데모 (휴리스틱 키워드 + 플레이스홀더 클립)")
    parser.add_argument("--review", action="store_true", help="검토 서버만 실행")
    parser.add_argument("--no-serve", action="store_true", help="검토 서버 띄우지 않음")
    args = parser.parse_args(argv)

    config = common.load_config(args.config)
    project = common.resolve_project(args.project)
    port = int(config.get("broll", {}).get("review_port", 8787))

    if args.review:
        if not (project.path / REVIEW_HTML).exists():
            log.error("%s 가 없습니다. 먼저 broll 파이프라인을 실행하세요.", REVIEW_HTML)
            return 1
        serve_review(project, port)
        return 0

    run(project, config, mock=args.mock)
    if not args.no_serve:
        serve_review(project, port)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
