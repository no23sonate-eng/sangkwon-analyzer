#!/usr/bin/env python3
"""faster-whisper 모델 오프라인 설치 스크립트.

huggingface.co 가 막힌 환경(예: 원격 실행 환경의 egress 정책)에서도
GitHub 릴리스(rhasspy/models)에서 CT2 변환 모델을 받아 로컬에 설치한다.

  python youtube_pipeline/scripts/setup_model.py           # small-int8 (기본)
  python youtube_pipeline/scripts/setup_model.py tiny-int8

하는 일:
  1. rhasspy/models GitHub 릴리스에서 CT2 모델(tar.gz) 다운로드 → models/<이름>/
  2. openai/whisper 공식 저장소의 tiktoken 데이터로 tokenizer.json 생성
     (모델 vocabulary.txt 의 실제 토큰 순서를 그대로 사용해 id 정합 보장)
  3. openai/whisper 공식 alignment heads 를 디코딩해 config.json 에 추가
     (단어 단위 타임스탬프에 필요 — 구버전 CT2 변환본에는 빠져 있음)

필요 패키지: requests, transformers, tiktoken, numpy  (pip install)
huggingface.co 접속이 되는 환경이라면 이 스크립트 없이 config.yaml 의
모델 이름만으로 faster-whisper 가 알아서 받는다.
"""

from __future__ import annotations

import base64
import gzip
import json
import re
import sys
import tarfile
import tempfile
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent      # youtube_pipeline/
MODELS_DIR = ROOT / "models"

RHASSPY_URL = "https://github.com/rhasspy/models/releases/download/v1.0/asr_faster-whisper-{name}.tar.gz"
TIKTOKEN_URL = "https://raw.githubusercontent.com/openai/whisper/main/whisper/assets/multilingual.tiktoken"
WHISPER_INIT_URL = "https://raw.githubusercontent.com/openai/whisper/main/whisper/__init__.py"

# 모델별 (레이어, 헤드) 수 — alignment heads 비트마스크 해석용
MODEL_SHAPE = {"tiny": (4, 6), "base": (6, 8), "small": (12, 12), "medium": (24, 16)}


def download(url: str, dest: Path) -> None:
    print(f"다운로드: {url}")
    r = requests.get(url, stream=True, timeout=600)
    r.raise_for_status()
    with open(dest, "wb") as f:
        for chunk in r.iter_content(1 << 20):
            f.write(chunk)


def fetch_model(name: str) -> Path:
    """rhasspy/models 릴리스에서 CT2 모델을 받아 models/<name>/ 에 푼다."""
    target = MODELS_DIR / name
    if (target / "model.bin").exists():
        print(f"이미 존재: {target}")
        return target
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False) as tmp:
        download(RHASSPY_URL.format(name=name), Path(tmp.name))
        with tarfile.open(tmp.name) as tf:
            tf.extractall(MODELS_DIR)  # 아카이브 내부 폴더명 == name
    assert (target / "model.bin").exists(), f"압축 해제 실패: {target}"
    return target


def build_tokenizer(model_dir: Path) -> None:
    """tiktoken 원본 + 모델 vocabulary.txt 순서로 tokenizer.json 생성."""
    out = model_dir / "tokenizer.json"
    if out.exists():
        print(f"이미 존재: {out}")
        return
    from tokenizers import AddedToken
    from transformers.convert_slow_tokenizer import TikTokenConverter

    with tempfile.NamedTemporaryFile(suffix=".tiktoken", delete=False) as tmp:
        download(TIKTOKEN_URL, Path(tmp.name))
        tok = TikTokenConverter(vocab_file=tmp.name).converted()

    vocab_lines = (model_dir / "vocabulary.txt").read_text(encoding="utf-8").splitlines()
    base = tok.get_vocab_size()  # 50257
    specials = vocab_lines[base:]
    tok.add_special_tokens([AddedToken(s, special=True) for s in specials])

    # 정합 검증: 스페셜 토큰 id == vocabulary.txt 줄번호
    for t in ("<|endoftext|>", "<|startoftranscript|>", "<|ko|>", "<|transcribe|>", "<|notimestamps|>"):
        assert tok.token_to_id(t) == vocab_lines.index(t), f"id 불일치: {t}"
    tok.save(str(out))
    print(f"생성: {out} (vocab={tok.get_vocab_size()})")


def patch_alignment_heads(model_dir: Path, size: str) -> None:
    """openai/whisper 의 alignment heads 를 config.json 에 추가 (단어 타임스탬프용)."""
    import numpy as np

    cfg_path = model_dir / "config.json"
    cfg = json.loads(cfg_path.read_text())
    if "alignment_heads" in cfg:
        print("alignment_heads 이미 있음")
        return
    src = requests.get(WHISPER_INIT_URL, timeout=60).text
    m = re.search(rf'"{size}"\s*:\s*b"([^"]+)"', src)
    assert m, f"alignment heads 를 찾지 못함: {size}"
    arr = np.frombuffer(gzip.decompress(base64.b85decode(m.group(1).encode())), dtype=bool)
    layers, heads = MODEL_SHAPE[size]
    mask = arr.reshape(layers, heads)
    cfg["alignment_heads"] = [[int(l), int(h)] for l, h in zip(*np.nonzero(mask))]
    cfg_path.write_text(json.dumps(cfg, indent=2))
    print(f"config.json 에 alignment_heads 추가: {cfg['alignment_heads']}")


def main() -> int:
    name = sys.argv[1] if len(sys.argv) > 1 else "small-int8"
    size = name.split("-")[0].split(".")[0]  # small-int8 -> small
    if size not in MODEL_SHAPE:
        print(f"지원 모델: {list(MODEL_SHAPE)} (+ '-int8' 변형)")
        return 1
    model_dir = fetch_model(name)
    build_tokenizer(model_dir)
    patch_alignment_heads(model_dir, size)
    print(f"\n완료. config.yaml 의 transcribe.model 을 '{size}' 로 두면 자동으로 이 로컬 모델을 쓴다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
