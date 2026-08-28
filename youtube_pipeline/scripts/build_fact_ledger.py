#!/usr/bin/env python3
"""팩트 대장 — 컷마다 '화면에 뜬 주장 / 근거 / 확인 상태' 를 한 장에.

검수 페이지(`검수.html`)는 **보이는 것**을 본다. 이건 **믿을 수 있는지**를
본다. 둘은 다른 일이다. 컷 그림을 아무리 들여다봐도 '337평' 이 어디서
나온 숫자인지는 안 보이고, 그게 원문에 있는 값인지 내가 계산한 값인지
가정으로 그린 도해인지는 더더욱 안 보인다.

상태는 네 가지다.
  원문   공시·기사·기관 문서에 그 값이 그대로 있다
  계산   원문 값에서 산수로 나온 값. 식을 같이 적는다
  도해   실제 통계가 아니라 성격을 보이려고 그린 그림. 화면에도 그렇게 적혀 있다
  연출   사실 주장이 없는 컷 (전환·제목·분위기)

`python3 scripts/build_fact_ledger.py 더그랜드롯데`
"""
import argparse, html, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent

# 컷별 메모: (상태, 근거 한 줄). 없는 컷은 규칙으로 채운다
NOTE = {
 0:('원문','1979.3.10 개관 → 2026.8.14 개명 = 47년'),
 1:('원문','1,015 − 868 = 147실 · 비즈워치 2026.8.14'),
 2:('원문','메인타워 7~21층 약 15개월 리뉴얼 · 비즈워치 2026.8.14'),
 3:('원문','737 → 590 · 비즈워치 2026.8.14'),
 4:('계산','147 ÷ 737 = 19.95%'),
 5:('원문','1,015 → 868 (−147) · 비즈워치 2026.8.14'),
 7:('원문','더그랜드롯데 서울 공식 워드마크'),
 8:('원문','시그니엘 2017 → 2026 = 9년'),
 15:('계산','3,686억 ÷ 576실 = 6.40억'),
 16:('원문','한국경제 2026.8.6'),
 17:('원문','보코 서울 명동 · 576실 · 3,686억'),
 18:('계산','3,686억 ÷ 576 = 6.4억 · 부대시설·부지 포함가'),
 22:('원문','DART 공시: 765,651 ÷ 2,656,034 = 28.83% · 413,516 ÷ 2,656,034 = 15.57%'),
 23:('원문','DART 공시 765,651백만원'),
 24:('원문','DART 공시 413,516 + 352,135 = 765,651백만원'),
 25:('계산','4,135 ÷ 7,657 = 54.0%'),
 26:('원문','DART 매출유형별: 객실 413,516 · 식음료 175,533 · 기타(임대 포함) 176,602'),
 27:('계산','54% / 46%'),
 28:('계산','20% × 54% ≒ 11% — 산술 예시. 화면에 기준을 적었다'),
 31:('도해','공시 객실 54%를 기준으로 그린 개략도 · 호텔마다 편차'),
 34:('계산','1938 → 2026 = 88년'),
 36:('원문','노구치 시타가우 · 일본질소비료 · 1936 착공 1938 개관'),
 38:('원문','지하1·지상8층 111실 · 사무실+임대상가+호텔 복합'),
 39:('원문','5층까지 사무실 · 6~8층 호텔 · 경향신문 2024.1.11'),
 40:('원문','조선호텔 4층 vs 반도호텔 8층 · 동양 4번째 규모'),
 42:('원문','조선호텔 1914 개관 · 지상4층 지하1층'),
 45:('원문','조선호텔 옆 2,000평 · 경향신문 2024.1.11'),
 46:('원문','4층 vs 8층'),
 48:('원문','1938 개관 · 1945 미군정 · 1948 국영 · e뮤지엄'),
 50:('원문','1955 금수장(첫 민영호텔) · 1965.8 앰배서더 개명 · 1970년대 반도호텔 경쟁력 상실'),
 51:('원문','시설 노후화·대규모 적자 · e뮤지엄'),
 53:('원문','1970년 박정희가 신격호를 청와대로 부름 · e뮤지엄'),
 55:('원문','e뮤지엄 본문 인용'),
 59:('원문','자문 보고서 권고 300실·위탁운영 · e뮤지엄'),
 60:('원문','300실 · e뮤지엄'),
 61:('원문','위탁운영 권고 / 직영 선택 · e뮤지엄'),
 62:('원문','300실·위탁 → 1,000실·독자 브랜드 · e뮤지엄'),
 64:('원문','300 → 1,000실 · e뮤지엄'),
 65:('원문','삼일빌딩 31층 110m · 롯데호텔 지상 38층 · e뮤지엄'),
 66:('원문','호텔·백화점·오피스 소공동 복합개발 · e뮤지엄'),
 67:('원문','1979.3.10 개관 · 위키백과·나무위키 (e뮤지엄은 10월로 다름)'),
 68:('원문','지하3·지상38층 138m · 개관 당시 1,020실 · e뮤지엄'),
 69:('원문','당시 동양 최대 특급호텔 · e뮤지엄'),
 70:('원문','1억 5,000만 달러 · e뮤지엄'),
 71:('원문','경부고속도로 1억 9,000만 달러 · e뮤지엄 (같은 문장)'),
 72:('원문','1979.12 롯데백화점 본점 개점 · e뮤지엄'),
 73:('계산','1938 → 2026 = 88년'),
 74:('계산','147 ÷ 737 = 19.95%'),
 77:('원문','롯데호텔 공식 예약 페이지 직접 조회 · 주말 1박 성인 2명 세금·봉사료 포함'),
 80:('계산','41.4 ÷ 27.75 = +49.2% (면적 중간값)'),
 81:('계산','698,775 ÷ 635,250 = +10.0%'),
 83:('계산','635,250 ÷ 27.75 = 22,892원/㎡'),
 84:('계산','698,775 ÷ 41.4 = 16,879원/㎡'),
 85:('계산','㎡당 22,892 vs 16,879 — 칸 하나 ≒ 1.3만원'),
 88:('원문','DART: 롯데호텔 39 · 롯데시티 19.5 · L7 19.5 · 리조트 10 · 시그니엘 5 · 스카이힐CC 5 · 브리브 2 = 100%'),
 91:('원문','약 50만원 · 공시 요금 대표값'),
 92:('원문','롯데호텔 서울 약 50만 / 시그니엘 약 120만 · 대표값'),
 93:('원문','더그랜드롯데 약 70만원 (그랜드 디럭스 698,775원)'),
 96:('원문','줄어든 객실 자리에 외부 전문 피부과 등 의료시설 · 비즈워치 2026.8.14 · 면적 배분은 비공개'),
 98:('원문','BC카드 상반기 외국인 의료 이용금액 +98% · 2026.8.3'),
 99:('원문','의료 소비의 92.8%가 서울 · BC카드 2026.8.3'),
 101:('원문','롯데시티호텔 마포 메디컬 클리닉 · 비즈워치 2026.8.14'),
 102:('원문','마포 운영 중 · 부산 운영 이력 · 비즈워치 2026.8.14'),
 105:('원문','뉴스퀘스트 2026.6.26 · 1,121억 낙찰'),
 106:('원문','5차례 유찰 후 6회차 낙찰 · 뉴스퀘스트 2026.6.26'),
 107:('원문','"신축 대신 대수선 리모델링, 외국인 대상 뷰티·성형 복합시설" · 뉴스퀘스트'),
 109:('도해','실제 월별 통계가 아니다 — 두 수입의 성격 차이를 그린 도해. 화면에 3번 명시'),
 112:('원문','개관 8.14 · 쇼케이스 8.10 = 나흘 전'),
 113:('원문','크리스탈 글로우 공개 · 롯데호텔 2026.8.11'),
 114:('원문','크리스탈볼룸 337평 · 호텔 최대 연회장'),
 115:('원문','900~1,000명 수용'),
 116:('원문','무대 전면 초대형 파노라마 LED'),
 117:('원문','DART 공시 금액을 비율로 환산 (54 / 23 / 23)'),
 119:('원문','매일 17시~자정 · 신세계백화점 본점'),
 120:('원문','한 시즌 100만 명 · 신세계그룹 뉴스룸'),
 122:('원문','롯데타운 라이트 · 롯데백화점 2026.7.30'),
 123:('원문','가로 77m × 높이 21m = 1,614㎡ (농구 코트 4개) · 헤럴드경제 2026.7.30'),
 124:('원문','명동 상권 최대 규모 · 헤럴드경제 2026.7.30'),
 125:('원문','11월 티저 · 12월 정식 오픈 · 4K · 최대 1km'),
 126:('원문','본점 지하 1층 코스모너지 광장 리뉴얼'),
 127:('계산','1988 신관 개점 → 2026 = 38년 · 기사 제목도 "38년 만"'),
 128:('원문','하루 평균 2만 명 · 을지로입구역 연결 동선 · 약 250평(840㎡)'),
 129:('원문','헤럴드경제·한국경제 2026.7.30'),
 133:('원문','경향신문 2026.8.19'),
 134:('원문','디럭스 위주 → 최고급 스위트 · 경향신문 2026.8.19'),
 135:('원문','클럽라운지 격 상향·공간 확장 · 경향신문 2026.8.19'),
 136:('원문','1976.10.1 개관 · 2010.11 리노베이션'),
 137:('계산','2010 → 2026 = 16년'),
 138:('원문','2026.9.30 영업중단 · 2027년 초 착공 · 2029 재개관'),
 142:('원문','만다린 오리엔탈 서울 2030 · 128실 · ㈜한화 건설부문 2025.9.4'),
 144:('원문','부지 약 3만㎡ · 연면적 34만㎡'),
 145:('원문','지하6~지상39층 5개 동 · 2024.12 착공'),
 146:('원문','2030 개관 목표'),
 147:('원문','128실 · 인테리어 안드레 푸'),
 148:('원문','전 세계 44개 호텔 · 12개 레지던스'),
 149:('원문','한국 첫 진출'),
 150:('계산','128 ÷ 868 = 14.7% → 5분의 1 미만'),
 151:('원문','스파·웰니스 4개 층 · 골프 아카데미 · ㈜한화 건설부문'),
 152:('원문','다이닝 · 클럽 라운지 · ㈜한화 건설부문'),
 154:('원문','2022년 말 영업 종료'),
 155:('원문','1983 개관 · 2025.5 철거 착수'),
 156:('원문','김종성 설계 · 보존 논란 · VMSPACE'),
 157:('원문','1조 651억 (2021.12, 밀레니엄 힐튼 단독) · 서울로·메트로타워는 2024.3 별건'),
 159:('원문','리츠칼튼 운영사 선정 · 2031 개장'),
 160:('원문','2031년 개장 목표'),
 161:('계산','2016 철수 → 2031 개장 = 15년'),
 162:('원문','포스터앤파트너스 · SOM · 스트레이트뉴스 2025.4.21'),
 163:('원문','애플 파크 / 롯데월드타워'),
 167:('원문','만다린 서울역 2030 · 리츠칼튼 이오타 2031 · 로즈우드 용산 2027 · 아만 청담(프리마호텔 부지)'),
 169:('원문','2026 상반기 서울 호텔 거래액 약 1조 1,000억 · +71% · 한국경제 2026.8.6'),
 170:('원문','+71% · 2025 방한 외국인 1,894만 명 (한국관광공사 2026.1.30)'),
 171:('원문','2025년 거래 서울 호텔 자산 100% 호텔 용도 유지 · 쿠시먼앤웨이크필드'),
 174:('도해','개장 시점은 각 사 발표 기준 · 겹칠지 여부는 시나리오. 화면에 명시'),
 6:('연출','업계 통념 — 수치 주장 아님'),
 11:('원문','ADR·OCC 정의'),
 12:('원문','ADR = 평균 객실 단가'),
 13:('원문','OCC = 객실 가동률'),
 14:('원문','더그랜드롯데 서울 개관 명패 · 뉴시스'),
 19:('연출','전환 — 수치 주장 없음'),
 21:('연출','롯데호텔 서울 위치 · 서울 도심 자료사진'),
 29:('연출','연회장 참고 이미지 — 크리스탈볼룸 실물 아님'),
 30:('연출','특급호텔 복도 · 분위기'),
 33:('원문','소공동 · 더그랜드롯데 서울 좌표 · OpenStreetMap'),
 37:('원문','호텔 + 임대상가 + 사무실 복합 · 경향신문 2024.1.11'),
 41:('연출','서술 장치 — 수치 주장 없음'),
 43:('원문','1930년대 조선호텔 · 노구치 축출 일화'),
 44:('연출','작업복 차림 · 대체 이미지'),
 47:('원문','조선호텔 엽서 자료 · 5층 사무실 일화'),
 49:('연출','1960년대 서울 거리 자료사진'),
 52:('원문','정부의 민영화 추진 · e뮤지엄'),
 54:('원문','재일교포 사업가 신격호 · e뮤지엄'),
 56:('원문','경험 없어 망설였으나 인수 결심 · e뮤지엄'),
 57:('원문','1960년대 반도호텔 · 뉴스1'),
 58:('원문','여러 싱크탱크에 자문 용역 · e뮤지엄'),
 63:('연출','참고 로고 — 시기에 따라 실제와 다를 수 있다고 화면에 명시'),
 69:('원문','당시 동양 최대 특급호텔 · e뮤지엄'),
 78:('원문','더그랜드롯데 객실 · 롯데호텔'),
 79:('연출','전환 — 수치 주장 없음'),
 82:('계산','㎡당 22,892 > 16,879 → 작은 방이 더 비싸다'),
 86:('계산','넓힐수록 ㎡당 단가는 내려간다'),
 87:('연출','장 제목'),
 89:('원문','롯데호텔 서울 로비'),
 90:('원문','롯데호텔 브랜드 · 롯데호텔'),
 94:('원문','롯데호텔 서울 → 더그랜드롯데 서울 개명'),
 97:('연출','의료시설 — 실물 대신 대체 영상'),
 100:('원문','더그랜드롯데 개관 · 롯데호텔'),
 103:('연출','호텔+의료 결합 — 대체 이미지'),
 104:('원문','명동 관광객 · 이데일리'),
 108:('연출','전환'),
 110:('원문','객실=하루 단위 / 임대=계약 단위'),
 111:('연출','임대의 성격 — 수치 주장 없음'),
 118:('원문','신세계백화점 본점 미디어파사드'),
 121:('연출','대체 영상'),
 130:('연출','명동 롯데타운 · 대체 영상'),
 132:('연출','장 제목 · 수치 주장 없음'),
 139:('연출','전환 — 8.14 롯데 / 8.19 한화'),
 140:('원문','더 플라자 외관'),
 143:('원문','서울역 북부역세권 조감 · ㈜한화 건설부문'),
 153:('연출','럭셔리 호텔 분위기 · 대체 영상'),
 158:('원문','이오타 서울 · 밀레니엄 힐튼+서울로타워+메트로타워'),
 164:('원문','서울역—이오타—남산 보행 축 · 이오타 서울'),
 165:('원문','이오타 서울 조감'),
 166:('원문','서울역 · 명동 · 소공동'),
 168:('연출','전환'),
 172:('연출','전환'),
 173:('연출','장 제목'),
 175:('도해','통상 개발 기간 5년 — 업계 관행에 따른 전망'),
 176:('원문','2020~2022 호텔→오피스 컨버전 흐름'),
 177:('연출','방향 전환 가능성 — 전망'),
 178:('원문','인천공항 입국장 · 뉴스1'),
 179:('연출','소비자 / 기획·개발 두 관점'),
 180:('연출','대체 영상'),
 181:('연출','마무리 · 서울 도심 자료사진'),
}

