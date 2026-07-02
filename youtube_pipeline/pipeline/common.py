"""파이프라인 공통 유틸.

- config.yaml / .env 로드
- 프로젝트 폴더(projects/영상명/) 경로 해석 및 원본 미디어 탐색
- 중간 결과 JSON 저장/로드 (각 단계가 이어받는 계약)
- style_guide.md 로더 (AI 판단 기준은 코드가 아니라 이 파일에서 온다)
- Anthropic 클라이언트 팩토리

각 단계 스크립트는 파일 위치를 sys.path 에 넣고 `import common` 하면
어느 디렉토리에서 실행하든 동작한다.
"""

from __future__ import annotations

import json
import logging
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

try:
    from dotenv import load_dotenv
except ImportError:  # dotenv 미설치 시에도 환경변수만으로 동작
    def load_dotenv(*_a, **_k):  # type: ignore
        return False


# ── 경로 상수 ──────────────────────────────────────────────
PIPELINE_DIR = Path(__file__).resolve().parent          # .../youtube_pipeline/pipeline
ROOT_DIR = PIPELINE_DIR.parent                           # .../youtube_pipeline
PROJECTS_DIR = ROOT_DIR / "projects"
CONFIG_PATH = ROOT_DIR / "config.yaml"
ENV_PATH = ROOT_DIR / ".env"

# 단계별 산출물 파일명 (단계 간 계약)
TRANSCRIPT_JSON = "transcript.json"
BROLL_JSON = "broll.json"
SUBTITLE_JSON = "subtitle.json"
OUTPUT_VIDEO = "output.mp4"

# 원본 영상으로 인정하는 확장자
VIDEO_EXTS = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"}
AUDIO_EXTS = {".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg"}


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("[%(asctime)s] %(levelname)s %(name)s: %(message)s",
                                                datefmt="%H:%M:%S"))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger


log = get_logger("pipeline")


# ── 설정/환경 ──────────────────────────────────────────────
def load_config(path: Path | str = CONFIG_PATH) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_env() -> None:
    """youtube_pipeline/.env 를 로드. 이미 설정된 환경변수는 덮지 않는다."""
    if ENV_PATH.exists():
        load_dotenv(ENV_PATH)
    else:
        load_dotenv()  # 상위 탐색 (없으면 무시)


def require_env(key: str) -> str:
    load_env()
    val = os.environ.get(key)
    if not val:
        raise RuntimeError(
            f"환경변수 {key} 가 없습니다. {ENV_PATH} 에 설정하세요 (.env.example 참고)."
        )
    return val


def get_render_profile(config: dict[str, Any]) -> dict[str, Any]:
    """config.render.active_profile 로 지정된 렌더 프로파일을 돌려준다."""
    render = config.get("render", {})
    profiles = render.get("profiles", {})
    active = render.get("active_profile", "landscape")
    if active not in profiles:
        raise ValueError(f"render.active_profile '{active}' 가 profiles 에 없습니다.")
    return profiles[active]


# ── 프로젝트 폴더 ──────────────────────────────────────────
@dataclass
class Project:
    """projects/영상명/ 하나를 나타낸다."""
    name: str
    path: Path

    @property
    def transcript_path(self) -> Path:
        return self.path / TRANSCRIPT_JSON

    @property
    def broll_path(self) -> Path:
        return self.path / BROLL_JSON

    @property
    def subtitle_path(self) -> Path:
        return self.path / SUBTITLE_JSON

    @property
    def output_path(self) -> Path:
        return self.path / OUTPUT_VIDEO

    def find_source_media(self) -> Path:
        """프로젝트 폴더에서 원본 영상/오디오 파일을 하나 찾는다.

        규칙: 파이프라인 산출물(output.mp4 등)은 제외. 영상 우선, 없으면 오디오.
        """
        candidates: list[Path] = []
        for p in sorted(self.path.iterdir()):
            if not p.is_file():
                continue
            if p.name == OUTPUT_VIDEO:
                continue
            ext = p.suffix.lower()
            if ext in VIDEO_EXTS or ext in AUDIO_EXTS:
                candidates.append(p)
        if not candidates:
            raise FileNotFoundError(
                f"'{self.path}' 안에 원본 영상/오디오가 없습니다. "
                f"지원 확장자: {sorted(VIDEO_EXTS | AUDIO_EXTS)}"
            )
        # 영상 우선
        videos = [c for c in candidates if c.suffix.lower() in VIDEO_EXTS]
        return (videos or candidates)[0]


