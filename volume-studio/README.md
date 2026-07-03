# Volume Studio

주소 검색만으로 법규 검토(건폐율·용적률·정북일조·주차) 기반 **3D 매스 + 규모검토표**를 산출하는
초기 볼륨 스터디 도구. (밸류맵 Buildit류 — 설계 도서가 아니라 "얼마나 나오는지" 확인용)

## 실행
```bash
cd volume-studio
npm install
# VWorld 키 (주소 자동조회용, https://www.vworld.kr 발급 · 해외 IP 차단 → 국내에서만 동작)
echo "VWORLD_API_KEY=발급키" > .env.local
npm run dev   # → http://localhost:3200
```

- 주소 조회 실패/키 없음 → 면적·용도지역·폭/깊이 직접 입력해도 전부 동작
- 산출 엔진은 `lib/zoning/` (상권분석기 web/lib/zoning 에서 분리·독립)
- 3D: three.js — 필지 폴리곤 실형상 압출, 층별 용도 색, 일조 계단 후퇴 반영

## 산출 기준
서울시 도시계획·주차장 조례 적용값(법령 원문 대조). 지구단위계획·가로구역 최고높이 등
개별 규제 미반영 — 초기 검토용 개략치.