# 화면에 실사 대신 대체 이미지를 쓴 컷 — 실물을 못 구한 자리
SUB = {97,103,113,114,115,116,119,121,125,128,134,135,136,138,150,151,152,153,155,
       175,176,177,180}

def strings(o, out, skip):
    if isinstance(o, str):
        if o and not re.search(r'\.(jpg|png|jpeg|mp4|webm|svg)$', o) \
           and not o.startswith('M0 ') and not o.startswith('더그랜드롯데/'):
            out.append(o)
    elif isinstance(o, bool):
        pass
    elif isinstance(o, (int, float)):
        out.append(str(o))
    elif isinstance(o, list):
        for x in o: strings(x, out, skip)
    elif isinstance(o, dict):
        for k, v in o.items():
            if k in skip: continue
            strings(v, out, skip)

SKIP = {'source','theme','media','image','photo','logo','bgImage','backdrop','_motion',
        'bg','path','scrim','veil','zoom','pan','gate','era','size','align','mode','unit',
        'fit','kenBurns','ratio','pad','ground','tone','logoScale','tracking','cols',
        'perDot','merge','over','plain','scale','arrow','ghost','arrowOnly','single',
        'axisStep','showHuman','axis','tight','hot','divider','serif','leadIn','bounds',
        'lat','lon','x','y','hold','side','span','w','h','dim','value','pct','area',
        'price','months','values','at','from','to','step','baseline','hm','value2',
        'total','count','floors','above','below','indexNote','center','ts'}


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('project'); a = ap.parse_args()
    pdir = ROOT / 'projects' / a.project
    cuts = json.load(open(pdir / 'design.json', encoding='utf-8'))['cuts']
    plan = {c['id']: c for c in json.load(open(pdir / 'scene_plan.json', encoding='utf-8'))['scenes']}
    acts = {1: '후크 · 객실 수의 의미', 2: '이 자리의 역사', 3: '리뉴얼을 뜯어봅니다',
            4: '서울 도심 격전지', 5: '결론'}

    rows, last_act = [], None
    tally = {}
    for i in sorted(map(int, cuts)):
        card, why, props = (cuts[str(i)] + [{}, {}])[:3]
        e = plan.get(i, {})
        txt = ' '.join(str(e.get('text', '')).split())
        out = []; strings(props, out, SKIP)
        seen, screen = set(), []
        for s in out:
            if s not in seen and len(s) < 90:
                seen.add(s); screen.append(s)
        src = props.get('source', '') if isinstance(props, dict) else ''
        st, ev = NOTE.get(i, ('연출', '장 제목 · 전환 — 사실 주장 없음'))
        if not ev and src and st == '연출':
            ev = ''
        tally[st] = tally.get(st, 0) + 1
        act = e.get('act', 1)
        if act != last_act:
            rows.append(f'<tr class="sec"><td colspan="6">{act}장 · {html.escape(acts.get(act, ""))}</td></tr>')
            last_act = act
        sub = ' <span class="sub">대체 이미지</span>' if i in SUB else ''
        rows.append(
            '<tr>'
            f'<td class="mono id">#{i}</td>'
            f'<td class="say">{html.escape(txt)}</td>'
            f'<td class="scr">{html.escape(" · ".join(screen[:9]))}</td>'
            f'<td class="src">{html.escape(src) or "<span class=dim>—</span>"}{sub}</td>'
            f'<td><span class="st s{st}">{st}</span></td>'
            f'<td class="ev">{html.escape(ev)}</td>'
            '</tr>')

    order = ['원문', '계산', '도해', '연출']
    chips = ' '.join(f'<span class="st s{k}">{k} {tally.get(k,0)}</span>' for k in order)
    out = TPL.replace('{{ROWS}}', '\n'.join(rows)).replace('{{CHIPS}}', chips)
    p = pdir / '팩트대장.html'
    p.write_text(out, encoding='utf-8')
    print(f'{len(cuts)}컷 → {p}  ({p.stat().st_size/1024:.0f}KB)')


