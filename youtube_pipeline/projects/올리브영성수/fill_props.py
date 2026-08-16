#!/usr/bin/env python3
"""올리브영 성수편 — 장면별 카드·props 확정.

plan_from_script.py 초안은 "도식 불가 → 실사" 로 뭉뚱그린 컷이 대부분이다.
여기서 **어디에 무슨 그래픽이 들어가는지**를 손으로 정한다. 그게 사람의 일이다.

원칙 (출처.md B표):
  - 출처 미확보 수치는 화면에 숫자로 안 띄운다. 내레이션으로만 흘린다
  - 자체 계산·시뮬레이션은 화면에 "추정 / 가정" 을 명시한다
  - 브랜드 로고는 팝업 이력이 확인된 것만. 지금은 **하나도 없으므로 안 쓴다**
"""
import json, os

P = os.path.dirname(os.path.abspath(__file__))
MAP = '올리브영성수/seongsu.png'
MAPZ = '올리브영성수/seongsu_zoom.png'
BOUNDS = [127.011301, 37.525923, 127.093699, 37.562672]
BOUNDSZ = [127.0432, 37.539406, 127.0638, 37.548593]
OSM = '© OpenStreetMap contributors © CARTO'

# CC 자산 → 화면 표기 (qa_check 가 누락을 ERROR 로 잡는다)
CRED = {
    'seongsu_facade.jpg':   'Sgroey / CC BY-SA 4.0',
    'seongsu_alley.jpg':    'Sgroey / CC BY-SA 4.0',
    'seongsu_shops.jpg':    'Sgroey / BY-SA 4.0',
    'popup_window.jpg':     'Herzi Pinki / CC BY-SA 4.0',
    'brand_storefront.jpg': 'Yzen2023 / CC BY 4.0',
    'popup_crowd.jpg':      '玄史生 / CC0',
    'store_queue.jpg':      'Northwest / CC BY-SA 4.0',
    'popup_space.jpg':      'MTAPhotos / BY 2.0',
    'seoul_towers.jpg':     'Ox1997cow / CC BY-SA 4.0',
    'seoulforest_deck.jpg': 'CartoonChess / CC BY-SA 4.0',
    # 진짜 성수동 사진 — 위치 이야기에는 이쪽을 쓴다
    'seongsu_bldg1.jpg':      'CartoonChess / CC BY-SA 4.0',
    'seongsu_industrial.jpg': 'GeonwooLee / CC BY-SA 4.0',
    # 브랜드 큐. **성수 사옥이 아니다** — 캡션에 어디인지 반드시 밝힌다
    'gentlemonster_store.jpg': 'Lstae88 / CC BY-SA 4.0',
    'gentlemonster_art.jpg':   'Tomás Del Coro / CC BY-SA 4.0',
    'musinsa_popup.jpg':       'K-POPIT / CC BY 3.0',
    'amore_sulwhasoo.jpg':     'KOREA.NET / BY-SA 2.0',
    # 배경 영상
    'auction_columns.mp4':    'Mixkit Free License',
    'contract_signature.mp4': 'Mixkit Free License',
    'money_counter.mp4':      'Mixkit Free License',
    'cash_closeup.mp4':       'Mixkit Free License',
}
def img(name):  return f'올리브영성수/{name}'
def cred(name): return CRED[name]

# 카드 뒤에 깔리는 배경. veil 로 눌러 질감으로만 쓴다 (§32-5).
# 영상은 스스로 움직이므로 **내용이 움직여야 하는 구간에만** 쓴다 —
# 아무 데나 깔면 그래픽이 안 읽힌다.
def bg(name, veil=0.9, dir=0, blur=0):
    return {'backdrop': img(name), 'veil': veil, 'dir': dir, 'blur': blur}

