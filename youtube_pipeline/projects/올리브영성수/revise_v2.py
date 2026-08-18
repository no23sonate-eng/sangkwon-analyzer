#!/usr/bin/env python3
"""컷별 수정 v2 — 사용자 검수 반영 (2026-08-16).

fill_props.py 가 만든 판 위에 **컷 단위 지시**를 덮어쓴다.
따로 두는 이유: fill_props 는 "규칙으로 채우는" 파일이고, 이 파일은
"사람이 하나씩 본 뒤 고친" 파일이다. 섞으면 다음 영상에서 규칙만 재사용할 수 없다.

전역 규칙 (앞으로도 유지):
  - 출처는 **우측 위 · `Source : …`** 로 통일 (paper.jsx PaperSource 에서 처리)
  - 배경을 베이지(paper)로만 두지 않는다. ink/blueprint 를 섞는다
"""
import json, os

P = os.path.dirname(os.path.abspath(__file__))

def img(n):  return f'올리브영성수/{n}'

CRED = {
    'seongsu_facade.jpg': 'Sgroey / CC BY-SA 4.0',
    'seongsu_alley.jpg': 'Sgroey / CC BY-SA 4.0',
    'seongsu_shops.jpg': 'Sgroey / BY-SA 4.0',
    'seongsu_bldg1.jpg': 'CartoonChess / CC BY-SA 4.0',
    'seongsu_industrial.jpg': 'GeonwooLee / CC BY-SA 4.0',
    'popup_window.jpg': 'Herzi Pinki / CC BY-SA 4.0',
    'brand_storefront.jpg': 'Yzen2023 / CC BY 4.0',
    'popup_crowd.jpg': '玄史生 / CC0',
    'store_queue.jpg': 'Northwest / CC BY-SA 4.0',
    'popup_space.jpg': 'Pexels',
    'seoul_towers.jpg': 'Ox1997cow / CC BY-SA 4.0',
    'seoulforest_deck.jpg': 'CartoonChess / CC BY-SA 4.0',
    'gentlemonster_store.jpg': 'Lstae88 / CC BY-SA 4.0',
    'gentlemonster_art.jpg': 'Tomás Del Coro / CC BY-SA 4.0',
    'musinsa_popup.jpg': 'K-POPIT / CC BY 3.0',
    'amore_sulwhasoo.jpg': 'KOREA.NET / BY-SA 2.0',
    'seongsu_view.jpg': 'CC BY-SA 4.0',
    'seongsu_storefronts.jpg': 'CC BY-SA 4.0',
    'seongsu_alley2.jpg': 'CC BY-SA 4.0',
    'oliveyoung_store.png': 'Pkccccj / CC BY-SA 4.0',
    # ── 카페 쎈느 (낙찰 대상 건물) 실사. 네이버 블로그 사진이라
    #    글 주소를 그대로 화면에 적는다 ──
    'scene_void.jpg': '블로그 yunmystery / naver',
    'scene_popup_build.jpg': '블로그 solvanian / naver',
    'scene_facade_yard.jpg': '블로그 tenderrain / naver',
    'scene_interior.jpg': '블로그 imdressholic / naver',
    'scene_night_popup.jpg': '블로그 jooracan / naver',
    'scene_night.jpg': '블로그 hpphr / naver',
    'scene_queue.jpg': '블로그 protohologram / naver',
    'scene_yard.jpg': '블로그 lovingshu / naver',
    'scene_queue2.jpg': '블로그 yunny_23 / naver',
    'scene_dior.jpg': '블로그 wlsdlftn8297 / naver',
    'scene_facade.jpg': '블로그 poiu123_ / naver',
    'sindoh_hq.jpg': '블로그 realtyincome___ / naver',
    'netflix_house.jpg': 'Netflix House 공식 이미지 / 블로그 artlife',
    'musinsa_campus.jpg': '블로그 onomdear / naver',
    'seongsu_aerial.jpg': '블로그 tomoekunn / naver',
    'seongsu_aerial2.jpg': '블로그 tomoekunn / naver',
    'seongsu_street_crowd.jpg': '블로그 9zlog / naver',
    'seongsu_brickst.jpg': '블로그 9zlog / naver',
    'korea.png': 'Wikimedia Commons / CC BY-SA 3.0',
    # ── 실제 대상물 사진. 저작권이 있는 보도·기업 제공 사진이라
    #    화면에 출처를 반드시 띄운다 (PaperSource 우측 상단) ──
    'oliveyoung_myeongdong.jpg': 'Sgroey / CC BY-SA 4.0',
    'oliveyoungn_atrium.jpg': '사진=CJ올리브영 / CJ뉴스룸',
    'oliveyoungn_kpop.jpg': '사진=CJ올리브영 / CJ뉴스룸',
    'oliveyoungn_floor.jpg': '사진=CJ올리브영 / CJ뉴스룸',
    'factorial_exterior.jpg': '사진=팩토리얼 성수 / heyPOP',
    'factorial_facade.jpg': '사진=팩토리얼 성수 / heyPOP',
    'krafton_rendering.jpg': '조감도=K-프로젝트 / 더벨',
    'gentlemonster_haus.jpg': '사진=디에디트 the-edit.co.kr',
    'px_seoul_night.jpg': 'Pexels', 'px_seoul_street1.jpg': 'Pexels',
    'px_seoul_street2.jpg': 'Pexels', 'px_seoul_billboard.jpg': 'Pexels',
    'px_seoul_alley.jpg': 'Pexels', 'px_seoul_life.jpg': 'Pexels',
    'px_library.jpg': 'Pexels', 'px_seoul_busy.jpg': 'Pexels',
    'px_seoul_downtown.jpg': 'Pexels', 'px_buildings_night.mp4': 'Pexels',
    'px_street.mp4': 'Pexels', 'px_escalator.mp4': 'Pexels',
    'px_mall_walk.mp4': 'Pexels', 'px_mall_esc2.mp4': 'Pexels',
    'px_mall_interior.mp4': 'Pexels', 'px_mall_bangkok.mp4': 'Pexels',
    'popup_jewel.jpg': 'Pexels',
    'popup_exhibit.jpg': 'Pexels',
    'popup_lv.jpg': 'Wikimedia Commons / CC BY 4.0',
}
MIX = 'Mixkit'
def cred(n): return CRED.get(n, MIX)

OSM = '© OpenStreetMap contributors © CARTO'
MAP, MAPZ = '올리브영성수/seongsu.png', '올리브영성수/seongsu_zoom.png'
# 매장 6곳이 다 들어오는 범위 (z16). z17 은 좌우 끝 두 곳이 잘렸다
MAPOY = '올리브영성수/seongsu_oy.png'
BOUNDSOY = [127.030301, 37.535812, 127.071499, 37.554187]
BOUNDS = [127.011301, 37.525923, 127.093699, 37.562672]
BOUNDSZ = [127.0432, 37.539406, 127.0638, 37.548593]
# ── 좌표 (OSM Nominatim 로 다시 확인함) ────────────────────────────────
# 성수역과 크래프톤 부지가 틀려 있었다. 성수역을 올리브영N 서북쪽에 찍어 놨는데
# 실제로는 **동쪽**이고, 크래프톤은 450m 남쪽에 가 있었다.
# 검산: 쎈느 ↔ 올리브영N = 168m → 도보 2.2분. 스크립트의 "걸어서 2분"과 맞는다.
SEONGSU_ST = (37.543979, 127.056966)   # 2호선 성수역
OLIVE_N = (37.543793, 127.054720)      # 연무장7길 13 · 팩토리얼 성수
SITE = (37.544182, 127.052880)         # 연무장5길 20 · 카페 쎈느 = **낙찰 부지**
SEOULSUP = (37.543592, 127.044740)
TTUKSEOM = (37.547503, 127.046197)
KRAFTON = (37.544569, 127.056102)      # 아차산로 100 · 옛 이마트 성수 부지

def lt(media, num='', label='', sub='', tone='dark', kicker='', align='center', scrim=0.5):
    """실사 위 번호+문구 (LowerThirdCard)."""
    return ('LowerThirdCard', {'media': img(media), 'num': num, 'label': label, 'sub': sub,
                               'tone': tone, 'kicker': kicker, 'align': align,
                               'scrim': scrim, 'source': cred(media)})

def bg(name, veil=0.93, dir=0, blur=3):
    return {'backdrop': img(name), 'veil': veil, 'dir': dir, 'blur': blur}

R = {}   # 장면 → (카드, props)

# ══════════ 훅 ══════════
# #0 성수동 전경
R[0] = lt('seongsu_view.jpg', label='2026년 7월, 성수동', sub='경매 한 건', scrim=0.46)
# #1 올리브영 이미지 뒤 + 로고 앞 → 로고는 상표라 못 쓴다. 매장 실사로 대체
# 매장 간판 사진(1280px)이 원본 최대치라 1920 캔버스에서 물렁했다.
# 명동점 사진이 1920px 원본이고 간판도 더 크게 잡힌다
R[1] = lt('oliveyoung_myeongdong.jpg', label='낙찰자는 올리브영', scrim=0.52)
# #2 서울동부지법 삭제 · 2026년 7월 크게 가운데 · 맨아래 낙찰가 삭제 · "약" 작게
R[2] = ('BigStatsCard', {
    'title': '2026년 7월', 'sub': '',
    'items': [{'display': '541', 'unit': '억', 'prefix': '약', 'label': '낙찰가', 'hot': True}],
    'theme': 'ink', 'align': 'center', 'bg': bg('money_counter.mp4', 0.94, 0, 4),
    'source': '블로터 2026.07.22'})
# #3 좌 감정가/396억, 우 낙찰가/약 541억. 색은 541억에만
R[3] = ('BigStatsCard', {
    'title': '', 'sub': '',
    'items': [{'display': '396', 'unit': '억', 'label': '감정가'},
              {'display': '541', 'unit': '억', 'prefix': '약', 'label': '낙찰가', 'hot': True}],
    'theme': 'ink', 'align': 'center', 'bg': bg('cash_closeup.mp4', 0.945, 2, 4),
    'source': '블로터 2026.07.22'})