# 이번 검수(1~3차)에서 실제로 고친 것. (분류, 컷, 무엇이 문제였나, 어떻게 고쳤나)
FIX = [
 ('없는 값을 만들어 냈다', '#26 · #117',
  "공시에 '임대' 항목이 없는데 '임대 약 1,400억' · '임대 약 18%' 칸을 그려 놓고 캡션엔 '역산한 추정치' 라고만 적었다. 역산이 아니라 없는 항목을 만든 것이다.",
  'DART 매출유형별 실적 줄 그대로로 교체. 임대는 기타수입에 포함된다고 화면에 적었다.'),
 ('없는 값을 만들어 냈다', '#98',
  "'전체 카드 이용액 +12%' 라는 비교군을 내가 지어냈다.",
  '검증되는 +98% 하나만 남기고 전년 동기=100 지수로 세웠다.'),
 ('없는 값을 만들어 냈다', '#96',
  '의료시설 55 / 객실 확대 25 / 공용부 20 — 면적 배분을 내가 나눴다. 캡션에 비공개라고 적어 두고 면적 그림을 그리면 그림 자체가 비율을 주장한다.',
  '화살표 하나로 바꿨다. 확인되는 건 "줄어든 자리에 의료시설이 들어온다" 뿐이다.'),
 ('없는 값을 만들어 냈다', '#103',
  '일반 관광 3박 / 의료 관광 7박 — 근거 없는 가정이었다.',
  '컷을 통째로 뺐다.'),
 ('없는 값을 만들어 냈다', '#50',
  "연표 세 점이 전부 지어낸 해였다 — '1961 민간 호텔 등장' 은 근거가 없다.",
  '1955 금수장(첫 민영호텔) · 1965.8 앰배서더 개명 · 1970년대 반도호텔 경쟁력 상실로 교체.'),
 ('숫자가 안 맞았다', '#88',
  '브랜드 비중 합이 95% 였고 캡션이 그걸 그대로 인정하고 있었다.',
  '빠져 있던 롯데스카이힐CC 5% 를 넣어 일곱 브랜드 100% 로 맞췄다.'),
 ('숫자가 안 맞았다', '#83 · #85',
  '㎡당 단가는 중간값 27.75 로 계산한 값인데 화면엔 27.8 로 적혀 나눠 보면 안 맞았다.',
  '27.75 로 통일.'),
 ('숫자가 안 맞았다', '#150',
  "128 ÷ 868 = 14.7% 인데 화면엔 '1/5' 만 떠서 '1/5 이다' 로 읽혔다.",
  "'1/5 미만' 으로."),
 ('숫자가 안 맞았다', '#157',
  '1조 651억은 밀레니엄 힐튼 한 건 값(2021.12)인데 캡션이 서울로타워·메트로타워까지 묶어 금액이 세 배 크게 읽혔다.',
  '두 타워는 2024.3 별건이라고 캡션에 적었다.'),
 ('기준이 안 보였다', '#28',
  "'전체 매출 영향 −11%' 가 어느 전체인지 화면만 봐선 몰랐다. 호텔롯데 전체로 읽으면 −3%, 호텔 전체 객실로 보면 −14.5% 다.",
  '무엇에 무엇을 곱한 산술 예시인지 화면에 적었다.'),
 ('기준이 안 보였다', '#31',
  "출처가 '업계 통상 범위' — 출처가 아니라 고백이다.",
  '공시(객실 54%)를 기준으로 그린 개략도라고 명시.'),
 ('출처가 틀렸다', '#98 · #99',
  'BC카드 수치인데 비즈워치 8.14(롯데호텔 리뉴얼 기사)가 출처로 달려 있었다.',
  'BC카드 2026.8.3 발표로 교체.'),
 ('출처가 틀렸다', '#70 · #71',
  '건설비 두 금액의 근거가 사진 크레딧으로 대체돼 있었다.',
  '한국경제인협회 e뮤지엄 — 두 금액이 한 문장 안에 있다.'),
 ('출처가 틀렸다', '#139',
  "남산에서 내려다본 서울 도심 사진에 '이오타 서울' 크레딧이 붙어 있었다.",
  '서울 도심 자료사진으로.'),
 ('출처가 틀렸다', '19컷',
  "#45 · #48 · #53 · #58 · #113~#116 · #119 · #124 · #128 · #133~#138 · #150 · #155 · #161 — 화면엔 '337평', '하루 2만 명' 같은 숫자가 떠 있는데 Source 에는 Pexels 가 적혀 있었다.",
  '픽셀스는 표기 의무가 없다. 그 자리를 근거에 내줬다.'),
 ('화면이 다른 것을 보여 줬다', '#127',
  '코스모너지 광장(롯데백화점 본점 지하 1층) 이야기에 화면은 영플라자 야경이었다.',
  '숫자 카드로 교체 — 본점 지하 사진은 #126 이 이미 쓴다.'),
 ('화면이 다른 것을 보여 줬다', '#79',
  "로고와 'THE GRAND FESTA' 같은 홍보 문구가 박힌 합성 이미지. 지운 줄 알았는데 스냅샷 되돌림으로 되살아나 있었다.",
  '파일째 삭제.'),
 ('화면이 다른 것을 보여 줬다', '#28',
  '깔려 있던 사진에 뉴스1 워터마크가 찍혀 있는데 크레딧은 롯데호텔이었다.',
  '워터마크 박힌 사진은 출처를 밝혀도 안 쓴다 — 파일째 뺐다. 산술 예시에 실사가 필요하지도 않다.'),
 ('화면이 다른 것을 보여 줬다', '#142~#150',
  '서울역 북부역세권 이야기에 이오타 서울 조감도가 붙어 있었다.',
  '한화 건설부문 뉴스룸 · 한국일보 · 파이낸셜뉴스 자료로 교체.'),
 ('보이지 않았다', '#162',
  "'이오타 서울' 이 부제와 부모 상자에 두 번 찍히고, 설계사 칸은 '로고 자리' 로 비어 있었다.",
  '포스터앤파트너스 · SOM 워드마크를 각 사 사이트에서 받아 채웠다.'),
 ('보이지 않았다', '#167',
  '네 브랜드 중 둘만 로고가 있었다.',
  '로즈우드 · 아만 워드마크를 공식 사이트에서 받아 넷 다 채웠다.'),
 ('보이지 않았다', 'CostStack 전반',
  "표시값이 단위를 두 번 찍었다 — '4,135억' + '억원' = '4,135억억원'.",
  '숫자만 넣고 단위는 카드가 붙인다. 숫자가 아닌 표시는 단위를 뗀다.'),
 ('되살릴 수 없었다', '#2 · #58 · #97',
  'mp4 는 저장소에 안 들어가는데 세 클립이 VIDEOS.tsv 에 줄이 없어, 스냅샷이 되돌아간 순간 영영 사라졌다.',
  '다시 받아 줄을 넣고, fetch_pexels 가 받은 자리에서 바로 TSV 에 적도록 고쳤다.'),
]

