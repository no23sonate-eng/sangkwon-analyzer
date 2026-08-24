#!/usr/bin/env python3
"""스크립트(txt/md) → scene_plan.json + scene_props.json 초안.

지금까지 두 영상 모두 장면 분할·타이밍·카드 선택을 손으로 했다. 그 첫 8할을
자동으로 깔아 두고, 사람은 **고르고 다듬기만** 하게 만든다.

하는 일
  1) 문단(빈 줄) → 섹션, 문장 묶음 → 장면
  2) 낭독 길이 추정: 한글 5.3자/초 (숫자·영문은 읽는 시간이 길어 가중)
  3) 리텐션 규칙 적용 — 15초 넘는 장면은 자동으로 [카드 + 실사] 로 쪼개고,
     첫 30초에 컷이 3개 미만이면 앞쪽을 더 잘게 나눈다
  4) 문장을 읽어 **카드 종류를 추천** (숫자 비교/연도/대립/사진…)
  5) scene_props.json 은 추천 카드의 빈 껍데기까지 만들어 준다

    python3 youtube_pipeline/scripts/plan_from_script.py 스크립트.md --project 새프로젝트
    python3 youtube_pipeline/scripts/plan_from_script.py 스크립트.md --project X --dry

주의: 초안이다. 수치·라벨은 채워야 하고 카드 추천은 틀릴 수 있다.
      만든 뒤 반드시 `qa_check.py` 를 돌린다.
"""
import argparse, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 낭독 속도 (자/초). 파크사이드 확정 타이밍(443.5초)에 맞춰 역산한 값 —
# 5.3 으로 두면 4% 길게 나온다. 새 영상에서 어긋나면 여기만 고친다.
CPS = 5.53
GAP = 0.4            # 문단(섹션)이 바뀔 때의 호흡
GAP_IN = 0.15        # 같은 문단 안에서 장면만 나뉠 때 — 여기서 0.4 를 주면
                     # 한 문단을 읽다 말고 쉬는 꼴이 되고 전체 길이가 부풀어 오른다
# ── 컷 밀도 ──────────────────────────────────────────────────────────────
# 파크사이드 1편은 평균 10.0초였다. 설명 영상이라도 화면이 그렇게 오래 안 바뀌면
# 늘어진다. 목표를 **평균 5초 안팎**으로 내리고, 문장뿐 아니라 **절(쉼표)** 에서도
# 끊는다. 내레이션은 그대로 두고 화면만 더 자주 바뀌게 하는 게 요점이다.
MAX_CUT = 10.0       # 한 컷 최대 (넘으면 실사로 쪼갠다)
SPLIT_AT = 6.0       # 이 길이를 넘기면 문장 경계에서 나눈다
CLAUSE_AT = 6.5      # 한 문장이 이보다 길면 **쉼표에서도** 나눈다
MIN_CUT = 1.8        # 이보다 짧은 조각만 앞에 붙인다.
                     # 2초짜리 마무리 절("전면 경영제휴입니다")은 오히려 리듬을 만든다 —
                     # 여기를 2.2 로 두면 그런 절이 앞 컷에 붙어 7초짜리가 된다
OPENING_SEC = 30.0
OPENING_MIN_CUTS = 3

# ── 실사 비중 (design_reference §34) ─────────────────────────────────────
# B1M 내부 프레임 780장을 분류해 보니 **실사가 75~90%** 다 (판정 임계에 따라).
# 내 결과물은 정반대였다 — 파크사이드 21% · 갤러리 35% · 첫 샘플 4%.
# 도표가 주인공이면 "설명 슬라이드"가 되고, 실사가 주인공이어야 "다큐"가 된다.
#
# 그래서 경고만 하지 않고 **기본값을 바꾼다.** 도식이 안 나오는 문장은
# 어차피 종이 카드로 때우던 것이라, 그걸 실사로 넘기면 비중이 올라간다.
# 45%는 B1M 에 한참 못 미치지만, CC 소재만 쓰는 조건에서 현실적인 첫 목표다.
LIVE_TARGET = 0.45

# ── 챕터 (design_reference §31-3) ────────────────────────────────────────
# B1M 챕터 117편 실측: 중앙 8개 · 각 90초 · Intro 65초.
# 지금까지 이 플래너는 **문단을 그대로 act** 로 썼다. 파크사이드는 13섹션 450초라
# 섹션당 35초 — 너무 잘다. 시청자가 "지금 어디쯤인지" 를 못 잡는다.
# 문단은 그대로 두고, 그 위에 90초짜리 챕터를 한 겹 얹는다.
CHAPTER_SEC = 90.0       # 목표 챕터 길이
CHAPTER_MIN = 48.0       # p10. 이보다 짧으면 다음 챕터에 붙인다
CHAPTER_MAX = 237.0      # p90. 이보다 길면 문단 경계에서 쪼갠다
INTRO_SEC = 65.0         # 첫 챕터는 훅. 여기에 1분을 쓴다

# ── 카드 추천 규칙 ───────────────────────────────────────────────────────
# (정규식, 카드, 왜) — 위에서부터 먼저 맞는 것을 쓴다. 구체적인 규칙이 위로.
# 구체적인 규칙이 위. 아래로 갈수록 느슨하다.
# 연도는 이 장르 스크립트에 늘 깔려 있어서, 단순 날짜 언급으로 타임라인이
# 잡히지 않도록 "기간을 말하는 단어"를 같이 요구한다.
# ── 줄글 → 화면 문법 (design_reference §30-2) ──────────────────────────
# "말로 설명하고 화면엔 글자만" 이 제일 나쁘다. 문장이 하는 말의 유형마다
# 갈 곳이 정해져 있고, 위에서부터 먼저 걸리는 게 이긴다 —
# **구체적인 규칙일수록 위에** 둔다.
COMPANY = r'[가-힣A-Za-z][가-힣A-Za-z0-9&·\'\-]{1,14}' \
          r'(?:앤파트너스|파트너스|아키텍츠|건설|산업|중공업|그룹|백화점|물산|개발|' \
          r'엔지니어링|디자인|스튜디오|자산운용|증권|은행|공사|공단|재단|사|社)'

