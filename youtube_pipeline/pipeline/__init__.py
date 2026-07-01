"""youtube_pipeline — 유튜브 편집 자동화 4단계 파이프라인.

① transcribe  Whisper 전사 → transcript.json
② broll       B-roll 후보 검색/검토 → broll.json      (후속 스펙)
③ subtitle    자막 스타일링 → subtitle.json           (후속 스펙)
④ render      ffmpeg 최종 합성 → output.mp4

각 단계는 독립 실행 가능하며 중간 결과를 프로젝트 폴더에 JSON 으로 남긴다.
"""

__all__ = ["common", "transcribe", "broll", "subtitle", "render"]