# #5 3D 대지 + 197평 중앙 · 평당가 · "자체 계산" 삭제
# 숫자 두 개를 나란히 두면 차이가 안 보인다. **높이**로 보여 준다.
# BarChartCard 는 자체 팔레트를 쓰는 구형 카드라 채널 색이 안 나와서,
# 축척이 이미 맞는 ShapeCompareCard 로 막대를 그린다
R[4] = ('ShapeCompareCard', {
    'title': '감정가 대비 +145억', 'sub': '',
    'items': [{'w': 1.9, 'h': 3.96, 'label': '396억', 'note': '감정가'},
              {'w': 1.9, 'h': 5.41, 'label': '541억', 'note': '낙찰가', 'hot': True}],
    'numbered': True,
    'theme': 'ink', 'source': '블로터 2026.07.22 · 차액은 자체 계산'})
R[5] = ('SitePlotCard', {
    'title': '대지', 'sub': '',
    'area': '197', 'areaUnit': '평', 'ratio': 1.5,
    'second': '2.75억 / 평', 'secondLabel': '평당가',
    'theme': 'paper', 'source': '블로터 2026.07.22'})
# #6 "이상한 점?" 가운데만 + 연상 배경
R[6] = lt('bl_thinking.mp4', label='이상한 점?', scrim=0.55)
# #7 첫 번째 / 경쟁자가 없었습니다
R[7] = lt('bl_gallery_look.mp4', num='1', label='경쟁자가 없었습니다', scrim=0.54)
# #9 두 번째 / 원래 매장 건물을 사지 않는 회사
R[9] = lt('bl_office_dusk.mp4', num='2', label='원래 매장 건물을 사지 않는 회사', scrim=0.54)
# #10 "매장 대부분 임차로 사용" · 1,381개만 가운데 · 1,166개 삭제
R[10] = ('BigStatsCard', {
    'title': '매장 대부분 임차로 사용', 'sub': '',
    'items': [{'display': '1,381', 'unit': '개', 'label': '전국 매장', 'hot': True}],
    'theme': 'paper', 'align': 'center',
    'bg': {'backdrop': img('korea.png'), 'veil': 0.79, 'dir': 0, 'blur': 0},
    'source': '오픈애즈 2026.04.03 · 지도 Wikimedia Commons CC BY-SA 3.0'})
# #11 성수동 지도 위 올리브영 표기
R[11] = ('MapCard', {
    'image': MAPOY, 'bounds': BOUNDSOY,
    'title': '성수 상권', 'sub': '올리브영 매장 6곳',
    'pins': [
             {'lat': 37.54526, 'lon': 127.05449, 'label': '성수역점', 'hot': False},
             {'lat': 37.54823, 'lon': 127.04345, 'label': '뚝섬역점', 'hot': False},
             {'lat': 37.54412, 'lon': 127.05492, 'label': '올리브영N 성수', 'hot': True},
             {'lat': 37.54446, 'lon': 127.0577, 'label': '뷰티 맨션 성수', 'hot': False},
             {'lat': 37.54173, 'lon': 127.04618, 'label': '서울숲역점', 'hot': False},
             {'lat': 37.54172, 'lon': 127.0584, 'label': '성수연방점', 'hot': False}],
    'align': 'left', 'source': OSM + ' · 위치 네이버지도 대조'})
# #12 건물 영상 뒤 + 가운데 질문
R[12] = lt('bl_office_dusk.mp4', label='왜 건물을 산 걸까요?', scrim=0.55)
# #13 카페 쎈느 → 저작권 자산이라 못 받는다. 성수동 실사로 대체하고 캡션에 밝힘
R[13] = lt('seongsu_storefronts.jpg', label='카페 쎈느가 임차해 온 건물',
           sub='연무장5길', scrim=0.5)
# #14,15 루이비통·디올·랄프로렌 → 저작권. 팝업 일반 실사로
R[14] = lt('popup_exhibit.jpg', label='브랜드 팝업이 이어졌다', scrim=0.5)
R[15] = lt('popup_lv.jpg', label='루이비통 · 디올 · 지프 · 랄프로렌',
            sub='사진은 브랜드 매장 — 쎈느 팝업 아님', scrim=0.56)
# #16,17 팝업스토어 연상
R[16] = lt('popup_crowd.jpg', label='팝업 성지', scrim=0.5)
R[17] = lt('popup_jewel.jpg', label='평범한 건물이 성지가 된 이유', sub='3가지', scrim=0.54)
# #18 사용자 첨부 쎈느 사진 → 파일이 오면 여기에 꽂는다. 없으면 성수 실사
R[18] = ('ShapeCompareCard', {
    'title': '건물이 네모반듯하다', 'sub': '',
    'items': [{'w': 7.5, 'h': 3.0, 'label': '', 'hot': True}],
    'theme': 'paper', 'source': '도해'})
# #19 좌 직사각형 · 우 정사각형 + 아래 양쪽 화살표
R[19] = ('ShapeCompareCard', {
    'title': '한쪽 면이 길다', 'sub': '',
    'items': [{'w': 8, 'h': 3.2, 'label': '직사각형', 'dim': 'bottom',
               'dimLabel': '긴 면', 'hot': True},
              {'w': 5, 'h': 5, 'label': '정사각형', 'dim': 'bottom', 'dimLabel': '짧은 면'}],
    'theme': 'paper', 'note': '같은 면적이라도 도로에 닿는 변의 길이가 다르다',
    'source': '도해'})
# #20,21 파사드 / 광고판
R[20] = lt('seongsu_facade.jpg', label='파사드가 노출되기 좋다', scrim=0.5)
R[21] = lt('bl_billboard.mp4', label='팝업스토어는 결국 광고판이다', scrim=0.5)
# #22 좌우 도형 더 크게 · 불필요 문구 생략
R[22] = ('FrontageCard', {
    'title': '같은 면적, 다른 얼굴', 'sub': '',
    'options': [{'label': '4 × 4', 'w': 4, 'd': 4, 'note': '광고판 4'},
                {'label': '8 × 2', 'w': 8, 'd': 2, 'note': '광고판 8', 'hot': True}],
    'floors': 2, 'note': '', 'theme': 'paper', 'source': '도해'})
R[23] = lt('bl_street_people.mp4', label='사람 시선에 더 들어온다', scrim=0.5)
R[24] = lt('seongsu_alley2.jpg', label='길에서 보이는 면이 두 배', scrim=0.52)
# #25 삭제 → 실사만
R[25] = lt('bl_street_evening.mp4', label='', scrim=0.3)
R[26] = lt('bl_installation.mp4', label='브랜드는 파사드를 연출한다', scrim=0.52)
# #27 고민하는 사람
R[27] = lt('bl_thinking2.mp4', label='래핑할지, 구조물을 세울지', scrim=0.52)
# #28 실제 래핑·광고판 다는 장면
R[28] = lt('bl_billboard.mp4', label='건물 정면을 어떻게 쓸 것인가', scrim=0.52)
# #29 작은 네모 + 어두운 배경 + 큰 문구
R[29] = ('ShapeCompareCard', {
    'title': '', 'sub': '',
    'items': [{'w': 2.2, 'h': 2.0, 'label': '', 'dim': None}],
    'theme': 'ink',
    'note': '파사드가 작다는 건, 보여줄 수 있는 얼굴이 작다는 뜻이다',
    'source': '도해'})
R[30] = lt('bl_gallery_people.mp4', label='방문객이 인증샷을 올린다', scrim=0.5)
R[31] = lt('bl_seoul_aerial.mp4', label='여러 앵글에서 찍힌다', scrim=0.5)
R[32] = lt('bl_white_gallery.mp4', num='2', label='내부 레이아웃이 좋다', scrim=0.54)

# ══════════ 내부 ══════════
# #33 1·2층을 **붙이고** 세로 화살표로 뚫린 걸 표시
R[33] = ('ShapeCompareCard', {
    'title': '1층과 2층이 뚫려 있다', 'sub': '몇몇 공간이 위아래로 열려 있다',
    'items': [{'w': 5.4, 'h': 4.2, 'label': '', 'split': 2, 'dim': 'left',
               'dimLabel': '위아래 연결', 'hot': True}],
    'theme': 'ink', 'note': '두 개 층을 하나의 공간으로 쓸 수 있다', 'source': '도해'})
# #34 좌: 한 색 / 우: 위아래 나눠 다른 색
R[34] = ('ShapeCompareCard', {
    'title': '한 층만 쓸 수도, 두 층을 통으로 쓸 수도',
    'sub': '같은 바닥이라도 쓰는 방식이 달라진다',
    'items': [{'w': 4, 'h': 4, 'label': '통으로', 'split': 1, 'hot': True},
              {'w': 4, 'h': 4, 'label': '층별로', 'split': 2}],
    'theme': 'ink', 'source': '도해'})
R[35] = lt('bl_gallery_look.mp4', label='위아래 시선이 자유롭다', scrim=0.5)
R[36] = lt('bl_white_gallery.mp4', label='공간 활용도가 높다', scrim=0.5)
R[37] = lt('bl_white_gallery.mp4', label='하얀 도화지가 클수록', sub='담을 수 있는 게 많아진다', scrim=0.54)
R[38] = lt('bl_corridor.mp4', label='', scrim=0.3)
# #39 네모 박스 + 세로 화살표로 층고 낮음
R[39] = ('ShapeCompareCard', {
    'title': '층고가 낮으면', 'sub': '',
    'shrink': {'from': 4.6, 'at': 18, 'dur': 34},   # 천장이 내려앉는다
    'items': [{'w': 7, 'h': 1.7, 'label': '낮은 층고', 'dim': 'left', 'dimLabel': '층고'}],
    'theme': 'blueprint',
    'note': '큰 조형물이 안 서고, 조명을 위에서 떨어뜨릴 자리가 안 나온다',
    'source': '도해'})