RULES = [
    # ── §40 구조·설명 규칙 (2026-08-22 추가) ─────────────────────────────
    # 이 아래 기존 규칙들보다 **먼저** 걸려야 한다. 기존 규칙은 숫자만 보면
    # BigStatsCard 로 보내 버려서, "층고가 낮으면 조형물을 못 세운다" 같은
    # 구조 문장까지 큰 숫자 카드로 갔다. 구조 문장은 숫자가 결론이 아니다.

    # 크기·높이 때문에 **못 하는 것**이 있다 → 단면에 물건을 넣어 본다
    (r'((층고|천장|높이|폭|깊이)[^.]{0,30}(낮|좁|짧|모자라|안 되|안되|못|어렵|한계)|'
     r'(못|안)\s*(세우|넣|들어가|올리|걸)|들어가지\s*(않|못)|'
     r'(뚫려|열려|보이드|오픈)[^.]{0,20}(있|되어))',
     'SectionScaleCard', '크기 때문에 못 하는 것 = 단면에 넣어 보기'),

    # 전체가 **무엇에 먹히는가** → 면적을 떼어 낸다
    (r'((대지|면적|평|㎡)[^.]{0,40}(때문에|이라|라서|밖에|채 안|부족|쉽지 않)|'
     r'(주차|코어|램프|공용부|설비)[^.]{0,30}(차지|먹|빼면|제외하면)|'
     r'남는\s*(면적|자리|공간))',
     'AreaBudgetCard', '면적이 무엇에 먹히나 = 떼어 내기'),

    # 지분을 여럿이 나눠 갖는다 → 나눌 수 없다는 그림
    (r'(지분|공유물|공유자|소유자\s*\d+\s*명|나눠\s*(갖|가지)|분할)',
     'ShareSplitCard', '지분 분할'),

    # 원인 → 결과 사슬
    (r'((바뀌|오르|늘|줄)면[^.]{0,40}(오르|늘|줄|바뀌|생기|개선)|'
     r'그러면[^.]{0,30}(되고|지고|집니다)|'
     r'(때문에|덕분에|결과)[^.]{0,30}(다시|또|이어)|연쇄|이어집니다)',
     'YFlowCard', '원인 → 결과 사슬'),

    # 둘 중 **하나를 고른다**
    (r'((둘 중|어느 쪽|택할|고를|갈림길|갈래)|'
     r'(할지|갈지|만들지|살지|팔지)[^.]{0,20}(,|아니면|선택|고민))',
     'ForkPathCard', '택일 = 갈림길'),

    # **둘 다** 동시에
    (r'((동시에|양쪽 다|둘 다|뿐 아니라|물론이고)[^.]{0,40}(도|까지)|'
     r'두 가지[^.]{0,20}(모두|동시))',
     'TwoPanelCard', '둘 다 = 좌우 판'),

    # 자료(사진·조감도·도면)를 **보여 준다**
    (r'(조감도|투시도|렌더링|설계안|공식 이미지|자료 사진|'
     r'(사례|예를 들면|처럼)[^.]{0,30}(있|합니다|입니다))',
     'MediaPlateCard', '자료를 판 위에 얹기'),

    # 건물들을 **형상으로** 견준다
    (r'((\d[\d,.]*)\s*(m|미터|층)[^.]{0,60}(\d[\d,.]*)\s*(m|미터|층)[^.]{0,40}'
     r'(건물|사옥|타워|빌딩))',
     'SilhouetteCompareCard', '건물 여럿 = 실루엣 비교'),

    # 안(案)·장(章)의 이름을 부른다
    (r'((첫 번째|두 번째|세 번째)\s*(방법|방향|안|선택지)|'
     r'(방법|방향|안)\s*(하나|둘|셋|1|2|3)\b)',
     'PlanTitleCard', '안의 이름 = 거친 박스 제목'),

    # 회사·브랜드가 처음 나오며 무슨 역할을 했다 → 로고를 박는다 (§30-1)
    (rf'({COMPANY}|[A-Z]{{2,}})[가이는을를과와]?\s*[^.]{{0,30}}'
     r'(맡았|참여했|담당했|설계했|시공|짓고|짓는|체결|제휴|손잡|합작)', 'BrandCard', '회사 등장 = 로고'),
    # 그 회사가 뭘 해왔나 — 레퍼런스 나열
    (r'(해온 회사|한 회사입니다|작업한|대표작|레퍼런스|시공한 (곳|현장)|'
     r'실적|포트폴리오|[^.]{0,40}(,\s*[^.,]{2,20}){2,}\s*을?\s*(해온|맡아온|지은))',
     'TrackRecordCard', '회사 이력 = 도장 찍기'),
    # 기사·보도자료를 인용한다 → 원문 판 위에 형광펜 (§32-1)
    (r'(\(([^)]*(경제|일보|신문|뉴스|타임스|저널|통신|방송)[^)]*)\)|'
     r'[가-힣A-Za-z]{2,10}(경제|일보|신문|뉴스|타임스)[^.]{0,20}(보도|따르면|전했|밝혔))',
     'ArticleCard', '기사 인용 = 원문 + 형광펜'),
    # 위치·입지를 말한다 → 지도. 말로만 하면 아는 사람만 알아듣는다 (§33)
    (r'((서울|경기|인천|부산|대구|대전|광주|울산)?\s*[가-힣]{2,6}(구|시|동|읍|면|로|대로)\s*'
     r'[^.]{0,24}(있|위치|자리|입지|한복판|인근|옆|사이)|'
     r'(어디|위치는|입지는|자리는)[^.]{0,20}(입니다|인가|일까))',
     'MapCard', '위치 = 지도'),
    (r'(\d+)\s*(위|등)[^.]{0,40}?(\d+)\s*(위|등)', 'RankTrendCard', '순위 변화'),
    # 값이 **대체**된다 — 나란히 비교가 아니라 옛 값에 취소선을 긋는 동작
    (r'([\d,]+\s*(%|억|조|시간|분|년|미터|m|층|평|㎡))[^.]{0,50}?'
     r'(에서|이었지만|였지만|인데|상한[은는]?|였는데|이던|였던|하던|던|에 비해|보다)[^.]{0,50}?'
     r'([\d,]+\s*(%|억|조|시간|분|년|미터|m|층|평|㎡))[^.]{0,30}'
     r'(으?로|까지|밖에|뿐|적용|줄|늘|낮|높)', 'StrikeSwapCard', '값이 갈아치워짐'),
    # "얼마나 큰가" — 절대 크기는 사람 1.7m 옆에 세워야 감이 온다
    (r'(얼마나\s*(크|높|넓|깊)|(\d[\d,.]*)\s*(미터|m)[^.]{0,60}'
     r'((\d[\d,.]*)\s*(미터|m)|남산|롯데월드|63빌딩|에펠))', 'ScaleCompareCard', '절대 크기 = 사람 옆'),
    # 전 / 후가 바뀐다
    (r'((원래는|예전엔|이전에는|과거엔|기존에는|였던 자리)[^.]{0,80}'
     r'(지금은|현재는|바뀌|됐습니다|되었습니다)|철거하고|리모델링해)', 'BeforeAfterCard', '전/후 대비'),
    (r'(지하\s*\d+\s*층|지상\s*\d+\s*층|연면적|대지면적)', 'SectionPhotoCard', '층수·면적 = 단면'),
    (r'(엘리베이터|위아래로|층층이|아래로 내려가|수직으로)', 'ElevatorCard', '수직 이동'),
    # **깊이**가 주인공이면 단면. 축측(덩어리)과 역할이 다르다 (§32-3 ②)
    (r'(깊이|깊게|파 내려|지하\s*\d+\s*층까지|표고|고저차|절토|성토|터널)',
     'SectionDiagramCard', '깊이 = 단면 도해'),
    # 어떻게 생겼나·어떻게 짓나 → 얕은 3D 축측 도해 (§32-3)
    (r'(파냈|파야|굴착|공법|구조를|배치는|앉히|올린 구조|덩어리|매스|동선)',
     'IsoDiagramCard', '구조·공법 = 축측 도해'),
    (r'(기부 대 양여|맞바꾸|넘겨줍니다|넘겨준다|양여)', 'ExchangeMotionCard', '주고받기'),
    (r'(vs|반대했|대립|논쟁|갈등|맞섰|원했습니다.{0,40}반대)', 'ExchangeMotionCard', '두 주체의 대립'),
    (r'(\d{4})년[^.]{0,80}?(\d{4})년[^.]{0,40}?(걸렸|끝났|기간|만에|착공|준공|완공)', 'TimelineRailCard', '기간 비교 = 시간축'),
    (r'(\d+(\.\d+)?)\s*%[^.]{0,60}?(\d+(\.\d+)?)\s*%', 'RatioCard', '비율 비교'),
    (r'(\d+(\.\d+)?)\s*대\s*1|경쟁률', 'BigStatsCard', '경쟁률·큰 수치'),
    (r'(\d+[조억][^.]{0,60}?){3}', 'SkylineCompareCard', '금액 3개 비교'),
    (r'(\d+[조억][^.]{0,60}?){2}', 'SkylineCompareCard', '금액 2개 비교'),
    (r'(첫째|둘째|셋으로 나눴|세 단계|차례로|그리고 나서)', 'PhotoStepsCard', '순서 있는 단계'),
    (r'(\d[\d,]*)\s*(평|㎡|제곱미터|헥타르)[^.]{0,60}?(\d[\d,]*)\s*(평|㎡|제곱미터|헥타르)', 'AreaNestCard', '면적 비교'),
    (r'(개발사|운영사|반면|정반대|분리돼|나뉘어)', 'SplitCard', '둘로 갈리는 대비'),
    (r'(준공은|입주는|예정입니다|남은 일정)', 'TimelineRailCard', '앞으로의 일정'),
    # 사진을 놓고 위치·배치를 짚는다 → 카메라가 훑으며 주석 (§26)
    (r'((왼쪽|오른쪽|가운데|아래쪽|위쪽|여기가|이쪽이|바로 옆|사이에)[^.]{0,40}'
     r'(있|보이|자리|위치|붙어))', 'AnnotatedShotCard', '위치 지시 = 주석 카메라'),
    (r'(사진|보시면|모습을|전경|현장)', 'FullBleedCard', '사진 한 장으로'),
    # 수치가 딱 하나 — 크게 세우고 밑줄로 확정한다 (§27 NumberIn)
    (r'(\d[\d,.]*)\s*(조|억|만|평|㎡|제곱미터|명|가구|세대|개)', 'BigStatsCard', '핵심 수치 하나'),
]
DEFAULT_CARD = 'PaperImageCard'
# §30-2 마지막 줄 — 표에 안 걸리는 문장은 억지 도식을 만들지 않는다.
# 그 컷은 실사 b-roll 로 넘기는 게 낫고, 초안은 그렇게 말해 준다.
NO_DIAGRAM = '도식 불가 — 실사 b-roll 권장'