# veil 은 사진 기준(0.90)보다 **더 세게** 눌러야 한다. 영상은 움직이기 때문에
# 같은 불투명도라도 눈이 훨씬 더 잡아챈다 — 0.90 으로 두니 배경 인물이
# 수치와 경쟁했다. blur 를 살짝 걸어 형체만 남기면 "질감"으로 내려앉는다.
BG_AUCTION  = bg('auction_columns.mp4', veil=0.945, blur=4)
BG_CONTRACT = bg('contract_signature.mp4', veil=0.945, blur=3)
BG_MONEY    = bg('money_counter.mp4', veil=0.94, blur=4)
BG_CASH     = bg('cash_closeup.mp4', veil=0.945, blur=4)

# 검증된 좌표만 쓴다 (fetch_map.py --find · OSM Nominatim).
# 낙찰 부지의 정확한 필지는 공개 보도에 없다 — "성수역 4번 출구 도보 5분" 이 전부다.
# 그래서 **핀을 찍지 않고 역과 거리로 범위를 말한다.** (§34-4 에서 배운 것)
SEONGSU_ST = (37.545410, 127.053590)
OLIVE_N    = (37.543793, 127.054720)   # 연무장7길 — 팩토리얼 성수가 있는 길
SEOULSUP   = (37.543592, 127.044740)
TTUKSEOM   = (37.547503, 127.046197)
KRAFTON    = (37.540480, 127.056010)   # 성수동2가 333-16 (동 중심점 — 필지 아님)

def full(name, headline, sub=''):
    return ('FullBleedCard', {'image': img(name), 'headline': headline, 'sub': sub,
                              'scrim': 0.44, 'source': cred(name)})

def photo(name, title, sub='', caption=''):
    return ('PaperImageCard', {'title': title, 'sub': sub, 'image': img(name),
                               'caption': caption, 'source': cred(name)})

def stats(title, sub, items, source='', theme=None, align='center', back=None):
    p = {'title': title, 'sub': sub, 'items': items, 'source': source, 'align': align}
    if theme: p['theme'] = theme
    if back: p['bg'] = back
    return ('BigStatsCard', p)

# ── 장면별 확정 ─────────────────────────────────────────────────────────
S = {}

# ══ 훅 ══
S[0]  = full('seongsu_industrial.jpg', '2026년 7월, 성수동', '경매 한 건')
S[2]  = stats('낙찰가', '2026년 7월 · 서울동부지법', [
    {'display': '약 541', 'unit': '억', 'label': '낙찰가', 'hot': True}],
    source='블로터 2026.07.22', theme='ink', back=BG_MONEY)
S[3]  = ('StrikeSwapCard', {
    'title': '감정가와 낙찰가', 'sub': '단독 입찰인데 값이 올라갔다',
    'from': '약 396억', 'fromLabel': '감정가',
    'to': '약 541억', 'toLabel': '낙찰가',
    'note': '보도된 자릿수까지만 표기', 'source': '블로터 2026.07.22',
    'theme': 'ink', 'bg': BG_CASH})
S[4]  = stats('차액', '감정가 대비', [
    {'display': '+145', 'unit': '억', 'label': '더 썼다', 'hot': True},
    {'display': '137', 'unit': '%', 'label': '낙찰가율'}],
    source='블로터 2026.07.22 · 비율은 자체 계산', back=BG_CASH)
S[5]  = stats('대지 197평', '약 650㎡', [
    {'display': '197', 'unit': '평', 'label': '대지면적'},
    {'display': '2.75', 'unit': '억/평', 'label': '평당가 · 자체 계산', 'hot': True}],
    source='블로터 2026.07.22 · 평당가는 낙찰가÷면적')
S[6]  = ('TrackRecordCard', {
    'title': '이상한 점 세 가지', 'sub': '',
    'items': [{'label': '경쟁자가 없었다', 'note': '단독 입찰'},
              {'label': '건물을 사는 회사가 아니다', 'note': '매장은 임차'},
              {'label': '성수에 이미 6곳이 있다', 'note': '한 상권에'}],
    'source': '블로터 2026.07.22 · ZDNet 2025.11.17'})