R[40] = lt('bl_columns_room.mp4', label='할 수 있는 게 줄어든다', scrim=0.52)
R[41] = lt('bl_high_ceiling.mp4', label='열려 있으면 달라진다', scrim=0.5)
R[42] = lt('bl_installation.mp4', label='실제 면적보다 커 보인다', scrim=0.52)
# #43 동선 설계 그래픽
R['_unused43'] = ('NodeArrayCard', {
    'title': '동선을 설계할 수 있다', 'sub': '어디서 들어와 어디로 흐를지',
    'cols': 3, 'rows': 3, 'perString': 3, 'spacingX': 1.0, 'spacingY': 0.75,
    'hits': [{'c': 0, 'r': 0, 'n': 0, 'label': '진입'},
             {'c': 1, 'r': 1, 'n': 1, 'label': '메인'},
             {'c': 2, 'r': 2, 'n': 2, 'label': '2층'}],
    'trail': True, 'pulse': True, 'theme': 'ink',
    'note': '층이 열려 있으면 동선을 위아래로 설계할 수 있다',
    'disclaimer': '도해', 'source': '도해'})
R[43] = ('YFlowCard', {
    'kicker': '동선을 설계할 수 있다', 'sub': '층이 열려 있으면 위아래로 흐름을 짠다',
    'nodes': [{'tag': '01', 'label': '진입', 'sub': '파사드에서 바로'},
              {'tag': '02', 'label': '1층 메인', 'sub': '가장 넓은 연출'},
              {'tag': '03', 'label': '보이드', 'sub': '위가 보인다', 'hot': True},
              {'tag': '04', 'label': '2층', 'sub': '올라가고 싶어진다'}],
    'arrows': [{'label': ''}, {'label': ''}, {'label': ''}],
    'source': '도해'})
R[44] = lt('bl_columns_room.mp4', label='기둥도 마찬가지다', scrim=0.5)
R[45] = lt('bl_columns_dark.mp4', label='기둥이 많으면 잘게 나뉜다', scrim=0.54)
R[46] = lt('bl_installation.mp4', num='3', label='마당이 있다', scrim=0.54)

# ══════════ 마당 ══════════
R[47] = lt('store_queue.jpg', label='팝업은 대기 줄이 생긴다', scrim=0.5)
R[48] = lt('bl_retail_pick.mp4', label='', scrim=0.3)
R[49] = ('YardViewCard', {
    'title': '마당이 하는 일', 'sub': '',
    'yard': 300, 'buildingH': 300, 'buildingW': 210, 'center': True,
    'personLabel': '방문객', 'yardLabel': '마당', 'buildingLabel': '파사드',
    'verdict': '건물 얼굴이 온전히 다 담긴다',
    'theme': 'paper', 'source': '도해'})
# #50 사람 → 마당 → 건물 · 시선 화살표
R[50] = ('YardViewCard', {
    'title': '내부뿐 아니라 외부까지', 'sub': '',
    'yard': 340, 'buildingH': 320, 'buildingW': 220, 'center': True,
    'personLabel': '방문객', 'yardLabel': '마당', 'buildingLabel': '건물',
    'verdict': '주변 간섭 없이 파사드를 보여 준다',
    'theme': 'paper', 'source': '도해'})
R[51] = lt('brand_storefront.jpg', label='마당은 파사드의 거리다', scrim=0.5)
# #52 인증샷도 같은 방식
R[52] = ('YardViewCard', {
    'title': '인증샷도 마찬가지', 'sub': '',
    'yard': 360, 'buildingH': 300, 'buildingW': 210, 'center': True,
    'personLabel': '촬영', 'yardLabel': '거리', 'buildingLabel': '파사드',
    'verdict': '한 프레임에 건물 얼굴이 다 들어온다',
    'theme': 'paper', 'source': '도해'})
R[53] = lt('bl_gallery_people.mp4', label='내로라하는 브랜드들이 여기서 팝업을 했다', scrim=0.54)
R[54] = lt('oliveyoung_store.png', label='올리브영 입장에선?', scrim=0.56)
# #55 테스트 완료 그래픽
R[56] = ('TrackRecordCard', {
    'title': '돈 한 푼 안 들인 오프라인 테스트', 'sub': '',
    'items': [{'label': '임차료 0원', 'note': '브랜드가 냈다'},
              {'label': '연출 사례 축적', 'note': '여러 브랜드가 실증'},
              {'label': '반응까지 확인', 'note': '인증샷·대기줄', 'hot': True}],
    'theme': 'blueprint', 'align': 'center', 'source': '화자 해석'})
R[55] = ('TrackRecordCard', {
    'title': '이미 검증이 끝났다', 'sub': '',
    'items': [{'label': '파사드 노출', 'note': '여러 브랜드가 실증'},
              {'label': '내부 레이아웃', 'note': '층을 통으로 쓴 사례'},
              {'label': '마당 활용', 'note': '대기·주차·연출'}],
    'theme': 'ink', 'source': '화자 해석'})
R[56] = lt('bl_planning.mp4', label='돈 한 푼 안 들인 오프라인 테스트', scrim=0.54)

# ══════════ 경매 ══════════
R[57] = lt('bl_lawsuit.mp4', label='그런데 왜 하필 경매였을까요?', scrim=0.55)
R[58] = lt('bl_coins.mp4', label='경매 = 싸게 사는 것?', scrim=0.54)
R[59] = lt('bl_lawsuit.mp4', label='이건 그게 아니었다', scrim=0.52)
R[60] = lt('bl_discussion.mp4', label='공유물분할 경매', scrim=0.54)
# #62 나누는 은유 — 케이크 대신 지분 격자 그래픽 유지가 낫다
R[62] = ('ShareSplitCard', {
    'title': '', 'sub': '',
    'n': 19, 'ownerLabel': '지분권자',
    'cutLabel': '땅은 반으로 못 자른다', 'bidLabel': '법원 경매 · 공개 입찰',
    'cutAt': 30, 'bidAt': 72,
    'note': '', 'theme': 'ink', 'source': '민법 제269조'})
R[63] = lt('bl_discussion.mp4', label='합의도 잘 안 된다', scrim=0.52)
R[64] = lt('bl_lawsuit.mp4', label='법원에 소송을 걸면', sub='법원이 매각을 진행한다', scrim=0.54)
R[65] = lt('bl_lawsuit.mp4', label='', scrim=0.3)
# #66 가운데 정렬 + 넘버링 (겹침 해소)
R[66] = ('TrackRecordCard', {
    'title': '두 가지가 확정된다', 'sub': '',
    'items': [{'label': '매각은 무조건 진행된다', 'note': '합의 불필요'},
              {'label': '방식은 공개 입찰이다', 'note': '가격은 시장이 정한다', 'hot': True}],
    'theme': 'ink', 'align': 'center', 'source': '민법 제269조 · 민사집행법'})
R[67] = lt('bl_discussion.mp4', label='보통은 주관사가 매수자를 섭외한다', scrim=0.54)
R[67] = ('TrackRecordCard', {
    'title': '보통의 매각 vs 경매', 'sub': '',
    'items': [{'label': '보통 매각', 'note': '주관사가 매수자를 섭외한다'},
              {'label': '경매', 'note': '공고 후 공개 입찰 — 시장이 값을 정한다', 'hot': True}],
    'theme': 'ink', 'align': 'center', 'source': '민사집행법'})
R[68] = lt('bl_seoul_gate.mp4', label='입지가 이 정도로 좋은 물건은', scrim=0.52)
R[69] = lt('bl_city_night2.mp4', label='경매라는 꼬리표가 붙어도 최고가가 나온다', scrim=0.54)
R[70] = lt('bl_towers.mp4', label='인근 신도리코 부지', sub='같은 경매 과정을 거쳤다', scrim=0.54)
# #71 그래픽으로
R[71] = ('ShareSplitCard', {
    'title': '신도리코 부지', 'sub': '소유자 19명의 공유물분할 소송',
    'n': 19, 'ownerLabel': '소유자',
    'cutLabel': '분할 불가', 'bidLabel': '2,202억 낙찰',
    'cutAt': 26, 'bidAt': 62,
    'note': '2025.8.25 · 서울동부지법 · 4,272㎡',
    # #61 과 그림이 똑같다. 열 컷 떨어져 있어도 같은 종이 바탕이면 같은 장면이
    # 다시 나온 것처럼 읽혀서, 테마라도 갈라 둔다
    'theme': 'ink', 'source': '하우징포스트 2025.09'})
# #72 서울동부지법 삭제
R[72] = ('BigStatsCard', {
    'title': '인근 사례', 'sub': '4,272㎡ · 단독 응찰',
    'items': [{'display': '2,202', 'unit': '억', 'label': '신도리코 낙찰가', 'hot': True},
              {'display': '19', 'unit': '명', 'label': '공유 소유자'}],
    'theme': 'ink', 'align': 'center', 'bg': bg('auction_columns.mp4', 0.945, 3, 4),
    'source': '하우징포스트 2025.09'})
R[73] = ('BigStatsCard', {
    'title': '반드시 받으려고 웃돈을 썼다', 'sub': '',
    'items': [{'display': '137', 'unit': '%', 'label': '감정가 대비 낙찰가', 'hot': True}],
    'theme': 'ink', 'align': 'center', 'bg': bg('money_counter.mp4', 0.94, 1, 4),
    'source': '블로터 2026.07.22'})
R[74] = lt('bl_coins.mp4', label='싸게 사려던 게 아니다', scrim=0.54)
# #75,76 본인 출연 — 배경만 깔고 문구 없음
R[75] = lt('bl_seoul_night.mp4', label='', scrim=0.25)
R[76] = lt('bl_street_topdown.mp4', label='', scrim=0.25)