# 카드별 최소 props 껍데기 — 사람이 값만 채우면 되게
SKELETON = {
    'SkylineCompareCard': {'title': '', 'sub': '', 'buildings': [
        {'label': '', 'value': 0.5, 'note': '', 'shape': 'slab', 'tone': 0},
        {'label': '', 'value': 1.0, 'note': '', 'shape': 'slender', 'hot': True}], 'note': '', 'source': ''},
    'RatioCard': {'title': '', 'sub': '', 'unit': '%', 'items': [
        {'label': '', 'pct': 0, 'sub': '', 'hot': True}, {'label': '', 'pct': 0, 'sub': ''}], 'source': ''},
    'TimelineRailCard': {'title': '', 'sub': '', 'axis': {'from': 2000, 'to': 2030, 'step': 5},
                         'rails': [{'label': '', 'from': 2000, 'to': 2010, 'note': '', 'hot': True}], 'source': ''},
    'ExchangeMotionCard': {'title': '', 'sub': '',
                           'left': {'wordmark': '', 'label': '', 'sub': ''},
                           'right': {'wordmark': '', 'label': '', 'sub': ''},
                           'give': {'icon': 'base', 'label': '', 'sub': ''},
                           'get': {'icon': 'land', 'label': '', 'sub': ''}, 'source': ''},
    'BigStatsCard': {'title': '', 'sub': '', 'items': [
        {'display': '', 'unit': '', 'label': ''}, {'display': '', 'unit': '', 'label': '', 'hot': True}], 'source': ''},
    'RankTrendCard': {'title': '', 'sub': '', 'points': [{'x': '', 'rank': 1}], 'worst': 5,
                      'caption': '', 'source': ''},
    'SectionPhotoCard': {'title': '', 'sub': '', 'above': {'floors': 0, 'label': '지상', 'note': ''},
                         'below': {'floors': 0, 'label': '지하', 'note': ''}, 'bands': [], 'source': ''},
    'ElevatorCard': {'title': '', 'sub': '', 'stops': [{'floor': '', 'label': '', 'sub': ''}], 'source': ''},
    'PhotoStepsCard': {'title': '', 'sub': '', 'steps': [
        {'icon': 'books', 'label': '', 'sub': ''}], 'gapScale': 0.6, 'source': ''},
    'AreaNestCard': {'title': '', 'sub': '', 'unit': '평', 'items': [
        {'label': '', 'value': 1, 'display': '', 'hot': True}], 'multipleNote': '', 'source': ''},
    'SplitCard': {'title': '', 'left': {'label': '', 'sub': '', 'lines': []},
                  'right': {'label': '', 'sub': '', 'lines': []}, 'verdict': '', 'source': ''},
    'FullBleedCard': {'image': '', 'headline': '', 'sub': '', 'scrim': 0.42, 'source': ''},
    'PaperImageCard': {'title': '', 'image': '', 'ratio': 1.778, 'caption': '', 'source': ''},
    # body 안에서 형광펜 칠할 구간을 «…» 로 감싼다. 원문을 통째로 넣을 것 —
    # 인용구만 뽑으면 "내가 고른 말"이 되고, 원문을 놓아야 "기사에 그렇게 적혀 있다"가 된다
    'ArticleCard': {'outlet': '', 'date': '', 'body': '«»', 'portrait': '', 'who': '', 'role': '',
                    'dim': True, 'serif': True, 'source': ''},
    # bounds 는 fetch_map.py 가 찍어 주는 값을 그대로 붙인다.
    # 핀은 위경도로 찍는다 — 픽셀로 맞추면 지도를 다시 뽑을 때 전부 다시 맞춰야 한다
    'MapCard': {'image': '', 'bounds': None, 'title': '', 'sub': '',
                'pins': [{'lat': 0, 'lon': 0, 'label': '', 'sub': '', 'hot': True}],
                'area': None, 'route': None, 'zoomTo': None,
                'align': 'left', 'source': '© OpenStreetMap contributors © CARTO'},
    # 좌표는 실제 단위 (x=거리 m, y=표고 m. 음수가 지하)
    'SectionDiagramCard': {'title': '', 'sub': '',
                           'ground': [[0, 0], [100, 0]], 'cut': [], 'plan': [], 'planLabel': '',
                           'bands': [], 'marks': [], 'dim': None, 'unit': 'm',
                           'note': '', 'source': ''},
    'IsoDiagramCard': {'title': '', 'sub': '',
                       'blocks': [{'x': -2, 'z': -1, 'w': 2, 'd': 2, 'h': 1, 'label': ''},
                                  {'x': 0.5, 'z': -1, 'w': 2, 'd': 2, 'h': 1.4, 'hot': True, 'label': ''}],
                       'dim': None, 'note': '', 'source': ''},
    # from/to 는 문자열 그대로. 카운트업이 아니라 **대체**다
    'StrikeSwapCard': {'title': '', 'sub': '', 'from': '', 'fromLabel': '',
                       'to': '', 'toLabel': '', 'note': '', 'image': '', 'source': ''},
    # §30-1 — 로고는 fetch_sources.py --logo 로 누끼를 떠서 넣는다.
    # logoInvert 값은 어댑트할 때 스크립트가 알려주는 걸 그대로 옮긴다.
    'BrandCard': {'title': '', 'sub': '', 'logo': '', 'name': '', 'line': '',
                  'tags': [], 'photo': '', 'layout': '', 'logoInvert': 'auto', 'source': ''},
    'TrackRecordCard': {'title': '', 'sub': '', 'name': '', 'role': '',
                        'items': [{'label': '', 'note': ''}], 'source': ''},
    'ScaleCompareCard': {'title': '', 'sub': '', 'unit': 'm', 'items': [
        {'label': '', 'meters': 0, 'shape': 'tower', 'note': ''},
        {'label': '', 'meters': 0, 'shape': 'tower', 'note': '', 'hot': True}], 'source': ''},
    'BeforeAfterCard': {'before': '', 'after': '', 'beforeLabel': '이전', 'afterLabel': '이후',
                        'beforeNote': '', 'afterNote': '', 'headline': '',
                        'startSec': 0.6, 'pauseAt': 0.6, 'source': ''},
    # zoom 은 1.6 을 넘기지 말 것 — 1920px 원본이 뭉갠다
    'AnnotatedShotCard': {'image': '', 'imageRatio': 1.778, 'title': '', 'titleSub': '',
                          'scrim': 0, 'leadIn': 0.7,
                          'beats': [{'x': 0.5, 'y': 0.5, 'zoom': 1.3, 'label': '', 'sub': '',
                                     'side': 'right', 'hot': True, 'hold': 40}], 'source': ''},
}


