#!/usr/bin/env python3
"""① 전사 단계 — faster-whisper 로 원본을 전사하고 문장별 타임스탬프를 낸다.

독립 실행:
    python youtube_pipeline/pipeline/transcribe.py <영상명|프로젝트경로> [--model small]

입력: projects/<영상명>/ 안의 원본 영상/오디오
출력: projects/<영상명>/transcript.json

transcript.json 스키마:
    {
      "project": "...", "source": "원본파일명",
      "language": "ko", "duration": 12.3, "model": "small",
      "sentences": [ {"id":0,"start":0.0,"end":3.2,"text":"..."} , ... ],
      "segments": [ ...whisper 원본 세그먼트(단어 타임스탬프 포함)... ]
    }
`sentences` 가 이후 단계(B-roll·자막)의 기본 입력이다.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

# 어느 위치에서 실행하든 common 을 찾도록 자기 디렉토리를 경로에 추가
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

log = common.get_logger("transcribe")

# 문장 종결로 볼 문자 (한국어/영문/기호)
_SENT_END = tuple(".?!…。！？")

# 띄어쓰기 교정 후 숫자+단위가 "1 층"처럼 쪼개지는 것 되돌리기
_NUM_UNIT = re.compile(
    r"(\d)\s+(층|평|년|월|일|시|분|초|원|개|명|호|건|곳|배|번|위|천|만|억|조|%|퍼센트)"
)

_kiwi = None  # 지연 로드 (모델 로딩이 느려서 필요할 때 한 번만)


def _fix_spacing(text: str) -> str:
    """한국어 띄어쓰기 교정 (Kiwi 형태소 분석기).

    - 빠진 띄어쓰기를 삽입한다 (기존 띄어쓰기는 최대한 보존)
    - 숫자+단위("1 층")가 쪼개지면 다시 붙인다
    - kiwipiepy 미설치 시 원문 그대로 반환 (경고 1회)
    """
    global _kiwi
    if _kiwi is None:
        try:
            from kiwipiepy import Kiwi
            _kiwi = Kiwi()
        except ImportError:
            log.warning("kiwipiepy 미설치 — 띄어쓰기 교정 생략 (pip install kiwipiepy)")
            _kiwi = False
    if not _kiwi:
        return text
    fixed = _kiwi.space(text, reset_whitespace=False)
    fixed = _NUM_UNIT.sub(r"\1\2", fixed)
    # "1200만 원" → "1200만원" (자막 관례)
    return re.sub(r"(\d[천만억조]?)\s+(원)", r"\1\2", fixed)


def _regroup_into_sentences(segments: list[dict]) -> list[dict]:
    """단어 타임스탬프를 문장 종결부호 기준으로 문장 단위로 재그룹한다.

    단어 타임스탬프가 없거나 전사 전체에서 종결부호가 하나도 안 나오면
    whisper 세그먼트 자체를 문장으로 폴백한다.
    """
    # 모든 단어 수집
    words: list[dict] = []
    for seg in segments:
        for w in seg.get("words") or []:
            token = (w.get("word") or "").strip()
            if token:
                words.append(w)

    if not words:
        return _segments_as_sentences(segments)

    sentences: list[dict] = []
    buf: list[dict] = []
    for w in words:
        buf.append(w)
        if (w.get("word") or "").strip().endswith(_SENT_END):
            sentences.append(_flush(buf, len(sentences)))
            buf = []
    if buf:
        sentences.append(_flush(buf, len(sentences)))

    # 종결부호가 전무해 통짜 한 문장만 나온 경우 → 세그먼트 폴백이 더 유용
    if len(sentences) <= 1 and len(segments) > 1:
        return _segments_as_sentences(segments)
    return sentences


def _flush(words: list[dict], idx: int) -> dict:
    text = "".join(w.get("word", "") for w in words).strip()
    return {
        "id": idx,
        "start": round(float(words[0]["start"]), 3),
        "end": round(float(words[-1]["end"]), 3),
        "text": text,
    }


def _segments_as_sentences(segments: list[dict]) -> list[dict]:
    out: list[dict] = []
    for i, seg in enumerate(segments):
        text = (seg.get("text") or "").strip()
        if not text:
            continue
        out.append({
            "id": len(out),
            "start": round(float(seg["start"]), 3),
            "end": round(float(seg["end"]), 3),
            "text": text,
        })
    return out


def _resolve_model(model_name: str) -> str:
    """모델 이름을 로컬 경로로 해석. youtube_pipeline/models/ 아래에
    같은 이름(또는 -int8 변형) 폴더가 있으면 그것을 쓴다 (오프라인 지원).
    없으면 이름 그대로 반환해 faster-whisper 가 다운로드하게 둔다."""
    p = Path(model_name)
    if p.is_dir():
        return str(p)
    models_dir = common.ROOT_DIR / "models"
    for cand in (models_dir / model_name, models_dir / f"{model_name}-int8"):
        if (cand / "model.bin").exists():
            log.info("로컬 모델 사용: %s", cand)
            return str(cand)
    return model_name


def transcribe(project: common.Project, config: dict) -> dict:
    from faster_whisper import WhisperModel

    tconf = config.get("transcribe", {})
    model_name = _resolve_model(tconf.get("model", "small"))
    language = tconf.get("language") or None
    device = tconf.get("device", "cpu")
    compute_type = tconf.get("compute_type", "int8")
    vad_filter = bool(tconf.get("vad_filter", True))
    beam_size = int(tconf.get("beam_size", 5))

    source = project.find_source_media()
    log.info("원본: %s", source)
    log.info("모델 로드: %s (device=%s, compute=%s)", model_name, device, compute_type)

    model = WhisperModel(model_name, device=device, compute_type=compute_type)

    log.info("전사 시작 (language=%s, vad=%s)...", language or "auto", vad_filter)
    seg_iter, info = model.transcribe(
        str(source),
        language=language,
        beam_size=beam_size,
        vad_filter=vad_filter,
        word_timestamps=True,
    )

    segments: list[dict] = []
    for seg in seg_iter:
        segments.append({
            "id": seg.id,
            "start": round(seg.start, 3),
            "end": round(seg.end, 3),
            "text": seg.text.strip(),
            "words": [
                {"start": round(w.start, 3), "end": round(w.end, 3), "word": w.word}
                for w in (seg.words or [])
            ],
        })
        log.info("  [%6.2f→%6.2f] %s", seg.start, seg.end, seg.text.strip())

    sentences = _regroup_into_sentences(segments)
    if not sentences and info.duration > 1.0:
        log.warning(
            "전사 결과가 비어 있습니다 (길이 %.1fs). 일시적 오류일 수 있으니 다시 실행해 보고, "
            "반복되면 config 의 vad_filter 를 false 로 바꿔 보세요.", info.duration
        )

    # 한국어 띄어쓰기 교정 — 원문은 text_raw 로 보존
    if info.language == "ko" and tconf.get("fix_spacing", True):
        log.info("띄어쓰기 교정 중 (Kiwi)...")
        for s in sentences:
            fixed = _fix_spacing(s["text"])
            if fixed != s["text"]:
                s["text_raw"] = s["text"]
                s["text"] = fixed
                log.info("  교정: %s → %s", s["text_raw"], s["text"])

    result = {
        "project": project.name,
        "source": source.name,
        "language": info.language,
        "language_probability": round(getattr(info, "language_probability", 0.0) or 0.0, 3),
        "duration": round(info.duration, 3),
        "model": model_name,
        "sentences": sentences,
        "segments": segments,
    }
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="① Whisper 전사 → transcript.json")
    parser.add_argument("project", help="영상명 또는 projects/영상명 경로")
    parser.add_argument("--model", help="whisper 모델 오버라이드 (tiny/base/small/medium/large-v3)")
    parser.add_argument("--language", help="언어 코드 오버라이드 (예: ko). 'auto' 면 자동감지")
    parser.add_argument("--config", default=str(common.CONFIG_PATH), help="config.yaml 경로")
    args = parser.parse_args(argv)

    config = common.load_config(args.config)
    if args.model:
        config.setdefault("transcribe", {})["model"] = args.model
    if args.language:
        config.setdefault("transcribe", {})["language"] = None if args.language == "auto" else args.language

    project = common.resolve_project(args.project)
    if not project.path.is_dir():
        log.error("프로젝트 폴더가 없습니다: %s", project.path)
        return 1

    result = transcribe(project, config)
    common.write_json(project.transcript_path, result)

    n = len(result["sentences"])
    log.info("완료: %d개 문장, %.1fs, 언어=%s → %s",
             n, result["duration"], result["language"], project.transcript_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