# 원문으로 확인만 하고 고칠 게 없던 것들
OK = [
 ('롯데호텔 서울 개관', '1979년 3월 10일', '위키백과 · 나무위키 — e뮤지엄만 10월로 다르다'),
 ('객실 수', '개관 당시 1,020실 / 리뉴얼 직전 1,015실', '서로 다른 시점의 값이라 둘 다 맞다. 시점을 화면에 박았다'),
 ('외국인 의료 이용금액', '+98% · 서울 92.8%', 'BC카드 2026.8.3 — 수치는 맞고 출처만 틀렸다'),
 ('호텔롯데 상반기 매출', '2조 6,560억 · 호텔사업부 7,657억 · 객실 4,135억', 'DART 반기보고서 원문 대조'),
 ('크리스탈볼룸', '337평 · 900~1,000명 · 파노라마 LED', '롯데호텔 2026.8.11'),
 ('코스모너지 광장', '1988 신관 · 하루 2만 명 · 38년 만', '롯데백화점 — 250평(840㎡)까지 확인'),
 ('롯데타운 라이트', '77m × 21m = 1,614㎡ · 11월 티저 12월 오픈', '헤럴드경제 2026.7.30'),
 ('더 플라자', '1976.10.1 개관 · 2010.11 리노베이션 · 2026.9.30 중단 · 2029 재개관', '경향신문 2026.8.19'),
 ('만다린 오리엔탈', '44개 호텔 · 12개 레지던스 · 128실 · 2030 · 한국 첫 진출', '㈜한화 건설부문 2025.9.4'),
 ('밀레니엄 힐튼', '1983 개관 · 2022년 말 종료 · 2025.5 철거', '이코노미스트 · 김종성 설계'),
 ('2025 방한 외국인', '1,894만 명 · 역대 최대', '한국관광공사 2026.1.30'),
 ('보코 서울 명동', '3,686억 · 576실 · 객실당 6.4억', '한국경제 2026.8.6'),
 ('아정당 청담동', '5차례 유찰 · 1,121억 낙찰 · 뷰티·성형 복합시설 전환', '뉴스퀘스트 2026.6.26 원문 인용'),
 ('반도호텔', '1936 착공 1938 개관 · 지하1 지상8층 111실 · 동양 4번째', 'e뮤지엄 · 이코노미스트'),
 ('롯데호텔 건설비', '1억 5,000만 달러 (경부고속도로 1억 9,000만)', 'e뮤지엄 — 한 문장 안에 있다'),
]