def resolve_project(arg: str) -> Project:
    """CLI 인자를 프로젝트로 해석.

    허용 형태:
      - 영상명            → projects/영상명
      - projects/영상명    → 그대로
      - 절대/상대 폴더 경로 → 그대로
    """
    p = Path(arg)
    if p.is_dir():
        path = p.resolve()
    elif (PROJECTS_DIR / arg).is_dir():
        path = (PROJECTS_DIR / arg).resolve()
    else:
        # 아직 없으면 projects/ 아래로 가정 (생성은 호출부 책임)
        path = (PROJECTS_DIR / arg).resolve()
    return Project(name=path.name, path=path)


# ── JSON I/O ───────────────────────────────────────────────
def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    log.info("저장: %s", path)


def read_json(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ── style_guide.md ─────────────────────────────────────────
def load_style_guide(config: dict[str, Any] | None = None) -> str:
    """AI 판단 프롬프트에 넣을 스타일 가이드 전문을 읽는다.

    broll.py / subtitle.py 는 반드시 이 함수를 통해 기준을 주입한다.
    기준을 코드에 하드코딩하지 않기 위함.
    """
    config = config or load_config()
    name = config.get("anthropic", {}).get("style_guide", "style_guide.md")
    path = ROOT_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"style_guide 파일이 없습니다: {path}")
    return path.read_text(encoding="utf-8")


# ── 피드백 학습 루프 ───────────────────────────────────────
def collect_feedback(stage: str, limit: int = 20) -> list[dict]:
    """모든 프로젝트의 feedback_log.json 에서 해당 단계 피드백을 최신순으로 모은다.

    stage: "broll" (스킵/후보 변경) 또는 "subtitle" (스타일 수정)
    broll 단계 초기 항목에는 stage 필드가 없으므로 없으면 broll 로 간주.
    """
    entries: list[dict] = []
    if not PROJECTS_DIR.exists():
        return entries
    for fb in PROJECTS_DIR.glob("*/feedback_log.json"):
        try:
            for e in read_json(fb):
                if e.get("stage", "broll") == stage:
                    entries.append(e)
        except Exception:
            continue
    entries.sort(key=lambda e: e.get("ts", ""), reverse=True)
    return entries[:limit]


def feedback_prompt_block(stage: str, limit: int = 20) -> str:
    """AI 프롬프트에 주입할 '과거 사용자 피드백' 블록. 피드백이 없으면 빈 문자열.

    broll.py / subtitle.py 가 판단 프롬프트에 덧붙여, 사용자가 과거에 AI 제안을
    어떻게 고쳤는지를 다음 판단에 반영한다 (쓸수록 취향에 수렴).
    """
    entries = collect_feedback(stage, limit)
    if not entries:
        return ""
    lines = []
    for e in entries:
        if e.get("stage", "broll") == "broll":
            ch = e.get("user_choice")
            if ch == "skip":
                action = "AI가 제안한 B-roll을 스킵하고 얼굴샷 유지"
            else:
                action = (f"AI 1순위 대신 {ch.get('candidate_index', '?')}번 후보"
                          f"({ch.get('type', '?')}) 선택")
            lines.append(f'- 발화 "{e.get("section_text", "")}" '
                         f'(AI 키워드: {", ".join(e.get("ai_keywords", []))}) → {action}')
        else:
            diffs = []
            for k, v in e.get("changes", {}).items():
                diffs.append(f"{k}: {v.get('ai')} → {v.get('user')}")
            lines.append(f'- 문장 "{e.get("sentence_text", "")}" → 사용자가 수정: {"; ".join(diffs)}')
    return (
        "\n\n## 과거 사용자 피드백 (최근 순 — 이 사용자의 취향이므로 판단에 적극 반영하라)\n"
        + "\n".join(lines)
    )


# ── 고유명사 사전 (glossary) ───────────────────────────────
GLOSSARY_PATH = ROOT_DIR / "glossary.txt"


def load_glossary() -> list[str]:
    """자주 쓰는 고유명사/용어 목록. 전사 힌트·띄어쓰기 보호·오인식 치환에 사용."""
    if not GLOSSARY_PATH.exists():
        return []
    terms = []
    for line in GLOSSARY_PATH.read_text(encoding="utf-8").splitlines():
        line = line.split("#")[0].strip()
        if line:
            terms.append(line)
    return terms


# ── Anthropic ──────────────────────────────────────────────
def anthropic_client():
    """Anthropic 클라이언트. broll/subtitle 단계에서 사용."""
    try:
        import anthropic
    except ImportError as e:
        raise RuntimeError("anthropic SDK 미설치: pip install anthropic") from e
    return anthropic.Anthropic(api_key=require_env("ANTHROPIC_API_KEY"))
