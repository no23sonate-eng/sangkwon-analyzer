# 유튜브 그래픽 파이프라인

부동산·건축 지식 교양 영상(B1M 결)의 **컷 설계 · 그래픽 렌더 · 프리미어 납품**
파이프라인. 대본을 넣으면 컷별 mp4와 프리미어 타임라인 XML이 나온다.

에이전트(코덱스·클로드 등)로 작업시킬 거면 **`AGENTS.md` 를 먼저 읽힌다.**
채널 규칙과 겪은 사고가 거기 있다. 그거 없이 시키면 같은 데 다시 빠진다.

---

## 설치

```bash
pip install -r requirements.txt
cd motion && npm install && cd ..
brew install ffmpeg        # 맥
```

Remotion 4.0.500 기준. Node 18 이상.

## 돌려 보기

```bash
# 설계가 멀쩡한지 (소재 없어도 된다)
python3 scripts/apply_design.py 니시아자부 --check

# 컷 하나만 렌더 — 소재가 있어야 한다. 아래 '소재' 참고
python3 scripts/render_parkside.py --project 니시아자부 84
```

## 무엇이 들어 있나

```
AGENTS.md          ← 에이전트가 먼저 읽을 규칙. 채널 규칙 + 겪은 사고
scripts/           Python 55개 — 설계·소재·렌더·검사(7종)·납품
motion/src/        Remotion 카드 88종 + paper.jsx (디자인 시스템 · 도면 조각 · Lucide 아이콘)
projects/니시아자부/ design.json(설계 원본) · script.md(대본) · 출처.md(금지 사항)
docs/              카드 고르기 · 설명을 그림으로 · 규칙과 함정
bin/자료받기.sh     소재 사진 복구
bin/레퍼런스뜯기.sh 유튜브 레퍼런스 → 프레임 시트 + 자막 (맥에서)
```

**`design.json` 이 대본→화면의 단일 원본이다.** 컷 번호 → `[카드, 이유, props]`.
`scene_plan.json` · `scene_props.json` 은 여기서 나오는 파생물이라
지워도 `apply_design.py` 한 번이면 복구된다.

## 소재 — 일부러 빼 뒀다

`motion/public/니시아자부/` 의 사진 188MB 는 들어 있지 않다. 공식 사이트·
Wikimedia·Pexels 에서 온 것이 섞여 있어 **저작권 출처가 제각각이고, 통째로
재배포할 물건이 아니다.**

```bash
bash bin/자료받기.sh 니시아자부
```

공식 사이트 사진을 원본 크기로 다시 받는다. Wikimedia·Pexels 쪽은
`scripts/fetch_sources.py` 로 따로 받아 사람이 골라야 한다 —
**자동 채택은 하지 않는다**(AGENTS.md 6장).

소재가 없어도 **코드 수정·구조 작업·검사 스크립트 작업은 전부 된다.**
렌더만 안 된다.

## 렌더 결과도 없다

`clips/`(500MB) `stills/`(458MB) 는 전부 파생물이다.

```bash
python3 scripts/apply_design.py 니시아자부
python3 scripts/render_parkside.py --project 니시아자부 --fresh -j 4
```

`--fresh` 는 카드 소스(`.jsx`)와 소재 파일보다 **뒤에 만들어진 결과물만**
건너뛴다. 전부 없으면 다 뽑고, 몇 컷만 고쳤으면 그 몇 컷만 뽑는다.

## 현재 프로젝트

**파크웰스테이트 니시아자부** — 269컷 / 20분 44초 / 카드 21종.
`projects/니시아자부/출처.md` 의 🔴 항목은 **화면에 띄우면 안 되는 것**과
**반드시 병기해야 하는 자막**이다. design.json 보다 우선한다.

## 버전 관리

이 폴더는 git 저장소가 아니다. 쓰려면:

```bash
git init && git add -A && git commit -m "파이프라인 떼어냄"
```

`.gitignore` 는 들어 있다 — 소재·렌더 결과·node_modules 를 빼도록 돼 있다.