S[8]  = stats('단독 입찰', '경쟁자가 없는데 감정가를 넘겼다', [
    {'display': '1', 'unit': '곳', 'label': '입찰 참여'},
    {'display': '137', 'unit': '%', 'label': '감정가 대비', 'hot': True}],
    source='블로터 2026.07.22', theme='ink', back=BG_AUCTION)
S[10] = stats('매장은 빌린다', '2025년 4분기 기준', [
    {'display': '1,381', 'unit': '개', 'label': '전국 매장'},
    {'display': '1,166', 'unit': '개', 'label': '이 중 직영'}],
    source='오픈애즈 2026.04.03')
S[11] = ('MapCard', {
    'image': MAP, 'bounds': BOUNDS,
    'title': '성수 상권', 'sub': '올리브영 매장 6곳이 몰려 있다',
    'pins': [{'lat': SEONGSU_ST[0], 'lon': SEONGSU_ST[1], 'label': '성수역'},
             {'lat': OLIVE_N[0], 'lon': OLIVE_N[1], 'label': '올리브영N 성수', 'hot': True},
             {'lat': SEOULSUP[0], 'lon': SEOULSUP[1], 'label': '서울숲'}],
    'align': 'left', 'source': OSM + ' · 매장 수 ZDNet 2025.11.17'})
S[13] = photo('seongsu_bldg1.jpg', '2층 · 넓은 주차장',
              '성수역 4번 출구 도보 5분', '사진: 성수동 일대 — 대상 건물 아님')
S[14] = full('popup_crowd.jpg', '팝업스토어 장소로 계속 쓰였다')

# ══ 파사드 ══
S[17] = full('popup_window.jpg', '팝업 성지가 된 이유', '세 가지')
S[22] = ('FrontageCard', {
    'title': '같은 면적, 다른 얼굴', 'sub': '도로에 닿는 변이 곧 광고판이 된다',
    'options': [{'label': '정사각형 4×4', 'w': 4, 'd': 4, 'note': '광고판 폭 4'},
                {'label': '직사각형 8×2', 'w': 8, 'd': 2, 'note': '광고판 폭 8 — 두 배',
                 'hot': True}],
    'floors': 2, 'note': '면적은 같지만 길에서 보이는 면은 두 배가 된다',
    'theme': 'paper', 'source': '도해'})
S[24] = full('seongsu_shops.jpg', '사람 시선에 더 들어온다')
S[28] = photo('popup_window.jpg', '파사드는 연출 면적이다',
              '래핑 · 구조물 · 조명', '')
S[31] = full('popup_crowd.jpg', '여러 앵글에서 찍히게 만든다')

# ══ 내부 레이아웃 ══
S[33] = ('LayerPeelCard', {
    'title': '1층과 2층이 뚫려 있다', 'sub': '한 층만 쓸 수도, 두 층을 통으로 쓸 수도',
    'layers': [{'h': 1.15, 'label': '1층', 'note': '진입 · 메인 연출'},
               {'h': 1.0, 'label': '2층', 'note': '보이드로 아래와 연결', 'hot': True}],
    'lift': 0.6, 'spin': 14, 'theme': 'ink',
    'note': '보이드가 있으면 두 층을 하나의 공간으로 쓸 수 있다',
    'disclaimer': '도해 — 실제 치수와 다를 수 있음', 'source': '도해'})
S[39] = ('SectionDiagramCard', {
    'title': '층고가 낮으면 못 하는 것', 'sub': '조형물 · 상부 조명 · 대형 영상',
    'ground': [[0, 0], [40, 0]], 'cut': [[0, 0], [0, -3.2], [40, -3.2], [40, 0]],
    'bands': [{'from': -3.2, 'to': 0, 'label': '낮은 층고'}],
    'marks': [{'x': 20, 'y': -1.6, 'label': '조형물이 안 선다'}],
    'unit': 'm', 'theme': 'blueprint',
    'note': '층고는 브랜드가 할 수 있는 연출의 상한을 정한다',
    'disclaimer': '개념 도해 — 실제 치수 아님', 'source': '도해'})