def esc(s):
    return html.escape(str(s))


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('project'); a = ap.parse_args()
    pdir = ROOT / 'projects' / a.project
    cuts = json.load(open(pdir / 'design.json', encoding='utf-8'))['cuts']
    plan = {c['id']: c for c in json.load(open(pdir / 'scene_plan.json', encoding='utf-8'))['scenes']}
    acts = {1: '후크 · 객실 수의 의미', 2: '이 자리의 역사', 3: '리뉴얼을 뜯어봅니다',
            4: '서울 도심 격전지', 5: '결론'}

    rows, last_act, tally = [], None, {}
    for i in sorted(map(int, cuts)):
        card, why, props = (cuts[str(i)] + [{}, {}])[:3]
        e = plan.get(i, {})
        txt = ' '.join(str(e.get('text', '')).split())
        out = []; strings(props, out, SKIP)
        seen, screen = set(), []
        for s in out:
            if s not in seen and len(s) < 90:
                seen.add(s); screen.append(s)
        src = props.get('source', '') if isinstance(props, dict) else ''
        st, ev = NOTE.get(i, ('연출', '장 제목 · 전환 — 사실 주장 없음'))
        tally[st] = tally.get(st, 0) + 1
        act = e.get('act', 1)
        if act != last_act:
            rows.append(f'<tr class="sec"><td colspan="6"><span class="secn">{act}장</span>'
                        f'{esc(acts.get(act, ""))}</td></tr>')
            last_act = act
        sub = '<span class="tag">대체 이미지</span>' if i in SUB else ''
        srch = esc(src) if src else '<span class="none">—</span>'
        rows.append(
            f'<tr class="r st-{st}" data-st="{st}">'
            f'<th scope="row" class="id mono">#{i}</th>'
            f'<td class="say" data-l="나레이션">{esc(txt)}</td>'
            f'<td class="scr" data-l="화면">{esc(" · ".join(screen[:9]))}</td>'
            f'<td class="src" data-l="출처">{srch}{sub}</td>'
            f'<td class="stc" data-l="상태"><span class="st">{st}</span></td>'
            f'<td class="ev" data-l="근거">{esc(ev)}</td>'
            '</tr>')

    order = ['원문', '계산', '도해', '연출']
    tal = ''.join(
        f'<div class="tl st-{k}"><b class="mono">{tally.get(k,0)}</b><span>{k}</span></div>'
        for k in order)

    fx, last_k = [], None
    for kind, cut, prob, fixed in FIX:
        if kind != last_k:
            fx.append(f'<tr class="sec"><td colspan="4">{esc(kind)}</td></tr>')
            last_k = kind
        fx.append(f'<tr class="r"><th scope="row" class="id mono">{esc(cut)}</th>'
                  f'<td class="say" data-l="무엇이 문제였나">{esc(prob)}</td>'
                  f'<td class="ev" data-l="어떻게 고쳤나">{esc(fixed)}</td>'
                  f'<td class="pad"></td></tr>')

    ok = ''.join(
        f'<tr class="r"><th scope="row" class="okn">{esc(n)}</th>'
        f'<td class="okv mono" data-l="값">{esc(v)}</td>'
        f'<td class="src" data-l="확인처">{esc(s)}</td></tr>'
        for n, v, s in OK)

    p = pdir / '팩트대장.html'
    p.write_text(TPL
                 .replace('{{TALLY}}', tal)
                 .replace('{{FIX}}', '\n'.join(fx))
                 .replace('{{OK}}', ok)
                 .replace('{{ROWS}}', '\n'.join(rows))
                 .replace('{{NFIX}}', str(len(FIX)))
                 .replace('{{NOK}}', str(len(OK))),
                 encoding='utf-8')
    print(f'{len(cuts)}컷 → {p}  ({p.stat().st_size/1024:.0f}KB)')