_cps = CPS


def speak_sec(text):
    """낭독 길이 추정. 한글은 CPS, 숫자·영문은 또박또박 읽어 1.6배 가중."""
    ko = len(re.findall(r'[가-힣]', text))
    num = len(re.findall(r'[0-9A-Za-z]', text))
    punct = len(re.findall(r'[,·]', text)) * 0.15 + len(re.findall(r'[.?!]', text)) * 0.35
    return (ko + num * 1.6) / _cps + punct


def split_sentences(par):
    """문장 단위로 쪼갠다 (한국어 종결어미 + 마침표)."""
    parts = re.split(r'(?<=[.?!])\s+', par.strip())
    return [p.strip() for p in parts if p.strip()]


def split_clauses(sent):
    """긴 문장을 쉼표에서 절로 나눈다.

    숫자 안의 쉼표(1만3,600)에서 끊으면 안 되므로 자리표시자로 잠시 치환한다.
    조각이 MIN_CUT 보다 짧으면 앞 절에 도로 붙인다 — 0.8초짜리 컷은 튄다.
    """
    if speak_sec(sent) <= CLAUSE_AT:
        return [sent]
    masked = re.sub(r'(?<=\d),(?=\d)', '\x00', sent)
    parts = [p.strip() for p in re.split(r'(?<=,)\s*', masked) if p.strip()]
    out = []
    for p in parts:
        p = p.replace('\x00', ',')
        if out and speak_sec(p) < MIN_CUT:
            out[-1] = (out[-1] + ' ' + p).strip()
        else:
            out.append(p)
    return out