S[41] = ('LayerPeelCard', {
    'title': '열려 있으면 달라진다', 'sub': '1층에 들어선 순간 2층까지 보인다',
    'layers': [{'h': 1.6, 'label': '보이드', 'note': '위아래가 한 공간', 'hot': True},
               {'h': 0.9, 'label': '2층 바닥'}],
    'lift': 0.5, 'spin': 16, 'tilt': 0.38, 'theme': 'ink',
    'note': '공간이 실제 면적보다 커 보이고, 위층으로 올라가고 싶어진다',
    'disclaimer': '도해 — 실제 치수와 다를 수 있음', 'source': '도해'})
S[45] = ('FrontageCard', {
    'title': '기둥이 정하는 자유도', 'sub': '기둥이 적을수록 벽을 마음대로 세운다',
    'options': [{'label': '기둥 많음', 'w': 6, 'd': 3, 'note': '잘게 나뉜다'},
                {'label': '기둥 적음', 'w': 6, 'd': 3, 'note': '통으로 쓴다', 'hot': True}],
    'floors': 1, 'note': '같은 바닥이라도 기둥이 동선을 먼저 정해 버린다',
    'theme': 'paper', 'source': '도해'})

# ══ 마당 ══
S[49] = full('store_queue.jpg', '대기 줄은 반드시 생긴다', '마당이 그걸 받는다')
S[51] = photo('brand_storefront.jpg', '마당은 파사드의 거리다',
              '주변 간섭 없이 얼굴을 보여 준다', '')
S[53] = full('popup_space.jpg', '내로라하는 브랜드들이 여기서 팝업을 했다')
S[56] = photo('popup_crowd.jpg', '돈 한 푼 안 들인 오프라인 테스트',
              '가능성을 이미 눈으로 봤다', '')

# ══ 경매 ══
S[58] = full('seongsu_industrial.jpg', '경매 = 싸게 사는 것?', '이건 그게 아니었다')
S[61] = ('ShareSplitCard', {
    'title': '공유물분할 경매', 'sub': '나눌 수 없으니 통째로 판다',
    'n': 19, 'ownerLabel': '지분권자',
    'cutLabel': '땅은 반으로 못 자른다', 'bidLabel': '법원 경매 · 공개 입찰',
    'cutAt': 40, 'bidAt': 86,
    'note': '인근 신도리코 부지가 실제로 이 과정을 거쳤다',
    'theme': 'paper', 'bg': BG_AUCTION,
    'source': '민법 제269조 · 하우징포스트 2025.09'})
S[66] = ('TrackRecordCard', {
    'title': '소송이 걸리면 두 가지가 확정된다', 'sub': '',
    'items': [{'label': '매각은 무조건 진행된다', 'note': '합의 불필요'},
              {'label': '방식은 공개 입찰이다', 'note': '가격은 시장이 정한다', 'hot': True}],
    'theme': 'ink', 'bg': BG_CONTRACT,
    'source': '민법 제269조 · 민사집행법상 형식적 경매'})
S[70] = ('ArticleCard', {
    'outlet': '하우징포스트', 'date': '2025.09',
    'body': '서울동부지방법원에서 진행된 성수동 공장 대지 경매에서 '
            '«신도리코가 2,202억 100만원에 단독 응찰해 낙찰»받았다. '
            '해당 부지는 «소유자 19명의 공유물분할 소송» 끝에 경매로 나온 물건으로, '
            '국내 경매 역사상 최고가를 기록했다.',
    'serif': True, 'theme': 'ink', 'source': '하우징포스트 2025.09'})