# ══════════ 성수의 올리브영 ══════════
R[77] = ('MapCard', {
    'image': MAPOY, 'bounds': BOUNDSOY,
    'title': '한 상권에 여섯 곳', 'sub': '',
    'pins': [
             {'lat': 37.54526, 'lon': 127.05449, 'label': '성수역점', 'hot': False},
             {'lat': 37.54823, 'lon': 127.04345, 'label': '뚝섬역점', 'hot': False},
             {'lat': 37.54412, 'lon': 127.05492, 'label': '올리브영N 성수', 'hot': True},
             {'lat': 37.54446, 'lon': 127.0577, 'label': '뷰티 맨션 성수', 'hot': False},
             {'lat': 37.54173, 'lon': 127.04618, 'label': '서울숲역점', 'hot': False},
             {'lat': 37.54172, 'lon': 127.0584, 'label': '성수연방점', 'hot': False}],
    'align': 'left', 'source': OSM + ' · ZDNet 2025.11.17 · 위치 네이버지도 대조'})
R[78] = lt('seongsu_shops.jpg', label='성수동이 그만큼 중요한 권역', scrim=0.5)
R[79] = ('MapCard', {
    'image': MAPZ, 'bounds': BOUNDSZ,
    'title': '걸어서 2분', 'sub': '낙찰 부지 바로 옆',
    # **낙찰 부지가 지도에 아예 없었다.** 이 컷의 요점이 '그 부지에서 2분' 인데
    # 정작 그 부지가 안 찍혀 있었으니 말이 안 됐다
    'pins': [{'lat': SITE[0], 'lon': SITE[1], 'label': '낙찰 부지',
              'sub': '카페 쎈느 · 연무장5길', 'hot': True},
             {'lat': OLIVE_N[0], 'lon': OLIVE_N[1], 'label': '올리브영N 성수'},
             {'lat': SEONGSU_ST[0], 'lon': SEONGSU_ST[1], 'label': '성수역'}],
    'align': 'left', 'source': OSM + ' · 블로터 2026.07.22'})
R[80] = ('BigStatsCard', {
    'title': '올리브영N 성수', 'sub': '팩토리얼 성수 지상 1~5층',
    'items': [{'display': '1,400', 'unit': '평', 'label': '약 4,628㎡', 'hot': True}],
    'theme': 'paper', 'align': 'center', 'bg': bg('bl_retail_aisle.mp4', 0.93, 2, 3),
    'source': '한국경제 2024.11.21'})
R[81] = ('BigStatsCard', {
    'title': '개점 1년', 'sub': '전국 매장 중 내국인 방문 1위',
    'items': [{'display': '250', 'unit': '만명', 'label': '누적 방문객', 'hot': True}],
    'theme': 'ink', 'align': 'center', 'bg': bg('bl_street_people.mp4', 0.94, 4, 3),
    'source': 'CJ올리브영 2025.11.17'})
R[82] = lt('bl_retail_walk.mp4', label='', scrim=0.3)
R[83] = lt('bl_retail_browse.mp4', label='핵심 사업장', scrim=0.5)
R[84] = lt('contract_signature.mp4', label='2025년 12월 24일', sub='건물 주인이 바뀐다', scrim=0.55)
R[85] = ('StrikeSwapCard', {
    'title': '소유주 변경', 'sub': '',
    'from': '이지스자산운용', 'fromLabel': '기존',
    'to': '교보AIM자산운용', 'toLabel': '2,548억',
    'note': '', 'theme': 'ink', 'bg': bg('contract_signature.mp4', 0.945, 1, 3),
    'source': '비즈워치 2026.01.14'})
R[86] = ('BigStatsCard', {
    'title': '성수동 오피스 최고가', 'sub': '연면적 기준',
    'items': [{'display': '4,000', 'unit': '만원/평', 'label': '연면적 평당', 'hot': True}],
    'theme': 'ink', 'align': 'center', 'bg': bg('bl_office_dusk.mp4', 0.94, 5, 3),
    'source': '비즈워치 2026.01.14'})
R[87] = lt('bl_office_dusk.mp4', label='건물주가 바뀌면 임차인은?', scrim=0.55)
R[88] = ('YFlowCard', {
    'kicker': '건물주가 바뀌면', 'sub': '임차인에게 무슨 일이 생기나',
    'nodes': [{'tag': '01', 'label': '소유주 변경', 'sub': '2,548억에 인수'},
              {'tag': '02', 'label': '수익률 개선', 'sub': '매수자의 목표'},
              {'tag': '03', 'label': '임대료 인상 압력', 'sub': '추정', 'hot': True}],
    'arrows': [{'label': ''}, {'label': ''}],
    'source': '화자 판단 — 추정'})
R[89] = lt('bl_coins.mp4', label='임대료가 올라갈 가능성', scrim=0.52)
R[90] = lt('bl_thinking2.mp4', label='그대로 쓸까?', scrim=0.54)
R[91] = lt('bl_white_gallery.mp4', label='성수동 분위기와 잘 맞는 건물', scrim=0.5)

# ══════════ 사업성 ══════════
R[93] = ('BigStatsCard', {
    'title': '500억대 자산', 'sub': '',
    'items': [{'display': '541', 'unit': '억', 'prefix': '약', 'label': '낙찰가', 'hot': True}],
    'theme': 'ink', 'align': 'center', 'bg': bg('cash_closeup.mp4', 0.945, 0, 4),
    'source': '블로터 2026.07.22'})
R[94] = ('BigStatsCard', {
    'title': '취득 총액 (추정)', 'sub': '취득세 등 가산 — 자체 계산',
    'items': [{'display': '570', 'unit': '억', 'prefix': '약', 'label': '추정', 'hot': True}],
    'theme': 'ink', 'align': 'center', 'bg': bg('money_counter.mp4', 0.94, 2, 4),
    'source': '자체 계산 — 추정치'})
R[95] = lt('bl_thinking.mp4', label='570억을 회수하려면', scrim=0.54)
R[96] = lt('bl_billboard.mp4', label='광고 효과나 매출이 나와야 한다', scrim=0.52)
R[97] = ('TrackRecordCard', {
    'title': '570억을 회수하는 두 갈래', 'sub': '',
    'items': [{'label': '임대 수익', 'note': '오피스로 지어 임대료로'},
              {'label': '브랜드 효과', 'note': '광고판 · 테스트베드로', 'hot': True}],
    'theme': 'blueprint', 'align': 'center', 'source': '화자 판단'})
R[98] = ('ShapeCompareCard', {
    'title': '오피스로 지으면 (가정)', 'sub': '용적률 400~500% 가정',
    # 민무늬 막대는 "7~8층" 이라는 말을 못 받아 준다. 층 선을 그어 세게 한다
    'items': [{'w': 3, 'h': 6.5, 'label': '7~8층', 'dim': 'left', 'dimLabel': '층수',
               'split': 8, 'hot': True}],
    'theme': 'blueprint', 'note': '실제 지구단위계획 미반영 — 자체 시뮬레이션',
    'source': '자체 시뮬레이션 — 가정값'})
R[99] = ('BigStatsCard', {
    'title': '최대 연면적 (가정)', 'sub': '',
    'items': [{'display': '985', 'unit': '평', 'label': '단순 오피스 기준', 'hot': True}],
    'theme': 'blueprint', 'align': 'center', 'source': '자체 시뮬레이션 — 가정값'})
R[100] = lt('bl_office_dusk.mp4', label='임대료만으로 수익성 맞추기는 쉽지 않다', scrim=0.54)
R[101] = ('MassingCard', {
    'data': '올리브영성수/seongsu_buildings.json',
    'title': '어떤 동네에 서게 되나', 'sub': '성수 일대 실제 건물 발자국',
    'spin': 18, 'tilt': 0.40, 'theme': 'ink',
    'note': '대지가 200평이 채 안 돼 자주식 주차도 쉽지 않다',
    'source': '© OpenStreetMap contributors'})
R[102] = lt('bl_street_topdown.mp4', label='인근 토지를 더 사는 방법도 있다', scrim=0.52)
R[103] = lt('bl_seoul_gate.mp4', label='상징성 있는 위치', scrim=0.5)
R[104] = lt('bl_billboard.mp4', label='광고 효과를 1순위로 놓고 계산했다', scrim=0.54)
R[105] = lt('bl_retail_aisle.mp4', label='검증은 이미 옆에서 끝났다', scrim=0.52)
R[106] = lt('bl_installation.mp4', label='매장보다는 놀이터', scrim=0.52)
R[107] = lt('bl_gallery_people.mp4', label='테스트베드', sub='활용 계획은 미확정', scrim=0.54)
R[108] = lt('bl_white_gallery.mp4', label='제품과 트렌드를 경험하는 공간', scrim=0.52)
R[109] = lt('bl_installation.mp4', label='', scrim=0.3)
R[110] = lt('bl_gallery_look.mp4', label='그런 방향도 가능해 보인다', scrim=0.52)

# ══════════ 결론 ══════════
R[111] = lt('seongsu_industrial.jpg', label='땅을 산 건 올리브영만이 아니다', scrim=0.52)
R[112] = ('MapCard', {
    'image': MAP, 'bounds': BOUNDS,
    'title': '성수동을 사들이는 브랜드들', 'sub': '',
    'pins': [{'lat': KRAFTON[0], 'lon': KRAFTON[1], 'label': '크래프톤 사옥',
              'sub': '2028 준공 예정', 'hot': True},
             {'lat': SEONGSU_ST[0], 'lon': SEONGSU_ST[1], 'label': '성수역'},
             {'lat': TTUKSEOM[0], 'lon': TTUKSEOM[1], 'label': '뚝섬역'}],
    'align': 'left', 'source': OSM + ' · 이데일리 마켓in'})
R[113] = lt('bl_towers.mp4', label='크래프톤 사옥', sub='데이비드 치퍼필드 설계', scrim=0.54)
R[114] = lt('musinsa_popup.jpg', label='무신사', sub='사진: 무신사 뷰티 페스타 — 성수 사옥 아님', scrim=0.52)
R[115] = lt('bl_street_walk.mp4', label='성수동 투자로 유명하다', scrim=0.5)
R[116] = lt('gentlemonster_store.jpg', label='젠틀몬스터',
            sub='사진: 젠틀몬스터 매장(해외) — 성수 사옥 아님', scrim=0.52)
