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
    'popup_space.jpg': 'MTAPhotos / BY 2.0',
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
    'korea.png': '© OpenStreetMap contributors © CARTO',
    'px_seoul_night.jpg': 'Pexels', 'px_seoul_street1.jpg': 'Pexels',
    'px_seoul_street2.jpg': 'Pexels', 'px_seoul_billboard.jpg': 'Pexels',
    'px_seoul_alley.jpg': 'Pexels', 'px_seoul_life.jpg': 'Pexels',
    'px_library.jpg': 'Pexels', 'px_seoul_busy.jpg': 'Pexels',
    'px_seoul_downtown.jpg': 'Pexels', 'px_buildings_night.mp4': 'Pexels',
    'px_street.mp4': 'Pexels', 'px_escalator.mp4': 'Pexels',
    'px_mall_walk.mp4': 'Pexels', 'px_mall_esc2.mp4': 'Pexels',
    'px_mall_interior.mp4': 'Pexels', 'px_mall_bangkok.mp4': 'Pexels',
    'korea_map.png': 'CC0',
    'popup_dior.jpg': 'CC0',
    'popup_exhibit.jpg': 'CC BY-SA 2.0',
    'popup_lv.jpg': 'CC BY 2.0',
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
SEONGSU_ST = (37.545410, 127.053590)
OLIVE_N = (37.543793, 127.054720)
SEOULSUP = (37.543592, 127.044740)
TTUKSEOM = (37.547503, 127.046197)
KRAFTON = (37.540480, 127.056010)

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
R[1] = lt('oliveyoung_store.png', label='낙찰자는 올리브영', scrim=0.5)
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
    'bg': {'backdrop': img('korea.png'), 'veil': 0.74, 'dir': 0, 'blur': 0},
    'source': '오픈애즈 2026.04.03'})
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
           sub='사진은 성수동 카페 거리 — 대상 건물 아님', scrim=0.5)
# #14,15 루이비통·디올·랄프로렌 → 저작권. 팝업 일반 실사로
R[14] = lt('popup_exhibit.jpg', label='브랜드 팝업이 이어졌다', scrim=0.5)
R[15] = lt('popup_lv.jpg', label='루이비통 · 디올 · 지프 · 랄프로렌',
            sub='사진은 브랜드 매장 — 쎈느 팝업 아님', scrim=0.56)
# #16,17 팝업스토어 연상
R[16] = lt('popup_crowd.jpg', label='팝업 성지', scrim=0.5)
R[17] = lt('popup_dior.jpg', label='평범한 건물이 성지가 된 이유', sub='3가지', scrim=0.54)
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
    'theme': 'paper', 'source': '하우징포스트 2025.09'})
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
    'pins': [{'lat': SEONGSU_ST[0], 'lon': SEONGSU_ST[1], 'label': '성수역',
              'sub': '낙찰 부지는 4번 출구 도보 5분 일대'},
             {'lat': OLIVE_N[0], 'lon': OLIVE_N[1], 'label': '올리브영N 성수', 'hot': True}],
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
    'items': [{'w': 3, 'h': 6.5, 'label': '7~8층', 'dim': 'left', 'dimLabel': '층수', 'hot': True}],
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
R[118] = lt('gentlemonster_art.jpg', label='적극 가담하겠다는 신호', scrim=0.52)
R[119] = lt('bl_city_night2.mp4', label='', scrim=0.3)
R[120] = lt('amore_sulwhasoo.jpg', label='뷰티 브랜드의 오프라인 경쟁',
            sub='사진: 설화수 (아모레퍼시픽)', scrim=0.5)
R[121] = lt('bl_installation.mp4', label='올리브영만의 공간 콘텐츠를 만들지', scrim=0.54)
R[122] = lt('seoulforest_deck.jpg', label='이곳이 어떻게 바뀔까',
            sub='지켜보면 방향이 보인다', scrim=0.5)


# ── 소재 중복 감시 ──────────────────────────────────────────────────────
# **같은 영상/사진이 두 번 나오면 안 된다** (검수 지적). 컷을 하나씩 고치면
# 고칠 때마다 다른 데서 또 겹치므로, 배정이 끝난 뒤 **전수로 훑어 강제**한다.
#
# 규칙: 이미 쓴 소재가 또 나오면 → 아직 안 쓴 소재 중에서 고른다.
# 남는 게 없으면 **가장 적게·가장 멀리 떨어져 쓰인 것**을 고른다.
# 종류(영상/사진)는 유지한다 — 사진 자리에 영상이 들어가면 리듬이 깨진다.
def dedupe_media(plan, props, pubdir):
    import collections
    pool_v, pool_i = [], []
    base = os.path.join(pubdir, '올리브영성수')
    for f in sorted(os.listdir(base)):
        if f.startswith(('seongsu.png', 'seongsu_zoom', 'seongsu_buildings')):
            continue
        if f.endswith('.mp4'):
            pool_v.append(f'올리브영성수/{f}')
        elif f.endswith(('.jpg', '.png')):
            pool_i.append(f'올리브영성수/{f}')

    used = collections.Counter()
    lastAt = {}
    swapped = 0
    for idx, sc in enumerate(plan['scenes']):
        e = props['scenes'].get(str(sc['id']))
        if not e or e.get('card') != 'LowerThirdCard':
            continue
        pr = e['props']
        cur = pr.get('media', '')
        if not cur:
            continue
        pool = pool_v if cur.endswith('.mp4') else pool_i
        if used[cur] == 0:
            used[cur] += 1; lastAt[cur] = idx
            continue
        # 중복 — 안 쓴 것 우선, 없으면 가장 적게+가장 오래전에 쓴 것
        fresh = [m for m in pool if used[m] == 0]
        pick = fresh[0] if fresh else min(
            pool, key=lambda m: (used[m], -(idx - lastAt.get(m, -99))))
        pr['media'] = pick
        pr['source'] = cred(os.path.basename(pick))
        used[pick] += 1; lastAt[pick] = idx
        swapped += 1

    dup = [m for m, c in used.items() if c > 1]
    print(f'중복 교체 {swapped}컷 · 남은 중복 {len(dup)}종')
    for m in dup:
        print(f'   {os.path.basename(m)} × {used[m]}')


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