S[72] = stats('인근 사례', '2025.8.25 · 서울동부지법 · 4,272㎡', [
    {'display': '2,202', 'unit': '억', 'label': '신도리코 낙찰가', 'hot': True},
    {'display': '19', 'unit': '명', 'label': '공유 소유자'}],
    source='하우징포스트 2025.09', theme='ink', back=BG_AUCTION)
S[73] = stats('싸게 사려던 게 아니다', '반드시 받으려고 웃돈을 썼다', [
    {'display': '137', 'unit': '%', 'label': '감정가 대비 낙찰가', 'hot': True}],
    source='블로터 2026.07.22 · 비율은 자체 계산', back=BG_MONEY)

# ══ 성수 올리브영 ══
S[77] = stats('성수 상권 올리브영', 'K뷰티 관광 코스가 된 동네', [
    {'display': '6', 'unit': '곳', 'label': '한 상권 안에', 'hot': True}],
    source='ZDNet 2025.11.17')
S[79] = ('MapCard', {
    'image': MAPZ, 'bounds': BOUNDSZ,
    'title': '걸어서 2분', 'sub': '낙찰 부지 바로 옆에 올리브영N 성수',
    'pins': [{'lat': SEONGSU_ST[0], 'lon': SEONGSU_ST[1], 'label': '성수역',
              'sub': '낙찰 부지는 4번 출구 도보 5분 일대'},
             {'lat': OLIVE_N[0], 'lon': OLIVE_N[1], 'label': '올리브영N 성수',
              'sub': '팩토리얼 성수 1~5층', 'hot': True}],
    'align': 'left', 'source': OSM + ' · 위치 블로터 2026.07.22'})
S[80] = stats('올리브영N 성수', '팩토리얼 성수 지상 1~5층', [
    {'display': '1,400', 'unit': '평', 'label': '약 4,628㎡', 'hot': True},
    {'display': '5', 'unit': '개 층', 'label': '1층부터 5층까지'}],
    source='한국경제 2024.11.21')
S[81] = stats('개점 1년', '전국 매장 중 내국인 방문 1위', [
    {'display': '250', 'unit': '만명', 'label': '누적 방문객', 'hot': True}],
    source='CJ올리브영 2025.11.17 · ZDNet 2025.11.17')
S[85] = ('StrikeSwapCard', {
    'title': '그 건물의 주인이 바뀐다', 'sub': '2025년 12월 24일',
    'from': '이지스자산운용', 'fromLabel': '기존 소유',
    'to': '교보AIM자산운용', 'toLabel': '2,548억에 인수',
    'note': '연면적 3.3㎡당 4,000만원 — 성수동 오피스 최고가',
    'theme': 'ink', 'bg': BG_CONTRACT, 'source': '비즈워치 2026.01.14'})
S[86] = stats('성수동 오피스 최고가', '연면적 기준', [
    {'display': '2,548', 'unit': '억', 'label': '거래가'},
    {'display': '4,000', 'unit': '만원/평', 'label': '연면적 평당', 'hot': True}],
    source='비즈워치 2026.01.14', back=BG_MONEY)
S[90] = photo('seoul_towers.jpg', '임대료는 올라갈 가능성이 있다',
              '매수자는 수익률을 더 끌어올리려 한다', '화자 판단 — 추정')

# ══ 사업성 ══
S[94] = stats('취득 총액 (추정)', '취득세 4.6% 등 가산 — 자체 계산', [
    {'display': '541', 'unit': '억', 'label': '낙찰가'},
    {'display': '약 570', 'unit': '억', 'label': '취득세 포함 추정', 'hot': True}],
    source='취득세율 적용 자체 계산 — 추정치', theme='ink', back=BG_CASH)
S[99] = stats('오피스로 지으면 (가정)', '용적률 400~500% 가정 · 실제 지구단위계획 미반영', [
    {'display': '7~8', 'unit': '층', 'label': '층수'},
    {'display': '985', 'unit': '평', 'label': '최대 연면적', 'hot': True}],
    source='자체 시뮬레이션 — 가정값')