R[117] = ('TrackRecordCard', {
    'title': '브랜드마다 전략이 다르다', 'sub': '',
    'name': '성수동', 'role': '브랜드 부동산 격전지',
    'items': [{'label': '크래프톤', 'note': '옛 이마트 부지 · 사옥 신축'},
              {'label': '무신사', 'note': '캠퍼스 · 평당 3,500만원'},
              {'label': '젠틀몬스터', 'note': '성수동 사옥'},
              {'label': '올리브영', 'note': '541억 토지 낙찰', 'hot': True}],
    'theme': 'ink', 'align': 'center', 'source': '비즈워치 2026.01.14'})
# 젠틀몬스터 아트(마네킹 두상)를 쓰고 있었는데, "성수동에 적극 가담하겠다는
# 신호" 라는 결론 문장 옆에 놓기엔 그림이 너무 튄다. 성수 거리로 바꾼다
R[118] = lt('seongsu_bldg1.jpg', label='적극 가담하겠다는 신호',
            sub='', scrim=0.52)
R[119] = lt('bl_city_night2.mp4', label='', scrim=0.3)
R[120] = lt('amore_sulwhasoo.jpg', label='뷰티 브랜드의 오프라인 경쟁',
            sub='사진: 설화수 (아모레퍼시픽)', scrim=0.5)
R[121] = lt('bl_installation.mp4', label='올리브영만의 공간 콘텐츠를 만들지', scrim=0.54)
R[122] = lt('seoulforest_deck.jpg', label='이곳이 어떻게 바뀔까',
            sub='지켜보면 방향이 보인다', scrim=0.5)


# ══════════ 개념 그래픽으로 바꾸는 컷 ══════════
# 실사를 깔아 봐야 **말을 못 받아 주는** 컷들이다. 거리 영상 위에
# "8×2 가 4×4 보다 길어 보인다"고 써 봐야 아무것도 안 보인다.
# 도형으로 바꾸면 한 번에 끝난다 — 그래픽을 더 쓰라는 지적의 핵심.

# #23 같은 면적인데 전면 폭이 두 배 — 도형 아니면 설명이 안 된다
R[23] = ('AspectRatioCard', {
    'title': '같은 면적, 다른 얼굴', 'sub': '땅이 같아도 보이는 길이는 다르다',
    'unit': 'm',
    'items': [{'w': 8, 'h': 2, 'label': '길게 보인다', 'hot': True},
              {'w': 4, 'h': 4, 'label': '짧게 보인다'}],
    'frontLabel': '전면 폭',
    'theme': 'paper', 'caption': '',
    'source': '도해'})

# #94 낙찰가 + 취득세 + 기타 = 570억. 숫자 나열이 아니라 쌓아 올린다
R[94] = ('CostStackCard', {
    'title': '실제로 나간 돈', 'sub': '낙찰가만이 전부가 아니다', 'unit': '억원',
    'parts': [{'value': 541.5, 'display': '541.5', 'label': '낙찰가'},
              {'value': 25, 'display': '25', 'prefix': '약', 'label': '취득세 (4.6% 가정)'},
              {'value': 3.5, 'display': '3.5', 'prefix': '약', 'label': '기타 비용 (추정)'}],
    'totalLabel': '취득 총액 (추정)', 'totalDisplay': '570',
    'theme': 'ink',
    'source': '낙찰가=법원 공고 · 세율=지방세법 / 나머지 추정'})

# #120 따라갈지 / 만들지 — 마지막 질문. 답을 정해 주지 않는 갈림길로
R[120] = ('ForkPathCard', {
    'title': '앞으로의 두 갈래', 'sub': '',
    'trunkLabel': '올리브영 성수 부지',
    'branches': [{'label': '따라간다', 'note': '다른 브랜드가 이미 보여준 방식'},
                 {'label': '만든다', 'note': '올리브영만의 공간 콘텐츠'}],
    'question': '어느 쪽?',
    'theme': 'blueprint', 'source': '도해'})


# ══════════ 같은 논지가 두 번 그려지던 구간 정리 ══════════
# #18 네모반듯 / #19 직사각형vs정사각형 / #22 같은면적 / #23 같은면적 —
# 여덟 컷 안에 도형 비교 카드가 넷이고, #22 와 #23 은 **제목까지 같았다**
# ("같은 면적, 다른 얼굴"). 같은 그림을 두 번 그린 셈이라 하나로 합치고
# 대신 논지를 한 단계 진행시킨다: 평면(땅) → 입면(광고판).

# #19 는 실사로 내린다 — 도형은 #22·#23 두 장이면 충분하다
R[19] = lt('seongsu_bldg1.jpg', label='한쪽 면이 길다',
           sub='정사각형보다 한 변이 길다', scrim=0.52)

# #22 평면 — 땅 넓이는 같은데 길에 닿는 변이 두 배
R[22] = ('AspectRatioCard', {
    'title': '같은 면적, 다른 전면', 'sub': '둘 다 16㎡ — 땅 넓이는 같다',
    'unit': 'm',
    'items': [{'w': 8, 'h': 2, 'label': '길게 보인다', 'hot': True},
              {'w': 4, 'h': 4, 'label': '짧게 보인다'}],
    'frontLabel': '길에 닿는 변',
    'theme': 'paper', 'caption': '',
    'source': '도해'})

# #23 입면 — 그 변이 그대로 광고판 폭이 된다 (평면에서 입면으로 한 칸 진행)
R[23] = ('FrontageCard', {
    'title': '그만큼 광고판이 넓어진다', 'sub': '',
    # 치수선이 이미 4·8 을 재고 있다. 아래 줄까지 '광고판 4/8' 이면 같은 수를
    # 두 번 적는 셈이라, 아래 줄은 **비교 결과**만 말하게 둔다
    'options': [{'label': '4 × 4', 'w': 4, 'd': 4, 'note': ''},
                {'label': '8 × 2', 'w': 8, 'd': 2, 'note': '광고판 폭 2배', 'hot': True}],
    'floors': 2, 'unit': 'm', 'note': '', 'theme': 'ink', 'source': '도해'})

# #29 다섯 번째 도형 카드가 될 자리였다. 파사드 얘기는 #22·#23 에서
# 평면·입면으로 이미 다 그렸고, 여기서 또 네모를 그리면 같은 그림 반복이다.
# 좁은 파사드 실사로 내리고 그래픽 밀도를 이 구간에서 낮춘다.
# #13 이 seongsu_storefronts 를 쓰고 있다. 좁은 파사드는 골목 상가가 더 맞다
R[29] = lt('seongsu_alley2.jpg', label='보여줄 수 있는 얼굴이 작다',
           sub='파사드가 작다는 건', scrim=0.54)

# ══════════ 같은 카드가 세 번씩 나오던 구간 ══════════
# YardView ×3 (#49·50·52), ShareSplit ×3 (#61·62·71), TrackRecord ×3 (#55·66·67).
# 게다가 #61→#62, #66→#67 은 **바로 붙어** 있었다. 소재는 안 겹쳐도 화면 구조가
# 겹치면 같은 그림이 두 번 지나간 것으로 읽힌다. 각 계열에서 하나씩만 남긴다.

# #50 마당 얘기는 #49 도해로 끝났다. 여기선 실제 외부 공간을 보여 준다
# 마지막 컷(#122)이 서울숲 데크를 쓴다. 여기선 건물 앞 외부 공간으로
R[50] = lt('seongsu_shops.jpg', label='내부뿐 아니라 외부까지',
           sub='건물 밖까지 덤으로 받는다', scrim=0.5)
# #52 인증샷 — 도해보다 사람이 찍는 장면이 낫다
R[52] = lt('bl_phonesnap.mp4', label='건물 얼굴이 온전히 다 담긴다',
           sub='인증샷도 마찬가지', scrim=0.5)
# #62 나눌 수 없다는 건 #61 도해가 이미 말했다. 여기선 그래서 간 곳 — 법원
R[62] = lt('px_gavel.mp4', label='나눌 수 없으니 법원으로 간다',
           sub='', tone='dark', scrim=0.55)

# #67 "보통 매각 vs 경매" 는 목록이 아니라 **갈림길**이다. 게다가 결말이 정해져
# 있으니 (#120 과 달리) 한쪽을 확정해 보여 준다 — 같은 카드도 상태가 다르면
# 다른 그림이 된다
R[67] = ('ForkPathCard', {
    'title': '건물을 파는 두 가지 방법', 'sub': '',
    'trunkLabel': '신도리코 부지',
    'branches': [{'label': '보통 매각', 'note': '주관사가 매수자를 섭외한다'},
                 {'label': '경매', 'note': '공고 후 공개 입찰 — 시장이 값을 정한다'}],
    'decided': 1,
    'theme': 'ink', 'source': '도해'})

# #73 137% 는 #8 에서 이미 크게 썼다. 같은 수를 같은 카드로 두 번 띄우지 않는다
R[73] = lt('px_receipts.mp4', label='반드시 받으려고 웃돈을 썼다',
           sub='싸게 사려던 게 아니다', scrim=0.55)


# ══════════ 같은 카드가 바로 붙어 있던 세 쌍 ══════════
# #3 감정가 396 vs 낙찰가 541 을 큰 수로 띄우고, 바로 다음 #4 가 **같은 두 수를**
# 막대로 다시 그렸다. 같은 비교를 두 번 한 셈이라 #3 은 말만 받아 주고
# 비교는 #4 막대에 맡긴다
R[3] = lt('cash_closeup.mp4', label='감정가는 396억이었다',
          sub='', tone='dark', scrim=0.55)

# #33·#34 도형 카드가 붙어 있었다. 뚫린 층은 실사가 훨씬 잘 보여 준다
R[33] = lt('bl_high_ceiling.mp4', label='1층과 2층이 뚫려 있다',
           sub='몇몇 공간이 위아래로 열려 있다', scrim=0.52)