TPL = """<title>더그랜드롯데 팩트 대장</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hahmlet:wght@500;600&family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans+KR:wght@400;500;600&display=swap">
<style>
/* ── 팔레트 ───────────────────────────────────────────────────────────────
   작품은 크림·먹·노랑이다. 이 문서는 작품이 아니라 **검인 서류**라서 다른
   세계를 쓴다 — 차가운 서류 종이에 청먹 잉크. 상태 네 가지만 색을 갖고,
   그 색은 장식이 아니라 뜻이다 */
:root{
  --paper:#EDEEF1; --card:#FFFFFF; --ink:#12161B; --ink-2:#3C444E;
  --rule:#D6DAE0; --rule-2:#C0C6CE; --muted:#666E79; --faint:#98A0AA;
  --원문:#1D6A45; --계산:#8A6816; --도해:#63499B; --연출:#78818C;
  --lift:0 1px 0 rgba(18,22,27,.04), 0 10px 28px rgba(18,22,27,.06);
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --paper:#0F1216; --card:#161A20; --ink:#E6E9ED; --ink-2:#B4BBC4;
  --rule:#252A32; --rule-2:#39404A; --muted:#8B939D; --faint:#5E666F;
  --원문:#63CE97; --계산:#DCBB63; --도해:#B79BEE; --연출:#7C858F;
  --lift:0 1px 0 rgba(0,0,0,.5), 0 12px 32px rgba(0,0,0,.42);
}}
:root[data-theme="dark"]{
  --paper:#0F1216; --card:#161A20; --ink:#E6E9ED; --ink-2:#B4BBC4;
  --rule:#252A32; --rule-2:#39404A; --muted:#8B939D; --faint:#5E666F;
  --원문:#63CE97; --계산:#DCBB63; --도해:#B79BEE; --연출:#7C858F;
  --lift:0 1px 0 rgba(0,0,0,.5), 0 12px 32px rgba(0,0,0,.42);
}

*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0; background:var(--paper); color:var(--ink);
  font-family:'IBM Plex Sans KR',system-ui,-apple-system,'Apple SD Gothic Neo',sans-serif;
  font-size:14.5px; line-height:1.6; word-break:keep-all;
}
.mono{font-family:'IBM Plex Mono',ui-monospace,SFMono-Regular,monospace;
      font-variant-numeric:tabular-nums}
b{font-weight:600}

/* ── 머리 ── */
header{border-bottom:1px solid var(--rule-2); background:var(--paper)}
.hd{max-width:1500px; margin:0 auto; padding:30px 22px 20px}
h1{margin:0; font-family:Hahmlet,'IBM Plex Sans KR',serif; font-weight:600;
   font-size:clamp(24px,3.4vw,34px); letter-spacing:-.02em; text-wrap:balance}
.kick{display:block; font-family:'IBM Plex Mono',monospace; font-size:11.5px;
      letter-spacing:.22em; color:var(--muted); margin-bottom:9px}
.lede{margin:12px 0 0; max-width:64ch; color:var(--ink-2); font-size:14.5px}
.lede em{font-style:normal; color:var(--ink); font-weight:500}

.tally{display:flex; flex-wrap:wrap; gap:0; margin-top:22px;
       border:1px solid var(--rule-2); background:var(--card); box-shadow:var(--lift)}
.tl{flex:1 1 110px; padding:13px 16px; border-right:1px solid var(--rule);
    display:flex; align-items:baseline; gap:9px}
.tl:last-child{border-right:0}
.tl b{font-size:22px; letter-spacing:-.02em}
.tl span{font-size:12.5px; color:var(--muted)}
.tl.st-원문 b{color:var(--원문)} .tl.st-계산 b{color:var(--계산)}
.tl.st-도해 b{color:var(--도해)} .tl.st-연출 b{color:var(--연출)}

.key{margin-top:14px; font-size:12.5px; color:var(--muted); max-width:80ch}
.key i{font-style:normal; font-weight:600; color:var(--ink-2)}

/* ── 도구 막대 ── */
.bar{position:sticky; top:0; z-index:20; background:var(--paper);
     border-bottom:1px solid var(--rule-2)}
.bar .in{max-width:1500px; margin:0 auto; padding:11px 22px;
         display:flex; gap:8px; flex-wrap:wrap; align-items:center}
input[type=search]{flex:1 1 220px; min-width:150px; padding:8px 12px; font:inherit;
  font-size:14px; background:var(--card); color:var(--ink);
  border:1px solid var(--rule-2); border-radius:0}
input[type=search]::placeholder{color:var(--faint)}
button{padding:7px 13px; font:inherit; font-size:13px; cursor:pointer;
  background:var(--card); color:var(--ink-2); border:1px solid var(--rule-2); border-radius:0}
button:hover{color:var(--ink); border-color:var(--ink-2)}
button[aria-pressed="true"]{background:var(--ink); color:var(--paper); border-color:var(--ink)}
:focus-visible{outline:2px solid var(--ink); outline-offset:2px}
.jump{margin-left:auto; display:flex; gap:14px; padding-left:10px}
.jump a{font-size:13px; color:var(--muted); text-decoration:none;
        border-bottom:1px solid var(--rule-2); padding-bottom:1px}
.jump a:hover{color:var(--ink); border-color:var(--ink)}

/* ── 본문 ── */
main{max-width:1500px; margin:0 auto; padding:0 22px 90px}
section{margin-top:42px}
h2{margin:0 0 4px; font-family:Hahmlet,'IBM Plex Sans KR',serif; font-weight:600;
   font-size:21px; letter-spacing:-.01em}
.h2sub{margin:0 0 16px; font-size:13.5px; color:var(--muted); max-width:70ch}

.scroll{overflow-x:auto; border:1px solid var(--rule-2); background:var(--card);
        box-shadow:var(--lift)}
table{width:100%; border-collapse:collapse; min-width:940px}
th,td{text-align:left; vertical-align:top; padding:11px 14px;
      border-bottom:1px solid var(--rule)}
/* thead 를 sticky 로 두면 안 된다. `.scroll` 이 overflow-x:auto 라 **이 상자가**
   스크롤 조상이 되고, top:47px 는 화면이 아니라 상자 기준으로 잡힌다 —
   머리줄이 47px 내려앉아 첫 구분줄을 덮었다 */
thead th{font-size:11px; font-weight:600; letter-spacing:.14em; text-transform:uppercase;
  color:var(--muted); background:var(--card); border-bottom:1px solid var(--rule-2)}
tr.sec td{background:var(--paper); font-size:12px; font-weight:600; letter-spacing:.1em;
  color:var(--muted); padding:13px 14px; border-bottom:1px solid var(--rule-2);
  border-top:1px solid var(--rule-2)}
.secn{font-family:'IBM Plex Mono',monospace; color:var(--ink-2); margin-right:12px}
tbody tr.r:hover{background:color-mix(in srgb,var(--ink) 4%,transparent)}
tbody tr.r:last-child th,tbody tr.r:last-child td{border-bottom:0}

/* 왼쪽 3px 레일이 상태다. 칩과 같은 말을 두 번 하는 게 아니라,
   표를 훑을 때 **색만으로** 줄이 갈라져 보이게 하는 장치 */
.r>.id{width:82px; font-size:13px; font-weight:400; color:var(--muted);
       border-left:3px solid transparent; padding-left:12px}
.st-원문>.id{border-left-color:var(--원문)}
.st-계산>.id{border-left-color:var(--계산)}
.st-도해>.id{border-left-color:var(--도해)}
.st-연출>.id{border-left-color:var(--연출)}

.say{width:25%}
.scr{width:20%; color:var(--muted); font-size:13px}
.src{width:18%; color:var(--muted); font-size:12.5px}
.stc{width:78px}
.ev{width:24%; font-size:13px; color:var(--ink-2)}
.none{color:var(--faint)}
.tag{display:block; margin-top:5px; font-size:11px; color:var(--faint);
     font-family:'IBM Plex Mono',monospace; letter-spacing:.04em}

.st{display:inline-block; padding:2px 9px; font-size:11.5px; font-weight:600;
    white-space:nowrap; border:1px solid currentColor}
.st-원문 .st{color:var(--원문)} .st-계산 .st{color:var(--계산)}
.st-도해 .st{color:var(--도해)} .st-연출 .st{color:var(--연출)}

/* 수정 이력 · 확인표 */
#fix table{min-width:820px} #fix .id{width:120px; color:var(--ink); border-left:0; padding-left:14px}
#fix .say{width:44%} #fix .ev{width:44%} .pad{width:0; padding:0}
#ok table{min-width:720px}
.okn{width:22%; font-weight:500; font-size:14px}
.okv{width:44%; font-size:13px; color:var(--ink-2)}

footer{max-width:1500px; margin:0 auto; padding:0 22px 60px; color:var(--faint);
       font-size:12.5px}

/* ── 좁은 화면: 표를 줄 단위 카드로 편다 ── */
@media (max-width:820px){
  main,.hd,.bar .in,footer{padding-left:14px; padding-right:14px}
  .scroll{overflow-x:visible; border:0; background:transparent; box-shadow:none}
  table,thead,tbody,tr,th,td{display:block; width:auto!important; min-width:0!important}
  thead{position:absolute; left:-9999px}
  tr.sec td{margin:22px 0 0; border-top:0}
  tbody tr.r{background:var(--card); border:1px solid var(--rule-2); box-shadow:var(--lift);
             margin-top:10px; padding:4px 0 8px; position:relative}
  tbody tr.r>th,tbody tr.r>td{border-bottom:0; padding:5px 14px}
  .r>.id{border-left:0; padding-left:14px; padding-top:11px;
         font-size:14px; color:var(--ink); font-weight:600}
  tbody tr.r::before{content:""; position:absolute; left:0; top:0; bottom:0; width:3px;
                     background:var(--연출)}
  tbody tr.st-원문::before{background:var(--원문)}
  tbody tr.st-계산::before{background:var(--계산)}
  tbody tr.st-도해::before{background:var(--도해)}
  td[data-l]::before{content:attr(data-l); display:block; font-size:10.5px;
    letter-spacing:.14em; text-transform:uppercase; color:var(--faint); margin-bottom:2px;
    font-family:'IBM Plex Mono',monospace}
  .pad{display:none}
  .stc{position:absolute; top:8px; right:12px; padding:0!important}
  .stc::before{display:none}
}
@media (prefers-reduced-motion:reduce){*{animation:none!important; transition:none!important}}
</style>

<header>
  <div class="hd">
    <span class="kick">더그랜드롯데 서울 · 182컷</span>
    <h1>팩트 대장</h1>
    <p class="lede">컷마다 <em>화면에 뜬 말</em>과 <em>그 근거</em>를 나란히 뒀다.
      그림이 맞는지는 검수 페이지에서 보고, 믿을 수 있는지는 여기서 본다.</p>
    <div class="tally">{{TALLY}}</div>
    <p class="key"><i>원문</i> 공시·기사·기관 문서에 그 값이 그대로 있다 &nbsp;·&nbsp;
      <i>계산</i> 원문 값에서 산수로 나온 값, 식을 같이 적었다 &nbsp;·&nbsp;
      <i>도해</i> 실제 통계가 아니라 성격을 보이려고 그린 그림, 화면에도 그렇게 적혀 있다 &nbsp;·&nbsp;
      <i>연출</i> 사실 주장이 없는 컷</p>
  </div>
</header>

<div class="bar"><div class="in">
  <input type="search" id="q" placeholder="컷 번호 · 나레이션 · 출처 검색">
  <button data-f="원문">원문</button>
  <button data-f="계산">계산</button>
  <button data-f="도해">도해</button>
  <button data-f="연출">연출</button>
  <button data-f="" id="all" aria-pressed="true">전체</button>
  <span class="jump"><a href="#fix">수정 이력</a><a href="#ok">확인만 한 것</a><a href="#ledger">컷 대장</a></span>
</div></div>

<main>
  <section id="fix">
    <h2>이번 검수에서 고친 것</h2>
    <p class="h2sub">{{NFIX}}건. 가장 큰 갈래는 <b>공시에 없는 항목을 만들어 낸 것</b>과
      <b>출처가 근거가 아니라 소재 크레딧이던 것</b>이었다.</p>
    <div class="scroll"><table>
      <thead><tr><th>컷</th><th>무엇이 문제였나</th><th>어떻게 고쳤나</th><th></th></tr></thead>
      <tbody>{{FIX}}</tbody>
    </table></div>
  </section>

  <section id="ok">
    <h2>확인만 하고 그대로 둔 것</h2>
    <p class="h2sub">{{NOK}}건. 원문까지 갔고 값이 맞아 고칠 게 없었다.</p>
    <div class="scroll"><table>
      <thead><tr><th>항목</th><th>값</th><th>확인처</th></tr></thead>
      <tbody>{{OK}}</tbody>
    </table></div>
  </section>

  <section id="ledger">
    <h2>컷 대장 — 182컷</h2>
    <p class="h2sub">위 검색·필터가 이 표에 걸린다. 왼쪽 색 띠가 상태다.</p>
    <div class="scroll"><table>
      <thead><tr><th>컷</th><th>나레이션</th><th>화면에 뜨는 것</th><th>출처</th><th>상태</th><th>근거 · 계산</th></tr></thead>
      <tbody id="tb">{{ROWS}}</tbody>
    </table></div>
  </section>
</main>

<footer>화면 글자는 자막과 겹치지 않게 숫자·단위·고유명사·가정만 남긴 상태다.
  출처 표기는 우측 상단 <span class="mono">Source : …</span> 고정.</footer>

<script>
(function(){
  var tb=document.getElementById('tb'), q=document.getElementById('q'), filter='';
  function apply(){
    var s=q.value.trim().toLowerCase(), act=null;
    Array.prototype.forEach.call(tb.rows,function(r){
      if(r.classList.contains('sec')){act=r; r.style.display='none'; return;}
      var ok=(!filter||r.dataset.st===filter)&&(!s||r.textContent.toLowerCase().indexOf(s)>=0);
      r.style.display=ok?'':'none';
      if(ok&&act)act.style.display='';
    });
  }
  q.addEventListener('input',apply);
  Array.prototype.forEach.call(document.querySelectorAll('button[data-f]'),function(b){
    b.addEventListener('click',function(){
      filter=b.dataset.f;
      Array.prototype.forEach.call(document.querySelectorAll('button[data-f]'),function(x){
        x.setAttribute('aria-pressed', x===b ? 'true' : 'false');
      });
      document.getElementById('ledger').scrollIntoView({block:'start'});
      apply();
    });
  });
})();
</script>
"""

if __name__ == '__main__':
    main()