S[101] = ('MassingCard', {
    'data': '올리브영성수/seongsu_buildings.json',
    'title': '어떤 동네에 서게 되나', 'sub': '성수 일대 실제 건물 발자국',
    'spin': 18, 'tilt': 0.40, 'theme': 'ink',
    'note': '대지가 200평이 채 안 돼 자주식 주차도 쉽지 않다',
    'source': '© OpenStreetMap contributors'})
S[105] = full('popup_space.jpg', '검증은 이미 옆에서 끝났다')
S[107] = photo('popup_crowd.jpg', '매장보다는 놀이터 · 테스트베드',
               '화자 해석 — 활용 계획은 미확정', '올리브영: "구체적 활용 계획 미확정"')

# ══ 결론 ══
S[112] = ('MapCard', {
    'image': MAP, 'bounds': BOUNDS,
    'title': '성수동을 사들이는 브랜드들', 'sub': '크래프톤 · 무신사 · 젠틀몬스터',
    'pins': [{'lat': KRAFTON[0], 'lon': KRAFTON[1], 'label': '크래프톤 사옥',
              'sub': '데이비드 치퍼필드 설계 · 2028 준공', 'hot': True},
             {'lat': SEONGSU_ST[0], 'lon': SEONGSU_ST[1], 'label': '성수역'},
             {'lat': TTUKSEOM[0], 'lon': TTUKSEOM[1], 'label': '뚝섬역'}],
    'align': 'left', 'source': OSM + ' · 이데일리 마켓in'})
S[117] = ('TrackRecordCard', {
    'title': '브랜드마다 전략이 다르다', 'sub': '',
    'name': '성수동', 'role': '브랜드 부동산 격전지',
    'items': [{'label': '크래프톤', 'note': '옛 이마트 부지 · 사옥 신축'},
              {'label': '무신사', 'note': '캠퍼스 · 평당 3,500만원 거래'},
              {'label': '젠틀몬스터', 'note': '성수동 사옥'},
              {'label': '올리브영', 'note': '541억 토지 낙찰', 'hot': True}],
    'source': '비즈워치 2026.01.14 · 이데일리 마켓in'})
S[114] = photo('musinsa_popup.jpg', '무신사', '성수동 투자로 유명하다',
               '사진: 무신사 뷰티 페스타 팝업 — 성수 사옥 아님')
S[116] = photo('gentlemonster_store.jpg', '젠틀몬스터', '아이코닉한 공간으로 이슈를 만들었다',
               '사진: 젠틀몬스터 매장(해외) — 성수 사옥 아님')
S[120] = photo('amore_sulwhasoo.jpg', '뷰티 브랜드의 오프라인 경쟁',
               '공간이 곧 광고판이 된다', '사진: 설화수 제품 (아모레퍼시픽)')
S[121] = full('gentlemonster_art.jpg', '올리브영만의 공간 콘텐츠를 만들지')
S[122] = full('seoulforest_deck.jpg', '이곳이 어떻게 바뀔까', '지켜보면 방향이 보인다')

# ── 반영 ────────────────────────────────────────────────────────────────
plan = json.load(open(f'{P}/scene_plan.json', encoding='utf-8'))
props = json.load(open(f'{P}/scene_props.json', encoding='utf-8'))
by_id = {s['id']: s for s in plan['scenes']}