# #80·#81 수치 카드가 붙어 있었다. 방문객 수는 매장 실사 위에 얹는다
R[81] = lt('px_mall_high.mp4', label='개점 1년 누적 250만 명',
           sub='전국 매장 중 내국인 방문 1위', scrim=0.55)


# ══════════ 3차 검수 ══════════
# #54 "올리브영 입장에선?" 자리에 설화수 제품 사진이 있었다. 아모레 제품이라
# 문장과 정반대다. 화장품 매대 실사로 바꾼다
R[54] = lt('px_makeup.mp4', label='올리브영 입장에선?', sub='', scrim=0.5)

# #18 큰 옐로 사각형 하나뿐이라 도형이 아니라 색면으로 읽혔다.
# 아래 치수선을 그어 "평면"이라는 걸 알린다
R[18] = ('ShapeCompareCard', {
    'title': '건물이 네모반듯하다', 'sub': '',
    'items': [{'w': 7.5, 'h': 3.0, 'label': '', 'dim': 'bottom',
               'dimLabel': '한 변이 곧다', 'hot': True}],
    'theme': 'paper', 'source': '도해'})


# ── 시각 계열 ──────────────────────────────────────────────────────────
# 파일이 다르다고 화면이 달라지는 게 아니다. 야경 항공샷 셋이 연달아 나오면
# 소재는 서로 다른데 보는 사람에겐 **같은 그림이 세 번**이다 (#30·#31·#32 가
# 그랬다). 그래서 파일 중복과 별개로 **계열이 붙는 것**도 막는다.
FAMILY = [
    ('night',   ('city_night', 'city_lights', 'seoul_night', 'buildings_night',
                 'seoul_aerial', 'aerial_sunset', 'towers', 'city_river',
                 'seoul_stream', 'rooftop', 'topdown_roof', 'seoul_downtown')),
    ('street',  ('street_', 'seongsu_alley', 'seoul_alley', 'seoul_street',
                 'seoul_busy', 'seoul_life', 'px_street', 'seoul_gate')),
    ('retail',  ('retail_', 'mall', 'store_queue', 'brand_storefront', 'escalator',
                 'window_shop', 'makeup', 'beauty', 'storefronts')),
    ('gallery', ('gallery', 'installation', 'white_gallery', 'exhibit',
                 'arch_hall', 'high_ceiling', 'columns', 'concourse', 'corridor',
                 'lobby', 'station_hall', 'library')),
    ('office',  ('office_', 'desk_top', 'planning', 'discussion', 'thinking',
                 'phonesnap', 'blueprint', 'architect', 'lawsuit')),
    ('money',   ('money_', 'cash_', 'coins', 'vault', 'credit', 'receipts',
                 'contract', 'handshake', 'sign_', 'gavel', 'auction_')),
    ('site',    ('crane', 'construction', 'aerial_land', 'topdown_block',
                 'industrial', 'billboard')),
]


def family(name):
    n = os.path.basename(name).lower()
    for fam, keys in FAMILY:
        if any(k in n for k in keys):
            return fam
    return 'etc'


# #102 "인근 토지를 더 사는 방법" 자리에 바다 항공샷이 들어가 있었다.
# 빈 땅이 보이는 항공샷으로 바꾼다
R[102] = lt('px_aerial_land.mp4', label='인근 토지를 더 사는 방법도 있다',
            sub='', scrim=0.52)
# #113 "크래프톤 사옥" 자리에 거실 소파가 있었다. 사옥 사진은 없으니
# 최소한 업무용 건물군으로 받는다 (사진이 대상 건물이 아님은 자막에 적혀 있다)
R[113] = lt('seoul_towers.jpg', label='크래프톤 사옥',
            sub='데이비드 치퍼필드 설계 · 사진은 대상 건물 아님', scrim=0.54)


# ══════════ 실제 대상물 사진 교체 ══════════
# 그동안 "성수동 어딘가" 로 때우던 자리에 **진짜 그 건물** 사진을 넣는다.
# 전부 저작권이 있는 사진이라 출처를 화면 우측 상단에 그대로 띄운다.

# #80 올리브영N 성수 1,400평 — 실제 매장 아트리움을 뒤에 깐다
# 여기가 "팩토리얼 성수" 를 입으로 말하는 컷이다. #78 에서 건물 전경을 봤으니
# 여기선 파사드 접사로 붙는다 — 넓게 보여 준 뒤 가까이 가는 순서 (B1M 문법).
R[80] = ('BigStatsCard', {
    'title': '올리브영N 성수', 'sub': '팩토리얼 성수 지상 1~5층',
    'items': [{'display': '1,400', 'unit': '평', 'label': '약 4,628㎡', 'hot': True}],
    'theme': 'ink', 'align': 'center',
    'bg': {'backdrop': img('factorial_facade.jpg'), 'veil': 0.74, 'dir': 0, 'blur': 1},
    'source': 'CJ올리브영 · 사진=팩토리얼 성수 / heyPOP'})

# 아트리움은 여기로 내린다 — "핵심 사업장" 은 매장 안이 받아 주는 게 맞다
R[83] = lt('oliveyoungn_atrium.jpg', label='핵심 사업장',
           sub='올리브영N 성수', scrim=0.5)

# #105 "검증은 이미 옆의 올리브영N에서 끝냈다" — 바로 그 매장
R[105] = lt('oliveyoungn_kpop.jpg', label='검증은 이미 옆에서 끝났다',
            sub='올리브영N 성수', scrim=0.5)

# #81 개점 1년 250만 명 — 매장 실사 위에
# 아트리움은 #80 이 배경으로 쓴다. 여기는 다른 층 실사로
R[81] = lt('oliveyoungn_floor.jpg', label='개점 1년 누적 250만 명',
           sub='전국 매장 중 내국인 방문 1위', scrim=0.55)

# #79 지도 컷 다음, 팩토리얼 성수 외관을 한 번 보여 준다
R[78] = lt('factorial_exterior.jpg', label='팩토리얼 성수',
           sub='올리브영N 성수가 1~5층을 쓴다', scrim=0.5)

# #113 크래프톤 사옥 — 서울 스카이라인 대신 실제 조감도
R[113] = lt('krafton_rendering.jpg', label='크래프톤 사옥',
            sub='데이비드 치퍼필드 설계 · 2027년 준공 예정', scrim=0.5)

# #116 젠틀몬스터 — 해외 매장 사진 대신 성수 신사옥
R[116] = lt('gentlemonster_haus.jpg', label='젠틀몬스터',
            sub='하우스 노웨어 서울 · 성수', scrim=0.5)


# ══════════ 낙찰 대상 건물 — 진짜 쎈느 사진 ══════════
# 그동안 "사진은 성수동 카페 거리 — 대상 건물 아님" 이라고 달아 두고 넘어갔다.
# 네이버 이미지 검색에 이 건물 사진이 널려 있었다. 구글은 스크립트가 돌아야
# 결과가 보여서 curl 로는 빈 껍데기만 왔고, 그걸 "없다" 로 결론지은 게 잘못이었다.
# 이제 영상의 핵심 컷이 전부 **그 건물** 이다.

R[13] = lt('scene_facade_yard.jpg', label='카페 쎈느가 임차해 온 건물',
           sub='연무장5길 · 낙찰 대상 건물', scrim=0.5)
R[14] = lt('scene_popup_build.jpg', label='브랜드 팝업이 이어졌다',
           sub='팝업 구조물 설치 중', scrim=0.5)
R[15] = lt('scene_dior.jpg', label='루이비통 · 디올 · 지프 · 랄프로렌',
           sub='디올 팝업 당시', scrim=0.52)
R[16] = lt('scene_queue.jpg', label='팝업 성지', sub='', scrim=0.5)
R[20] = lt('scene_facade.jpg', label='파사드가 노출되기 좋다', sub='', scrim=0.5)
R[21] = lt('scene_night_popup.jpg', label='팝업스토어는 결국 광고판이다',
           sub='', scrim=0.5)
R[24] = lt('scene_night.jpg', label='길에서 보이는 면이 두 배', sub='', scrim=0.34)
# #33 1층과 2층이 뚫려 있다 — 도해가 아니라 **그 공간 사진**이 제일 세다
R[33] = lt('scene_void.jpg', label='1층과 2층이 뚫려 있다',
           sub='몇몇 공간이 위아래로 열려 있다', scrim=0.5)
R[35] = lt('scene_interior.jpg', label='위아래 시선이 자유롭다', sub='', scrim=0.5)
R[47] = lt('scene_queue2.jpg', label='팝업은 대기 줄이 생긴다', sub='', scrim=0.5)
# 마당 사진이 온통 흰색이라 흰 글씨가 날아간다. 밝은 톤(검은 글씨)으로 뒤집는다
R[49] = lt('scene_yard.jpg', label='마당을 대기 공간으로', sub='',
           tone='light', scrim=0.42)


# ══════════ 컷별 검수 반영 (레이아웃) ══════════
# #18 도형과 치수선이 위로 몰려 있었다 — 통째로 아래로
R[18] = ('ShapeCompareCard', {
    'title': '건물이 네모반듯하다', 'sub': '',
    'items': [{'w': 7.5, 'h': 3.0, 'label': '', 'dim': 'bottom',
               'dimLabel': '한 변이 곧다', 'hot': True}],
    'nudge': 56, 'theme': 'paper', 'source': '도해'})

# #71 #61 과 그림이 똑같았다. 지분으로 쪼개진 한 필지를 **네모 안 분할선**으로
#     보여 준다 — 같은 사실을 다른 그림으로
R[71] = ('ShapeCompareCard', {
    'title': '신도리코 부지', 'sub': '소유자 19명 · 한 필지',
    'items': [{'w': 7.6, 'h': 3.4, 'label': '분할 불가', 'dim': 'bottom',
               'dimLabel': '4,272㎡', 'hot': True}],
    'divide': 19, 'nudge': 30,
    'note': '2025.8.25 · 서울동부지법 · 2,202억 낙찰',
    'theme': 'ink', 'source': '하우징포스트 2025.09'})