def build_scenes(sections):
    """섹션(문단) → 장면. 장면이 너무 길면 문장 경계에서 쪼갠다."""
    scenes = []
    for act, par in enumerate(sections, start=1):
        sents = [c for s in split_sentences(par) for c in split_clauses(s)]
        buf, cur = [], 0.0
        for s in sents:
            d = speak_sec(s)
            # 문장 경계에서 끊는다. 기준은 MAX_CUT 이 아니라 SPLIT_AT —
            # 15초까지 버티면 스위트스팟(3~8초)을 늘 벗어난다.
            if buf and cur + d > SPLIT_AT and cur >= MIN_CUT:
                scenes.append((act, ' '.join(buf), cur))
                buf, cur = [], 0.0
            buf.append(s)
            cur += d
        if buf:
            scenes.append((act, ' '.join(buf), cur))
    return scenes


# 같은 문법이 연속될 때 돌려 쓸 대안. 뜻이 안 깨지는 짝만 넣는다.
ALT = {
    # §40 카드 — 이게 없으면 총량 초과분을 돌릴 데가 없어 그대로 몰린다
    'LowerThirdCard':      ['MediaPlateCard', 'AnnotatedShotCard', 'FullBleedCard'],
    'MediaPlateCard':      ['AnnotatedShotCard', 'LowerThirdCard', 'PaperImageCard'],
    'SectionScaleCard':    ['IsoDiagramCard', 'SectionDiagramCard'],
    'AreaBudgetCard':      ['SitePlotCard', 'AreaNestCard'],
    'SilhouetteCompareCard': ['ScaleCompareCard', 'SkylineCompareCard'],
    'ForkPathCard':        ['TwoPanelCard', 'SplitCard'],
    'TwoPanelCard':        ['ForkPathCard', 'SplitCard'],
    'YFlowCard':           ['PaperFlowCard', 'TimelineRailCard'],
    'PlanTitleCard':       ['HeadlineCard', 'YHeadlineCard'],
    'ShareSplitCard':      ['AreaNestCard', 'DotMatrixCard'],
    'PaperImageCard':      ['FullBleedCard', 'AnnotatedShotCard'],
    'FullBleedCard':       ['PaperImageCard', 'AnnotatedShotCard'],
    'SkylineCompareCard':  ['ScaleCompareCard', 'BigStatsCard'],
    'ScaleCompareCard':    ['SkylineCompareCard'],
    'RatioCard':           ['BigStatsCard', 'AreaNestCard'],
    'BigStatsCard':        ['RatioCard'],
    'PhotoStepsCard':      ['TimelineRailCard', 'SplitCard'],
    'SplitCard':           ['PhotoStepsCard'],
    'TimelineRailCard':    ['PhotoStepsCard'],
    'BrandCard':           ['TrackRecordCard', 'PaperImageCard'],
    'TrackRecordCard':     ['BrandCard', 'SplitCard'],
    'AnnotatedShotCard':   ['FullBleedCard', 'PaperImageCard'],
    'BeforeAfterCard':     ['SplitCard'],
    'StrikeSwapCard':      ['BigStatsCard', 'RatioCard'],
    'ArticleCard':         ['NewsQuoteCard', 'QuoteCard'],
    'IsoDiagramCard':      ['SectionPhotoCard', 'ExplodedStackCard'],
    'MapCard':             ['AnnotatedShotCard', 'FullBleedCard'],
    'SectionDiagramCard':  ['IsoDiagramCard', 'SectionPhotoCard'],
}
REPEAT_MAX = 2          # 같은 카드 연속 허용 한도


