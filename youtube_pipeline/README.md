# youtube_pipeline — 유튜브 편집 자동화

영상 하나당 `projects/<영상명>/` 폴더 하나. 4단계, 각 단계 독립 실행 가능,
중간 결과는 JSON 으로 저장돼 다음 단계가 이어받는다.

```
① transcribe.py  Whisper 전사 + 띄어쓰기 교정 → transcript.json
② broll.py       B-roll 검색/검토(HTML)       → broll.json, selections.json, feedback_log.json
③ subtitle.py    AI 자막 스타일링/검토(HTML)   → subtitle_plan.json, subtitle.ass
④ render.py      B-roll 오버레이+자막 굽기     → output.mp4
```

## 설치

```bash
# 시스템 의존성
#   Ubuntu/Debian:  apt-get install ffmpeg
#   macOS:          brew install ffmpeg
pip install -r youtube_pipeline/requirements.txt
cp youtube_pipeline/.env.example youtube_pipeline/.env   # 키 채우기
```

Python 3.10+ 필요.

### huggingface.co 가 막힌 환경 (오프라인 모델 설치)

faster-whisper 는 기본적으로 huggingface.co 에서 모델을 받는다. 그게 막힌
환경(원격 실행 환경 egress 정책 등)에서는:

```bash
pip install transformers tiktoken numpy   # 설치 스크립트용
python youtube_pipeline/scripts/setup_model.py small-int8
```

GitHub 릴리스에서 모델을 받아 `models/small-int8/` 에 설치하고 tokenizer /
alignment heads 까지 자동 구성한다. `transcribe.py` 는 `models/` 에 로컬
모델이 있으면 그것을 우선 사용한다.

## 실행

```bash
# 1) 원본 영상을 프로젝트 폴더에 넣는다
mkdir -p youtube_pipeline/projects/내영상
cp ~/내영상.mp4 youtube_pipeline/projects/내영상/

# 2) 단계별 실행 (각각 독립)
python youtube_pipeline/pipeline/transcribe.py 내영상
python youtube_pipeline/pipeline/broll.py      내영상   # → http://localhost:8787/review.html 에서 후보 선택
python youtube_pipeline/pipeline/subtitle.py   내영상   # → http://localhost:8788/subtitle_review.html 에서 확정
python youtube_pipeline/pipeline/render.py     내영상   # → projects/내영상/output.mp4
```

- 검토 페이지에서 저장해야 다음 단계가 그 선택을 사용한다
  (B-roll: selections.json / 자막: subtitle.ass 재생성).
- AI 제안과 다른 선택·수정은 feedback_log.json 에 자동 누적된다.
- `--mock` 플래그: API 키/네트워크 없이 전체 흐름 데모.

`transcribe.py 내영상` 처럼 영상명만 줘도 되고, 폴더 경로를 직접 줘도 된다.

## 설정

- `config.yaml` — 렌더 포맷(기본 landscape 1920x1080, shorts 세로 구조만 예약),
  전사 모델, Anthropic 모델 등.
- `style_guide.md` — **AI 판단(B-roll·자막)의 유일한 기준**. 판단 로직을 코드에
  넣지 않고 이 문서를 프롬프트에 주입한다. 톤이 바뀌면 이 문서만 고친다.
- `.env` — `ANTHROPIC_API_KEY`, `PEXELS_API_KEY`, `PIXABAY_API_KEY`.

## transcript.json 스키마

```jsonc
{
  "project": "내영상",
  "source": "내영상.mp4",
  "language": "ko",
  "duration": 12.3,
  "model": "small",
  "sentences": [ {"id": 0, "start": 0.0, "end": 3.2, "text": "..."} ],
  "segments": [ /* whisper 원본 세그먼트 (단어 타임스탬프 포함) */ ]
}
```

`sentences` 가 이후 단계의 기본 입력이다.
