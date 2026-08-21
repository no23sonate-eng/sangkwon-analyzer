# 레퍼런스 이미지 — 넣는 자리

여기에 폴더를 하나 만들고 이미지를 넣은 뒤 `learn_refs.py` 를 돌린다.

    refs/
      desktop/          ← 예: 데스크톱에서 올린 것
        *.jpg *.png

    python3 scripts/learn_refs.py refs/desktop --out refs/desktop_out --name "데스크톱 레퍼런스"

내는 것
  refs/<이름>_out/summary.md    잰 값 (팔레트·판 성격·엣지밀도·여백·글자 띠)
  refs/<이름>_out/sheet_*.jpg   컨택트 시트 — 팔레트 띠가 같이 찍힌다
  refs/<이름>_out/analysis.json 장별 원본 수치

그 다음은 사람이(=내가) 시트를 보고 `design_reference.md` §40 에 규칙을 쓴다.
**스크립트는 재기만 하고 해석하지 않는다.**

## 이미지는 저장소에 올리지 않는다
`.gitignore` 로 막아 둔다. 레퍼런스는 대개 남의 저작물이고, 저장소에 올리면
출처 관리가 안 된다. 대신 `summary.md` 와 `analysis.json` (= 잰 값)만 커밋한다.