def suggest_card(text):
    for pat, card, why in RULES:
        if re.search(pat, text):
            return card, why
    return DEFAULT_CARD, NO_DIAGRAM


# 한 카드가 전체에서 차지해도 되는 몫. 이걸 넘으면 그 카드로 때우고 있는 것이다.
SHARE_MAX = 0.32

REPORT = []      # 자동으로 못 푼 것을 담는다. 마지막에 사람에게 보여 준다

# ── 계열 ──────────────────────────────────────────────────────────────────
# 카드별 상한만 걸었더니 PaperImage → FullBleed → AnnotatedShot 으로 **이름만
# 바꿔 돌려막았다.** 셋 다 "사진 위에 글자" 라 화면에서는 같은 것이다.
# 실측: 카드별 상한을 건 뒤에도 이 세 장이 113컷 중 81컷(72%)이었다.
#
# 그래서 계열로 다시 묶어 상한을 건다. B1M 은 대략 절반이 실사, 절반이 그래픽이다.
FAMILY = {
    'LowerThirdCard': '실사', 'FullBleedCard': '실사', 'PaperImageCard': '실사',
    'AnnotatedShotCard': '실사', 'SectionPhotoCard': '실사', 'PhotoSplitCard': '실사',
    'BrandCard': '실사', 'YHeadlineCard': '실사',
    'MediaPlateCard': '자료판', 'ArticleCard': '자료판', 'SplitProofCard': '자료판',
    'MapCard': '지도', 'GeoMapCard': '지도',
}
FAMILY_MAX = {'실사': 0.52}      # 나머지 계열은 애초에 그렇게 안 몰린다


def vary(cards):
    """카드가 몰리는 걸 두 방향으로 푼다 — **연속**과 **총량**.

    예전엔 연속만 막았다. 그런데 올리브영 성수편에서 123컷 중 82컷(67%)이
    LowerThirdCard 였다. 연속 3개를 넘긴 적이 없어서 검사를 통과한 것이다.
    **흩어져 있으면 안 걸리는 검사**였다.

    화면이 지겨운 건 같은 카드가 붙어 있어서가 아니라 **그 카드밖에 없어서**다.
    그래서 총량도 본다 — 한 카드가 SHARE_MAX 를 넘으면 넘친 만큼을 대안으로
    돌린다. 돌릴 때는 **연속이 가장 긴 구간부터** 손댄다. 거기가 제일 티가 난다.
    """
    out, run = [], 0
    for c in cards:
        if out and c == out[-1]:
            run += 1
        else:
            run = 1
        if run > REPEAT_MAX:
            for a in ALT.get(c, []):
                if not out or a != out[-1]:
                    c, run = a, 1
                    break
        out.append(c)

    # ── 총량 ──
    n = len(out)
    if n < 8:
        return out
    cap = max(2, int(n * SHARE_MAX))
    from collections import Counter
    while True:
        cnt = Counter(out)
        card, k = cnt.most_common(1)[0]
        if k <= cap:
            break
        alts = [a for a in ALT.get(card, []) if cnt[a] < cap]
        if not alts:
            break                      # 바꿀 데가 없으면 그대로 둔다 — 억지로
                                       # 안 맞는 카드를 넣는 게 더 나쁘다
        # 연속으로 붙어 있는 자리부터 바꾼다
        idx = [i for i in range(1, n) if out[i] == card and out[i - 1] == card]
        idx += [i for i in range(n) if out[i] == card and i not in idx]
        for i in idx[:k - cap]:
            for a in alts:
                if (i == 0 or out[i - 1] != a) and (i == n - 1 or out[i + 1] != a):
                    out[i] = a
                    break

    # ── 계열은 **고치지 않고 알린다** ──
    # 계열이 넘칠 때 자동으로 다른 계열 카드로 돌려 봤다. 안 됐다 — 실사 카드의
    # 대안이 전부 같은 계열이라 보낼 곳이 없었다.
    #
    # 여기서 억지로 아무 그래픽 카드에 밀어 넣을 수도 있었지만 그러면 안 된다.
    # 남은 컷들은 **규칙에 안 걸린 문장**이고, 뜻이 안 맞는 그림을 얹는 건
    # 지겨운 것보다 나쁘다. 자동화가 할 수 있는 건 여기까지다.
    #
    # 그래서 조용히 바꾸는 대신 **몇 컷이 남았는지 드러낸다.** 그 숫자가
    # "여기부터는 사람이 설계해야 한다" 는 뜻이고, 그게 이 도구의 정직한 출력이다.
    for fam, ratio in FAMILY_MAX.items():
        k = sum(1 for c in out if FAMILY.get(c) == fam)
        if k > max(2, int(n * ratio)):
            REPORT.append(
                f'{fam} 계열 {k}/{n}컷 ({k / n * 100:.0f}%) — 권장 {ratio * 100:.0f}%. '
                f'약 {k - int(n * ratio)}컷은 직접 설계해야 한다')
    return out


def key_of(text, used):
    """파일명에 쓸 짧은 영문 키. 한글은 못 쓰므로 순번 기반으로 만든다."""
    base = 'cut'
    i = 1
    while f'{base}{i:02d}' in used:
        i += 1
    used.add(f'{base}{i:02d}')
    return f'{base}{i:02d}'