# 나머지 컷은 실사로 돌린다 — 실사 비중 45% 목표(§34-1). 사진을 돌려 쓰되
# **연속 두 컷이 같은 사진이면 안 된다** (§29: 반복은 카드 수가 아니라 바탕이 만든다)
# 사진 수가 곧 화면이 바뀌는 횟수다. 14장을 서로 다른 순서로 돌린다 —
# 목록 길이와 컷 수가 서로소에 가까워야 같은 자리에서 같은 사진이 안 돈다
ROTATE = ['seongsu_alley.jpg', 'popup_window.jpg', 'seongsu_bldg1.jpg',
          'brand_storefront.jpg', 'popup_crowd.jpg', 'seongsu_facade.jpg',
          'store_queue.jpg', 'seongsu_industrial.jpg', 'popup_space.jpg',
          'gentlemonster_art.jpg', 'seoul_towers.jpg', 'seongsu_shops.jpg',
          'musinsa_popup.jpg', 'seoulforest_deck.jpg']
THEMES = ['paper', 'ink', 'paper', 'blueprint']

# 챕터 제목 — 자동으로 안 짓는다. 설명문 목차에 그대로 나가므로 손으로 쓴다
CHAPTERS = ['541억, 단독 입찰', '팝업 성지가 된 건물', '층고와 보이드',
            '마당이 하는 일', '왜 경매였나', '성수의 올리브영',
            '570억을 회수하려면', '성수동을 사들이는 브랜드들']

changed = 0
for sid, (card, pr) in S.items():
    key = str(sid)
    if sid not in by_id:
        raise SystemExit(f'장면 {sid} 없음 — 스크립트가 바뀌었나?')
    by_id[sid]['card'] = card
    entry = props['scenes'].setdefault(key, {})
    entry['card'] = card
    entry['props'] = pr
    changed += 1