# #97 목록 카드가 네 번째였다. 두 갈래는 좌우 판이 맞다 — 둘 다 살아 있는 구조
R[97] = ('TwoPanelCard', {
    'title': '570억을 회수하는 두 갈래', 'sub': '',
    'panels': [{'tag': '01', 'label': '임대 수익', 'note': '오피스로 지어 임대료로'},
               {'tag': '02', 'label': '브랜드 효과', 'note': '광고판 · 테스트베드로', 'hot': True}],
    'divider': '동시에', 'theme': 'blueprint', 'source': '화자 판단'})

# #117 목록 카드 대신 **표** — 브랜드마다 방식이 다르다는 건 표가 제일 잘 보인다
R[117] = ('YTableCard', {
    'title': '브랜드마다 전략이 다르다', 'sub': '성수동 · 브랜드 부동산 격전지',
    'rows': [{'label': '크래프톤', 'value': '사옥 신축', 'note': '옛 이마트 부지'},
             {'label': '무신사', 'value': '캠퍼스', 'note': '평당 3,500만원'},
             {'label': '젠틀몬스터', 'value': '사옥', 'note': '하우스 노웨어 서울'},
             {'label': '올리브영', 'value': '토지 낙찰', 'note': '541억', 'hot': True}],
    'theme': 'ink', 'source': '비즈워치 2026.01.14'})

# #120 갈림길 방식은 살리되 그림을 바꾼다 — 좌우 판 + 가운데 물음
R[120] = ('TwoPanelCard', {
    'title': '앞으로의 두 갈래', 'sub': '올리브영 성수 부지',
    'panels': [{'tag': 'A', 'label': '따라간다', 'note': '다른 브랜드가 이미 보여준 방식'},
               {'tag': 'B', 'label': '만든다', 'note': '올리브영만의 공간 콘텐츠'}],
    'divider': '어느 쪽?', 'theme': 'ink', 'source': '도해'})

# #98 도형이 화면 높이의 20% 밖에 안 됐다 — 부제를 빼서 띠를 넓히고 키운다
R[98] = ('ShapeCompareCard', {
    'title': '오피스로 지으면 7~8층', 'sub': '',
    'items': [{'w': 3.4, 'h': 7.4, 'label': '', 'dim': 'left', 'dimLabel': '층수',
               'split': 8, 'hot': True}],
    'theme': 'blueprint',
    'note': '용적률 400~500% 가정 · 실제 지구단위계획 미반영 — 자체 시뮬레이션',
    'source': '자체 시뮬레이션 — 가정값'})

# #101 매싱이 뜬금없다는 지적. 문구를 아래 가운데로 내리고 도형을 키운다
R[101] = ('MassingCard', {
    'data': img('seongsu_buildings.json'),
    'title': '어떤 동네에 서게 되나', 'sub': '성수 일대 실제 건물 발자국',
    'spin': 14, 'tilt': 0.52, 'scale': 1.25, 'theme': 'ink',
    'note': '대지가 200평이 채 안 돼 자주식 주차도 쉽지 않다',
    'source': '© OpenStreetMap contributors'})

# #23 내용이 위로 몰려 있었다 (FrontageCard 안에서 y0 +40 · 좌우 당김 처리)
# #34 두 도형이 양 끝에 붙어 있었다 (ShapeCompareCard PULL 처리)
# #4  막대 두 개도 같은 처리
# #55 #66 순번이 세로선 위에 겹쳤다 (TrackRecordCard 에서 선 오른쪽으로)
# #61 판이 왼쪽에 쏠렸다 (ShareSplitCard PX 가운데 정렬)
# #85 화살표 추가 · 간격 확대 · 새 값 축소 (StrikeSwapCard)


# ══════════ 컷별 검수 반영 (소재) ══════════
R[0] = lt('seongsu_aerial.jpg', label='2026년 7월, 성수동', sub='경매 한 건', scrim=0.46)
R[19] = lt('px_buildings_night.mp4', label='한쪽 면이 길다',
           sub='정사각형보다 한 변이 길다', scrim=0.5)
R[29] = lt('px_drone_roofs.mp4', label='보여줄 수 있는 얼굴이 작다',
           sub='파사드가 작다는 건', scrim=0.5)
R[50] = lt('seongsu_street_crowd.jpg', label='내부뿐 아니라 외부까지',
           sub='건물 밖까지 덤으로 받는다', scrim=0.5)
# 낙찰 부지는 신도리코 본사에서 50m — 그 관계를 자막에 적어 사진과 사실을 맞춘다
R[70] = lt('sindoh_hq.jpg', label='인근 신도리코 부지',
           sub='낙찰 부지는 신도리코 본사에서 50m · 같은 경매 과정', scrim=0.54)
R[82] = lt('px_drone_urban.mp4', label='전국 매장 중 내국인 방문 1위', sub='', scrim=0.52)
R[90] = lt('oliveyoungn_kpop.jpg', label='매장보다는 놀이터', sub='', scrim=0.5)
R[91] = lt('seongsu_brickst.jpg', label='성수동 분위기와 잘 맞는 건물', sub='', scrim=0.52)
R[108] = lt('netflix_house.jpg', label='넷플릭스 하우스',
            sub='체험형 공간의 대표 사례', scrim=0.46)
R[109] = lt('px_mall_high.mp4', label='그런 방향도 가능해 보인다', sub='', scrim=0.5)
R[111] = lt('seongsu_aerial2.jpg', label='땅을 산 건 올리브영만이 아니다', sub='', scrim=0.52)
R[114] = lt('musinsa_campus.jpg', label='무신사', sub='성수 무신사 캠퍼스', scrim=0.5)
R[118] = lt('px_drone_roofs2.mp4', label='적극 가담하겠다는 신호', sub='', scrim=0.52)
# 성수 거리 사진은 #50 이 먼저 쓴다. 여기는 사람 몰린 거리(스트릿마켓 결) 로
R[119] = lt('px_seoul_busy.jpg', label='', sub='', scrim=0.34)


# ══════════ 기사 인용 (ArticleCard) ══════════
# 이 영상은 기사에서 나온 숫자로 굴러가는데 정작 **기사 판을 한 번도 안 띄웠다.**
# 원문 덩어리를 놓고 핵심 구절만 형광펜으로 칠하면 "내가 고른 말"이 아니라
# "기사에 그렇게 적혀 있다"가 된다. 근거가 필요한 세 자리에 넣는다.
# 칠할 구간은 «…» 로 감싼다.

R[3] = ('ArticleCard', {
    'outlet': '뉴스스페이스', 'date': '2026.07',
    'body': ('CJ올리브영은 성동구 성수동2가 314-2번지 토지면적 651㎡(약 197평) 규모 '
             '2층 건물 경매에 단독 입찰해 «541억 5,290만원»을 써냈다. 이는 '
             '«감정가 395억 9,288만원» 대비 136.77%에 달하는 금액으로, '
             '평당 약 2억 7,000만원 수준이다.'),
    'theme': 'ink', 'source': '뉴스스페이스 · 블로터 2026.07.22'})

R[69] = ('ArticleCard', {
    'outlet': '뉴스1', 'date': '2025.09',
    'body': ('지난달 25일 서울동부지방법원 경매에서 성수동2가 준공업지역 토지 4,274㎡와 '
             '건물 2,503㎡가 «2,202억 100만원»에 낙찰됐다. 2021년 강남 논현동 빌딩의 '
             '1,055억원을 뛰어넘는 «국내 경매 시장 사상 최고 기록»이다.'),
    'theme': 'ink', 'source': '뉴스1 2025.09 · 헤럴드경제'})

R[84] = ('ArticleCard', {
    'outlet': '비즈워치', 'date': '2026.01.14',
    'body': ('팩토리얼 성수가 «2,548억원»에 새 주인을 찾았다. 이지스자산운용에서 '
             '교보AIM자산운용으로 소유주가 바뀌며, 연면적 3.3㎡당 «4,000만원» 수준으로 '
             '«성수동 오피스 최고가»를 새로 썼다.'),
    # 흰 지면이라 종이 테마에선 판 경계가 안 보인다 — 먹 테마로
    'theme': 'ink', 'source': '비즈워치 2026.01.14'})

# ── 이제 출처가 있으니 정확한 자릿수를 쓴다 ──
# 그동안 블로터가 '약 541억' 까지만 써서 화면에도 반올림해 놨었다.
R[2] = ('BigStatsCard', {
    'title': '2026년 7월', 'sub': '',
    'items': [{'display': '541.5', 'unit': '억', 'label': '낙찰가',
               'sub': '541억 5,290만원 · 단독 입찰', 'hot': True}],
    'theme': 'ink', 'align': 'center', 'bg': bg('money_counter.mp4', 0.94, 0, 4),
    'source': '뉴스스페이스 · 블로터 2026.07.22'})

R[8] = ('BigStatsCard', {
    'title': '단독 입찰', 'sub': '경쟁자가 없는데 감정가를 넘겼다',
    'items': [{'display': '1', 'unit': '곳', 'label': '입찰 참여'},
              {'display': '136.77', 'unit': '%', 'label': '감정가 대비', 'hot': True}],
    'theme': 'ink', 'align': 'center', 'bg': bg('auction_columns.mp4', 0.93, 0, 3),
    'source': '뉴스스페이스 · 블로터 2026.07.22'})


# ── 바꾸면 안 되는 소재 ─────────────────────────────────────────────────
# 계열만 맞추면 되는 소재가 있고, **그 컷에서만 뜻이 통하는** 소재가 있다.
# 젠틀몬스터 매장 사진은 젠틀몬스터를 말할 때만 맞고, 다른 데로 옮기면
# 그냥 이상한 그림이다 (실제로 마네킹 두상이 마지막 컷으로 옮겨 갔다).
# 고유명사·특정 장소가 찍힌 것은 자리에서 못 움직이게 한다.
IDENTITY = ('gentlemonster', 'musinsa', 'amore_', 'oliveyoung', 'brand_storefront',
            'seongsu_', 'seoulforest', 'popup_', 'store_queue', 'seoul_towers',
            'factorial_', 'krafton_', 'scene_', 'sindoh_', 'netflix_', 'musinsa_')