def allocate(scenes):
    """장면 → scene_plan 항목. MAX_CUT 초과 장면은 [카드 + 실사] 로 자동 분할."""
    picked = vary([suggest_card(t)[0] for _, t, _ in scenes])
    out, used, t = [], set(), 0.0
    prev_act, no_diag_run = None, False
    for i, (act, text, dur) in enumerate(scenes):
        if prev_act is not None:
            t += GAP if act != prev_act else GAP_IN
        prev_act = act
        dur = round(dur, 1)
        want, why = suggest_card(text)
        card = picked[i]
        if card != want:
            why = f'{why} → 연속 회피로 변주'
        e = {
            'id': i, 'act': act, 'start': round(t, 1), 'end': round(t + dur, 1), 'dur': dur,
            'text': text, 'card': card, 'key': key_of(text, used), '_why': why,
        }
        # §30-2 마지막 줄 — 도식이 안 나오는 문장을 **연달아** 종이 카드로 때우면
        # 화면이 안 바뀐다(§30-3). 연속 구간의 두 번째부터는 실사로 넘긴다.
        if why.startswith(NO_DIAGRAM) and no_diag_run and dur >= MIN_CUT:
            e['cardDur'] = 0
            e['broll'] = {'src': 'TODO.mp4', 'ss': 0.0, 'dur': dur}
        no_diag_run = why.startswith(NO_DIAGRAM) and not e.get('broll')

        if dur > MAX_CUT:
            # 앞 2/3 는 카드, 뒤는 실사. 한 컷이 15초를 넘지 않게 나눈다.
            card_dur = round(min(MAX_CUT, dur * 0.66), 1)
            e['cardDur'] = card_dur
            e['broll'] = {'src': 'TODO.mp4', 'ss': 0.0, 'dur': round(dur - card_dur, 1)}
        out.append(e)
        t += dur
    return out


# ── 컷 연속성 (design_reference §34-2) ────────────────────────────────────
# 하드컷으로만 이으면 컷마다 화면이 "다시 시작"한다. B1M 은 나가는 컷과
# 들어오는 컷이 **같은 방향으로 흐른다** — 그래서 끊긴 느낌이 없다.
# MotionShell 이 그걸 할 수 있는데 여태 쓰이지 않았다. 플래너가 안 넣어서다.
#
# 방향을 매 컷 바꾸면 화면이 좌우로 튀어 멀미가 난다. **2~3컷을 같은 방향으로**
# 흘려보내고 한 번 바꾼다. 실사 컷은 MotionShell 을 안 거치므로 흐름을 끊는데,
# 그게 오히려 호흡이 된다 — 실사 다음 컷에서 방향을 새로 잡는다.
FLOW_DIRS = ['left', 'left', 'up', 'right', 'right', 'down']
FLOW_RUN = 2            # 같은 방향으로 흘려보내는 컷 수


def add_motion(plan):
    di, run = 0, 0
    for e in plan:
        if e.get('cardDur', e['dur']) <= 0:      # 통째로 실사인 컷 — 흐름을 끊는다
            run = 0
            di = (di + 1) % len(FLOW_DIRS)
            continue
        if run >= FLOW_RUN:
            run = 0
            di = (di + 1) % len(FLOW_DIRS)
        e['motion'] = {'dir': FLOW_DIRS[di], 'push': 0.035,
                       # 뒤에 실사가 붙는 컷은 밀고 나가지 않는다 — 실사가 이어받지 못한다
                       # 퇴장 모션은 쓰지 않는다. 들어올 때 미는 건 자연스러운데
                       # 나갈 때 미는 건 컷이 끝나기 전에 화면이 도망가는 것처럼
                       # 보여 어색하다 (검수에서 지적).
                       'exitSec': 0}
        run += 1
    return plan


def lift_live(plan):
    """실사 비중이 LIVE_TARGET 에 못 미치면 카드 컷을 실사로 넘긴다.

    넘기는 순서가 중요하다. **도식이 안 나오는 긴 컷부터** 넘긴다 —
    도표가 붙은 컷을 실사로 바꾸면 정보가 사라지지만,
    종이 카드로 때우던 컷은 애초에 화면이 비어 있었다.
    """
    def live_ratio():
        card = live = 0.0
        for e in plan:
            card += max(0.0, e.get('cardDur', e['dur']))
            bs = e.get('broll')
            if bs:
                bs = bs if isinstance(bs, list) else [bs]
                live += sum(b['dur'] for b in bs)
        t = card + live
        return (live / t) if t else 0.0

    # 후보: 아직 실사가 없고, 도식도 없던 컷. 긴 것부터.
    cands = sorted((e for e in plan
                    if not e.get('broll') and e.get('_why', '').startswith(NO_DIAGRAM)
                    and e['dur'] >= MIN_CUT),
                   key=lambda e: -e['dur'])
    for e in cands:
        if live_ratio() >= LIVE_TARGET:
            break
        e['cardDur'] = 0
        e['broll'] = {'src': 'TODO.mp4', 'ss': 0.0, 'dur': e['dur']}
    return plan


def tighten_opening(plan):
    """첫 30초에 컷이 부족하면 앞쪽 장면을 실사와 반씩 나눠 컷을 늘린다."""
    def cut_count():
        n, t = 0, 0.0
        for e in plan:
            if e['start'] >= OPENING_SEC:
                break
            n += 1 if e.get('cardDur', e['dur']) > 0 else 0
            n += len(e['broll']) if isinstance(e.get('broll'), list) else (1 if e.get('broll') else 0)
        return n
    for e in plan:
        if cut_count() >= OPENING_MIN_CUTS or e['start'] >= OPENING_SEC:
            break
        if 'broll' not in e and e['dur'] >= MIN_CUT * 2:
            half = round(e['dur'] * 0.6, 1)
            e['cardDur'] = half
            e['broll'] = {'src': 'TODO.mp4', 'ss': 0.0, 'dur': round(e['dur'] - half, 1)}
    return plan