# 확정 안 한 장면은 전부 실사. 카드가 그대로면 이미지만 채운다
prev = None
for i, s in enumerate(plan['scenes']):
    sid = s['id']
    if sid in S:
        prev = None
        continue
    name = ROTATE[i % len(ROTATE)]
    if name == prev:                      # 같은 사진 연속 금지
        name = ROTATE[(i + 3) % len(ROTATE)]
    prev = name
    card = 'FullBleedCard' if i % 2 else 'PaperImageCard'
    s['card'] = card
    e = props['scenes'].setdefault(str(sid), {})
    e['card'] = card
    if card == 'FullBleedCard':
        e['props'] = {'image': img(name), 'headline': '', 'sub': '',
                      'scrim': 0.40, 'source': cred(name)}
    else:
        # 같은 카드가 이어질 때 **바탕과 정렬로** 껍데기를 바꾼다 (§29).
        # 카드 종류를 더 늘리는 건 답이 아니다 — 화면이 지루한 건 문법 수가
        # 아니라 바탕이 안 바뀌어서다
        e['props'] = {'title': '', 'sub': '', 'image': img(name),
                      'caption': '', 'source': cred(name),
                      'theme': THEMES[i % len(THEMES)],
                      'align': 'left' if (i // 2) % 2 else 'center'}

for ch, name in zip(plan.get('chapters', []), CHAPTERS):
    ch['name'] = name

# ── 실사 b-roll 원본 배정 ───────────────────────────────────────────────
# plan_from_script.py 는 broll.src 를 'TODO.mp4' 로 남긴다 — 여기서 실제 파일을 꽂는다.
# **주제에 맞는 통(pool)을 나눠서** 돌린다. 하나로 다 돌리면 경매 이야기에
# 쇼핑 영상이 걸리는 식으로 화면과 말이 어긋난다.
POOL_MONEY  = ['auction_columns.mp4', 'contract_signature.mp4',
               'money_counter.mp4', 'cash_closeup.mp4']
POOL_RETAIL = ['bl_retail_aisle.mp4', 'bl_retail_browse.mp4',
               'bl_retail_walk.mp4', 'bl_retail_pick.mp4']
POOL_CITY   = ['bl_seoul_gate.mp4', 'bl_seoul_aerial.mp4', 'bl_seoul_stream.mp4',
               'bl_seoul_night.mp4', 'bl_towers.mp4', 'bl_office_dusk.mp4']
POOL_STREET = ['bl_street_people.mp4', 'bl_street_walk.mp4',
               'bl_street_evening.mp4', 'bl_street_topdown.mp4']

# 장면 번호 구간 → 어떤 통을 쓸지. 이야기 흐름에 맞춘다
def pool_for(sid):
    if 57 <= sid <= 75:   return POOL_MONEY     # 경매·낙찰
    if 84 <= sid <= 101:  return POOL_MONEY     # 매각·사업성
    if 9 <= sid <= 16:    return POOL_RETAIL    # 매장·팝업
    if 47 <= sid <= 56:   return POOL_RETAIL    # 대기줄·팝업
    if 76 <= sid <= 83:   return POOL_RETAIL    # 올리브영N
    if 17 <= sid <= 46:   return POOL_STREET    # 파사드·거리
    return POOL_CITY                            # 도입·결론

FOOT = os.path.join(P, 'footage')
avail = set(os.listdir(FOOT)) if os.path.isdir(FOOT) else set()
missing, prev = set(), None
for i, s in enumerate(plan['scenes']):
    b = s.get('broll')
    if not b:
        continue
    pool = [f for f in pool_for(s['id']) if f in avail] or \
           [f for f in POOL_CITY if f in avail]
    if not pool:
        missing |= set(pool_for(s['id']))
        continue
    pick = pool[i % len(pool)]
    if pick == prev and len(pool) > 1:          # 같은 원본 연속 금지
        pick = pool[(i + 1) % len(pool)]
    prev = pick
    b['src'] = pick
    # 같은 원본이라도 **다른 지점**을 쓴다. 매번 0초부터면 같은 그림이 반복된다
    b['ss'] = round(1.0 + (i % 5) * 1.7, 2)

# ── 껍데기 연속 끊기 ────────────────────────────────────────────────────
# (카드 + 바탕 + 정렬) 이 3컷 이어지면 화면이 멎은 것처럼 보인다 (§29).
# 카드를 바꾸는 게 아니라 **껍데기만** 돌린다 — 내용은 그대로 두는 게 핵심이다.
# 손으로 훑으면 반드시 빠뜨리므로 규칙으로 돌린다 (SYSTEM.md §7-2 4번).
FLIP_THEME = ['paper', 'ink', 'blueprint']
run, last = 0, None
for s in plan['scenes']:
    # qa_check 와 **같은 기준으로** 센다. 카드가 안 나오는 컷(cardDur 0)은
    # 화면에 안 뜨므로 연속 판정에서 빠진다 — 여기서 기준이 어긋나면
    # 고쳤는데도 경고가 그대로 남는다 (실제로 한 번 겪음)
    if s.get('cardDur', s['dur']) <= 0:
        continue
    e = props['scenes'][str(s['id'])]
    pr = e['props']
    combo = (e['card'], pr.get('theme', 'paper'), pr.get('align', 'center'))
    if combo == last:
        run += 1
    else:
        run, last = 1, combo
    if run < 3:
        continue
    if e['card'] == 'FullBleedCard':          # 테마가 없는 카드는 정렬로 끊는다
        pr['align'] = 'bottom' if pr.get('align', 'center') == 'center' else 'center'
    else:
        cur = pr.get('theme', 'paper')
        pr['theme'] = FLIP_THEME[(FLIP_THEME.index(cur) + 1) % len(FLIP_THEME)] \
            if cur in FLIP_THEME else 'ink'
    run, last = 1, (e['card'], pr.get('theme', 'paper'), pr.get('align', 'center'))

json.dump(plan, open(f'{P}/scene_plan.json', 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
json.dump(props, open(f'{P}/scene_props.json', 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)

live = sum(1 for s in plan['scenes'] if s['card'] in ('FullBleedCard', 'PaperImageCard'))
print(f'그래픽 확정 {changed}컷 · 실사 {live}컷 / 전체 {len(plan["scenes"])}컷 '
      f'({live / len(plan["scenes"]) * 100:.0f}%)')