def is_identity(name):
    n = os.path.basename(name).lower()
    return any(k in n for k in IDENTITY)


# ── 소재 중복 감시 ──────────────────────────────────────────────────────
# **같은 영상/사진이 두 번 나오면 안 된다** (검수 지적). 컷을 하나씩 고치면
# 고칠 때마다 다른 데서 또 겹치므로, 배정이 끝난 뒤 **전수로 훑어 강제**한다.
#
# 규칙: 이미 쓴 소재가 또 나오면 → 아직 안 쓴 소재 중에서 고른다.
# 남는 게 없으면 **가장 적게·가장 멀리 떨어져 쓰인 것**을 고른다.
# 종류(영상/사진)는 유지한다 — 사진 자리에 영상이 들어가면 리듬이 깨진다.
def dedupe_media(plan, props, pubdir):
    import collections
    base = os.path.join(pubdir, '올리브영성수')
    # 지도·건물 데이터는 **소재가 아니라 자료**다. 같은 지도를 두 번 쓰는 건
    # 반복이 아니라 같은 지역을 두 번 보는 것이므로 교체 대상에서 뺀다.
    DATA = ('seongsu.png', 'seongsu_zoom', 'seongsu_oy', 'seongsu_buildings', 'korea')
    pool_v, pool_i = [], []
    for f in sorted(os.listdir(base)):
        if f.startswith(DATA) or is_identity(f):
            continue
        if f.endswith('.mp4'):
            pool_v.append(f'올리브영성수/{f}')
        elif f.endswith(('.jpg', '.png')):
            pool_i.append(f'올리브영성수/{f}')

    # 화면에 나오는 자리는 세 군데다 — 전면 실사(media), 카드 뒷배경(bg.backdrop),
    # 순수 b-roll. 예전 판은 media 만 봤고, 그래서 뒷배경으로 돌려 쓴 클립이
    # 네 번씩 나오는 걸 못 잡았다 (money_counter ×4, auction_columns ×4).
    # **한 화면에 보이는 이상 전부 같은 판에서 센다.**
    slots = []
    for idx, sc in enumerate(plan['scenes']):
        e = props['scenes'].get(str(sc['id']))
        if e:
            pr = e['props']
            if pr.get('media'):
                slots.append((idx, sc['id'], lambda pr=pr: pr, 'media', pr['media']))
            b = pr.get('bg') or {}
            if b.get('backdrop'):
                slots.append((idx, sc['id'], lambda b=b: b, 'backdrop', b['backdrop']))
        br = sc.get('broll')
        # b-roll 은 {src, ss, dur} 꼴이고 src 에 폴더가 안 붙어 있다.
        # 다른 두 자리와 표기가 달라 그대로 비교하면 같은 클립을 못 알아본다
        if br and br.get('src'):
            slots.append((idx, sc['id'], lambda br=br: br, 'src', f"올리브영성수/{br['src']}"))

    used = collections.Counter()
    lastAt = {}
    famAt = {}
    swapped = 0
    for idx, sid, holder, key, cur in slots:
        if any(os.path.basename(cur).startswith(d) for d in DATA):
            continue
        # 고유명사 소재는 **처음 나온 자리에서만** 잠근다. 무조건 잠그면 R 표가
        # 같은 사진을 두 군데에 걸어 놨을 때 둘 다 고정돼 중복이 남는다 —
        # 손으로 하나씩 갈아 끼우다 보면 또 다른 자리와 부딪친다.
        if is_identity(cur) and used[cur] == 0:
            used[cur] += 1
            lastAt[cur] = idx
            famAt[idx] = family(cur)
            continue
        pool = pool_v if cur.endswith('.mp4') else pool_i
        near0 = {famAt.get(idx - 1), famAt.get(idx - 2)}
        if used[cur] == 0 and family(cur) not in near0:
            used[cur] += 1
            lastAt[cur] = idx
            famAt[idx] = family(cur)
            continue
        if used[cur] == 0:
            # 파일은 처음 쓰지만 계열이 앞 컷과 붙는다 — 바꿀 수 있으면 바꾼다
            alt = [m for m in (pool_v if cur.endswith('.mp4') else pool_i)
                   if used[m] == 0 and family(m) not in near0
                   and family(m) == family(cur)]
            if not alt:
                used[cur] += 1
                lastAt[cur] = idx
                famAt[idx] = family(cur)
                continue
        fresh = [m for m in pool if used[m] == 0]
        # **뜻을 먼저 지킨다.** 원래 고른 소재와 같은 계열 안에서 바꾼다 —
        # 겹치지 않는 것만 보고 고르게 뒀더니 "파사드가 작다" 컷에 마네킹
        # 두상이 들어갔다 (#29). 화면이 다양해도 문장과 안 맞으면 못 쓴다.
        want = family(cur)
        same = [m for m in fresh if family(m) == want]
        # 같은 계열 안에서, 앞 두 컷과 겹치지 않는 걸 우선
        near = {famAt.get(idx - 1), famAt.get(idx - 2)}
        best = [m for m in fresh if family(m) not in near and family(m) == want]
        pick = (best or same or [m for m in fresh if family(m) not in near]
                or fresh or [None])[0] or min(
            pool, key=lambda m: (used[m], -(idx - lastAt.get(m, -99))))
        d = holder()
        d[key] = os.path.basename(pick) if key == 'src' else pick
        if key == 'media':
            d['source'] = cred(os.path.basename(pick))
        used[pick] += 1
        lastAt[pick] = idx
        famAt[idx] = family(pick)
        swapped += 1

    dup = [m for m, c in used.items() if c > 1]
    print(f'중복 교체 {swapped}자리 · 화면 소재 {len(used)}종 · 남은 중복 {len(dup)}종')
    for m in dup:
        print(f'   {os.path.basename(m)} × {used[m]}')
    return len(dup)


# ── 반영 ────────────────────────────────────────────────────────────────
plan = json.load(open(f'{P}/scene_plan.json', encoding='utf-8'))
props = json.load(open(f'{P}/scene_props.json', encoding='utf-8'))
by = {s['id']: s for s in plan['scenes']}

PUB = os.path.join(os.path.dirname(os.path.dirname(P)), 'motion', 'public')
missing = set()
applied = 0
for sid, (card, pr) in R.items():
    if sid not in by:
        continue
    # 자산이 실제로 있는지 확인 — 없는 걸 가리키면 렌더가 아니라 QA 에서 잡히지만
    # 여기서 미리 걸러야 어떤 소재가 비었는지 한눈에 보인다
    for key in ('media', 'image'):
        v = pr.get(key)
        if v and not os.path.exists(os.path.join(PUB, v)):
            missing.add(v)
    b = (pr.get('bg') or {}).get('backdrop')
    if b and not os.path.exists(os.path.join(PUB, b)):
        missing.add(b)
    by[sid]['card'] = card
    e = props['scenes'].setdefault(str(sid), {})
    e['card'] = card
    e['props'] = pr
    # **여기서 지정한 컷은 전부 카드가 화면을 차지한다.**
    # 원래 순수 b-roll 이던 장면은 cardDur 이 0 이라 카드 렌더가 통째로
    # 건너뛰어진다 — 지도·도형이 아예 안 나오고 b-roll 만 남는 사고가 났다
    # (#11 지도, #19·#29 도형이 실사로 나왔다). 종류를 가리지 말고 켠다.
    by[sid].pop('broll', None)
    by[sid]['cardDur'] = by[sid]['dur']
    applied += 1

json.dump(plan, open(f'{P}/scene_plan.json', 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
json.dump(props, open(f'{P}/scene_props.json', 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)

# ── 껍데기 연속 끊기 ────────────────────────────────────────────────────
# LowerThirdCard 는 배경이 매 컷 달라서 눈에는 안 지겹지만, QA 는 (카드+바탕+정렬)만
# 본다. 그래도 규칙은 맞다 — **문구가 늘 화면 정중앙**이면 실제로 리듬이 없어진다.
# 그래서 정렬을 섞는다: 두세 컷마다 왼쪽 정렬로 떨어뜨리고 톤도 갈아 끼운다.
run, last = 0, None
for i, s in enumerate(plan['scenes']):
    if s.get('cardDur', s['dur']) <= 0:
        continue
    e = props['scenes'].get(str(s['id']))
    if not e:
        continue
    pr = e['props']
    combo = (e['card'], pr.get('theme', 'paper'), pr.get('align', 'center'))
    run = run + 1 if combo == last else 1
    last = combo
    if run < 3:
        continue
    if e['card'] == 'LowerThirdCard':
        pr['align'] = 'left' if pr.get('align', 'center') == 'center' else 'center'
        # 왼쪽 정렬 컷은 톤도 한 번 뒤집어 화면 밝기를 바꾼다
        if pr['align'] == 'left' and i % 2:
            pr['tone'] = 'light' if pr.get('tone', 'dark') == 'dark' else 'dark'
    elif e['card'] == 'FullBleedCard':
        pr['align'] = 'bottom' if pr.get('align', 'center') == 'center' else 'center'
    else:
        cur = pr.get('theme', 'paper')
        order = ['paper', 'ink', 'blueprint']
        pr['theme'] = order[(order.index(cur) + 1) % 3] if cur in order else 'ink'
    run, last = 1, (e['card'], pr.get('theme', 'paper'), pr.get('align', 'center'))

json.dump(plan, open(f'{P}/scene_plan.json', 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
json.dump(props, open(f'{P}/scene_props.json', 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)

dedupe_media(plan, props, PUB)

json.dump(plan, open(f'{P}/scene_plan.json', 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
json.dump(props, open(f'{P}/scene_props.json', 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)

print(f'수정 반영 {applied}컷')
if missing:
    print('\n없는 자산 — 채워야 함:')
    for m in sorted(missing):
        print('  ', m)