def chapters(plan):
    """장면을 90초 안팎의 챕터로 묶는다. 경계는 **반드시 문단(act) 경계**.

    문장 중간에서 챕터를 끊으면 유튜브 목차에서 말이 잘린 채 시작한다.
    이름은 비워 둔다 — 챕터 제목은 기획의 일이라 자동으로 지으면 다 똑같아진다.
    대신 그 챕터 첫 문장을 힌트로 남긴다.
    """
    if not plan:
        return []
    out, cur = [], None
    for e in plan:
        target = INTRO_SEC if not out and cur is None else CHAPTER_SEC
        new_act = cur is not None and e['act'] != cur['_act']
        if cur is None:
            cur = {'start': e['start'], 'name': '', 'hint': e['text'][:44], '_act': e['act']}
        elif new_act and (cur['_len'] if '_len' in cur else e['start'] - cur['start']) >= target * 0.72:
            cur['end'] = round(e['start'], 1)
            out.append(cur)
            cur = {'start': e['start'], 'name': '', 'hint': e['text'][:44], '_act': e['act']}
        cur['_act'] = e['act']
        cur['_len'] = e['end'] - cur['start']
    cur['end'] = plan[-1]['end']
    out.append(cur)

    # 너무 짧은 챕터는 앞에 붙인다 (48초 = B1M p10)
    merged = []
    for c in out:
        if merged and c['end'] - c['start'] < CHAPTER_MIN:
            merged[-1]['end'] = c['end']
        else:
            merged.append(c)
    for c in merged:
        c.pop('_act', None); c.pop('_len', None)
        c['dur'] = round(c['end'] - c['start'], 1)
        c['ts'] = f"{int(c['start']) // 60}:{int(c['start']) % 60:02d}"
    return merged


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('script')
    ap.add_argument('--project', required=True)
    ap.add_argument('--cps', type=float, default=CPS)
    ap.add_argument('--dry', action='store_true', help='파일로 안 쓰고 요약만 출력')
    a = ap.parse_args()

    global _cps
    _cps = a.cps

    raw = open(a.script, encoding='utf-8').read()
    # 마크다운 제목·인용·구분선은 낭독 대상이 아니다
    raw = re.sub(r'^\s*(#{1,6}\s.*|>.*|-{3,})$', '', raw, flags=re.M)
    sections = [p.strip() for p in re.split(r'\n\s*\n', raw) if p.strip()]
    if not sections:
        sys.exit('스크립트에서 문단을 못 찾았다.')

    plan = add_motion(lift_live(tighten_opening(allocate(build_scenes(sections)))))
    total = plan[-1]['end']

    print(f'섹션 {len(sections)} → 장면 {len(plan)} · {total:.1f}초 ({int(total)//60}:{int(total)%60:02d})')
    ncut = sum(1 + (len(e['broll']) if isinstance(e.get('broll'), list) else (1 if e.get('broll') else 0))
               if e.get('cardDur', e['dur']) > 0 else 1 for e in plan)
    print(f'예상 컷 {ncut}개 · 첫 30초 컷 {sum(1 for e in plan if e["start"] < 30)}개\n')
    for e in plan:
        mark = '+실사' if e.get('broll') else '    '
        print(f"  #{e['id']:2d} act{e['act']:2d} {e['dur']:5.1f}s {mark} {e['card']:20s} "
              f"({e['_why']})  {e['text'][:34]}…")

    chs = chapters(plan)
    # ── 자동화가 못 푼 것 ──
    # 이 리포트가 이 도구의 진짜 출력이다. 컷을 다 채웠다고 끝난 게 아니라,
    # **몇 컷이 아직 설계되지 않았는지**를 알아야 다음 작업이 시작된다.
    import collections as _c
    _cards = [e['card'] for e in plan]
    _cnt = _c.Counter(_cards)
    _fam = _c.Counter(FAMILY.get(x, '그래픽') for x in _cards)
    _nod = sum(1 for e in plan if str(e.get('_why', '')).startswith(NO_DIAGRAM))
    print('\n── 설계 상태 ──')
    print(f'   카드 {len(_cnt)}종 · 최다 {_cnt.most_common(1)[0][0]} '
          f'{_cnt.most_common(1)[0][1]}컷 ({_cnt.most_common(1)[0][1] / len(_cards) * 100:.0f}%)')
    print('   계열  ' + ' · '.join(f'{k} {v}컷({v / len(_cards) * 100:.0f}%)'
                                   for k, v in _fam.most_common()))
    if _nod:
        print(f'   ⚠ 규칙에 안 걸린 문장 {_nod}컷 — **직접 설계해야 한다.**')
        print('     숫자·비교·인과가 없는 문장이라 도구가 고를 수 없다.')
        print('     references/카드-고르기.md 의 5번(구조·배분) 부터 본다.')
    for _r in REPORT:
        print(f'   ⚠ {_r}')

    print(f'\n챕터 {len(chs)}개 · 길이 중앙 '
          f'{sorted(c["dur"] for c in chs)[len(chs) // 2]:.0f}초 (B1M 실측 8개 · 90초)')
    for c in chs:
        print(f"  {c['ts']:>6s}  {c['dur']:5.1f}s  (제목 미정)  {c['hint']}…")

    if a.dry:
        return

    outdir = os.path.join(ROOT, 'projects', a.project)
    os.makedirs(outdir, exist_ok=True)
    for e in plan:
        e.pop('_why', None)
    json.dump({'project': a.project, 'chapters': chs, 'scenes': plan},
              open(os.path.join(outdir, 'scene_plan.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2)

    props = {str(e['id']): {'card': e['card'],
                            'props': json.loads(json.dumps(SKELETON.get(e['card'], {}))),
                            **({'motion': e['motion']} if e.get('motion') else {})}
             for e in plan}
    json.dump({'project': a.project,
               'note': 'plan_from_script.py 초안. 수치·라벨을 채운 뒤 qa_check.py 로 검사할 것.',
               'scenes': props},
              open(os.path.join(outdir, 'scene_props.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2)
    print(f'\n→ {outdir}/scene_plan.json · scene_props.json')
    print('   다음: 값 채우기 → render_parkside.py --still → qa_check.py')


if __name__ == '__main__':
    main()
