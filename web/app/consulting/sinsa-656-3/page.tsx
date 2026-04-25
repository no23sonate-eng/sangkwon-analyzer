"use client";

import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList,
} from "recharts";

/* ══════════════════════════════════════════════════════════════
   강남구 신사동 656-3 자산가치 진단 — 1차 미팅 자료
   매도 전략 컨설팅 제안서
   ══════════════════════════════════════════════════════════════ */

// 검증된 데이터 (2025 Q4 서울시 상권분석 + 자체 보정)
const FACT = {
  address: "서울 강남구 신사동 656-3",
  road: "선릉로155길 23-4",
  area: "도산공원 북측 (압구정동)",
  lat: 37.5254,
  lng: 127.0374,
  dataQuarter: "2025 Q4",
  ftQuarter: 925_901,
  popResident: 10_376,
  ftDailyApprox: Math.round(925_901 / 90),
  // 연령 분포 (유동인구 기반, %)
  age: [
    { name: "10대", value: 8 },
    { name: "20대", value: 22 },
    { name: "30대", value: 25 },
    { name: "40대", value: 21 },
    { name: "50대", value: 12 },
    { name: "60대+", value: 12 },
  ],
  gender: { male: 45, female: 55 },
  timeSlots: [
    { slot: "00-06", value: 12 },
    { slot: "06-11", value: 17 },
    { slot: "11-14", value: 19 },
    { slot: "14-17", value: 20 },
    { slot: "17-21", value: 22 },
    { slot: "21-24", value: 10 },
  ],
  rentByFloor: [
    { floor: "1층", n: 187, avg: 41, median: 38.3, max: 54.4, marketHi: 80 },
    { floor: "2층", n: 186, avg: 20.5, median: 19.2, max: 27.2, marketHi: 35 },
    { floor: "지하", n: 186, avg: 14.3, median: 13.4, max: 19, marketHi: 25 },
  ],
  // 도산공원북측 trdar 단일 — sales 데이터 보고된 svc만
  nearbyShops: {
    외식: 14, "카페·주류": 10, 소매: 16, 교육: 2, 생활서비스: 1, 기타: 5,
  },
};

// 가정 변수 (1차 미팅에서 건물주에게 받아 갱신)
const ASSUMED = {
  landPyeong: 50,
  totalFloorPyeong: 250, // 연면적 (5층 + 지하)
  floors: [
    { name: "1층", pyeong: 30, useType: "상가 임대 (메인 노출)" },
    { name: "2층", pyeong: 40, useType: "상가 임대" },
    { name: "3층", pyeong: 40, useType: "상가/사무 임대" },
    { name: "4층", pyeong: 40, useType: "상가/사무 임대" },
    { name: "5층", pyeong: 40, useType: "상가/사무 임대" },
    { name: "지하", pyeong: 30, useType: "F&B/창고 임대" },
  ],
  totalCost: 105, // 매입가 + 사업비 (억) — 가정
};

// MD 시나리오: 분할 임대 — 층별 임대료 시뮬 (월 기준, 만원)
const SCENARIO_2_RENT = [
  { floor: "1층", pyeong: 30, target: "프리미엄 F&B / 셀렉트 소매", payeongRent: 70, monthly: 30 * 70 },
  { floor: "2층", pyeong: 40, target: "뷰티 클리닉 / 라이프스타일", payeongRent: 28, monthly: 40 * 28 },
  { floor: "3층", pyeong: 40, target: "스튜디오 / 사무소 (디자인·마케팅)", payeongRent: 22, monthly: 40 * 22 },
  { floor: "4층", pyeong: 40, target: "사무소 / 컨설팅 펌", payeongRent: 22, monthly: 40 * 22 },
  { floor: "5층", pyeong: 40, target: "사무 / 다이닝 라운지", payeongRent: 24, monthly: 40 * 24 },
  { floor: "지하", pyeong: 30, target: "주방 임대 F&B / 스튜디오", payeongRent: 14, monthly: 30 * 14 },
];

// 차트 색상
const COL_MALE = "#6366F1";
const COL_FEMALE = "#EC4899";
const AGE_COLORS = ["#A5B4FC", "#818CF8", "#6366F1", "#4F46E5", "#3730A3", "#312E81"];

export default function SinsaConsultingPage() {
  // ── 시나리오 2 — 임대 NOI 산출 ──
  const monthlyRentSum = SCENARIO_2_RENT.reduce((a, b) => a + b.monthly, 0); // 만원
  const annualRent = monthlyRentSum * 12; // 만원
  const opex = Math.round(annualRent * 0.08); // 운영비 8%
  const noi = annualRent - opex; // 만원
  const noiEok = noi / 10000; // 억
  const capScenarios = [
    { cap: 0.045, label: "공격 (4.5%)" },
    { cap: 0.050, label: "적정 (5.0%)" },
    { cap: 0.055, label: "보수 (5.5%)" },
  ].map((s) => ({ ...s, price: Math.round((noiEok / s.cap) * 10) / 10 }));

  // ── 시나리오 1 — 사옥 매도 매가 (가정) ──
  const scenario1 = {
    low: 92,
    mid: 100,
    high: 110,
  };

  // 시나리오 비교 차트 데이터 (억 단위)
  const compareData = [
    { kind: "1안 사옥 매도", 보수: scenario1.low, 적정: scenario1.mid, 공격: scenario1.high },
    { kind: "2안 분할 임대 NOI", 보수: capScenarios[2].price, 적정: capScenarios[1].price, 공격: capScenarios[0].price },
  ];

  const upliftLow = capScenarios[2].price - scenario1.low;
  const upliftHigh = capScenarios[0].price - scenario1.high;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm 12mm; }
          .print-break { page-break-before: always; }
          .no-print { display: none !important; }
          body { background: white; }
        }
        .number-display { font-feature-settings: "tnum"; font-variant-numeric: tabular-nums; }
      `}</style>

      <div className="mx-auto max-w-[920px] px-8 py-10 print:px-0 print:py-0">

        {/* ━━━━━━ 1. COVER ━━━━━━ */}
        <header className="border-b border-slate-200 pb-6">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>BRIX · COMMERCIAL REAL ESTATE ADVISORY</span>
            <span>1차 미팅 자료 · {new Date().toLocaleDateString("ko-KR")}</span>
          </div>
          <h1 className="mt-6 text-[34px] font-black leading-tight tracking-tight">
            신사동 656-3<br />
            <span className="text-primary-600">자산가치 진단 & 매도 전략</span>
          </h1>
          <p className="mt-3 text-[14px] text-slate-600">
            도산공원 북측 신축 상업용 빌딩 — 매도 전략 컨설팅 제안 (1차 미팅용 사전 자료)
          </p>

          {/* Hero Stats */}
          <div className="mt-7 grid grid-cols-3 gap-3">
            <HeroStat
              label="2안 적정 매가 추정"
              value={`${capScenarios[1].price}억`}
              sub={`연 NOI ${noiEok.toFixed(1)}억 × cap 5.0%`}
              color="text-primary-600"
            />
            <HeroStat
              label="1안 vs 2안 매가 격차"
              value={`+${Math.round(capScenarios[1].price - scenario1.mid)}억`}
              sub="MD 전환 + NOI 시뮬 효과"
              color="text-emerald-600"
            />
            <HeroStat
              label="컨설팅 ROI"
              value={`${Math.round((capScenarios[1].price - scenario1.mid) * 10000 / 1000)}배`}
              sub="매가 격차 ÷ 컨설팅비 1,000만"
              color="text-amber-600"
            />
          </div>

          <p className="mt-6 rounded-xl bg-slate-50 px-5 py-4 text-[13px] leading-relaxed text-slate-700">
            <span className="font-semibold text-slate-900">매도가는 입지가 아니라 매도 전략이 결정합니다.</span><br />
            본 자료는 공공 상권 데이터 + 실측 임대 사례 + 매수자 관점을 결합한 1차 진단입니다.
            매가 결정 3대 변수(임차 구성·수익률·매수자 매칭)에 따라 매가는 보수적 95억 ~ 공격적 145억 구간에서 형성됩니다.
          </p>
        </header>

        {/* ━━━━━━ 2. 위치·상권 진단 ━━━━━━ */}
        <Section title="01. 위치·상권 진단" subtitle="검증 데이터 (2025 Q4)">
          <div className="grid grid-cols-2 gap-4">
            <Card title="입지">
              <Row k="주소" v={FACT.address} />
              <Row k="도로명" v={FACT.road} />
              <Row k="좌표" v={`${FACT.lat}, ${FACT.lng}`} />
              <Row k="소속 상권" v={`${FACT.area}`} highlight />
            </Card>
            <Card title="잠재 소비자 (반경 300m)">
              <Row k="유동인구 (분기)" v={`${FACT.ftQuarter.toLocaleString()}명`} />
              <Row k="일평균 환산" v={`약 ${FACT.ftDailyApprox.toLocaleString()}명/일`} />
              <Row k="거주인구" v={`${FACT.popResident.toLocaleString()}명`} />
              <Row k="상권 성격" v="통행형 — 외부 목적성 방문 위주" highlight />
            </Card>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-4">
            <Card title="방문자 연령" subTitle="유동인구 분포 %">
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={FACT.age} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="none">
                    {FACT.age.map((_, i) => <Cell key={i} fill={AGE_COLORS[i]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-1 grid grid-cols-3 gap-x-2 gap-y-1 text-[10px]">
                {FACT.age.map((a, i) => (
                  <span key={a.name} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: AGE_COLORS[i] }} />
                    <span className="text-slate-600">{a.name}</span>
                    <span className="ml-auto font-semibold">{a.value}%</span>
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[10.5px] text-slate-500">
                20–40대 <span className="font-semibold text-primary-600">68%</span> — 핵심 소비층 명확
              </p>
            </Card>

            <Card title="성별" subTitle="유동인구 분포 %">
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie
                    data={[{ name: "여성", value: FACT.gender.female }, { name: "남성", value: FACT.gender.male }]}
                    dataKey="value" nameKey="name" innerRadius="60%" outerRadius="90%" stroke="none"
                  >
                    <Cell fill={COL_FEMALE} />
                    <Cell fill={COL_MALE} />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-1 grid grid-cols-2 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: COL_FEMALE }} />여성
                  <span className="ml-auto font-bold">{FACT.gender.female}%</span>
                </span>
                <span className="flex items-center gap-1.5 justify-end">
                  <span className="h-2 w-2 rounded-full" style={{ background: COL_MALE }} />남성
                  <span className="ml-auto font-bold">{FACT.gender.male}%</span>
                </span>
              </div>
              <p className="mt-2 text-[10.5px] text-slate-500">
                여성 우세 — <span className="font-semibold text-primary-600">명품·뷰티·라이프</span> 친화 입지
              </p>
            </Card>

            <Card title="시간대" subTitle="유동인구 분포 %">
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={FACT.timeSlots} barSize={16}>
                  <XAxis dataKey="slot" tick={{ fill: "#64748B", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Bar dataKey="value" fill="#6366F1" radius={[3, 3, 0, 0]}>
                    <LabelList dataKey="value" position="top" fontSize={9} fill="#475569" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-2 text-[10.5px] text-slate-500">
                14–21시 <span className="font-semibold text-primary-600">42%</span> — 낮·저녁 균형형
              </p>
            </Card>
          </div>
        </Section>

        {/* ━━━━━━ 3. 임대 시세 ━━━━━━ */}
        <Section title="02. 임대 시세" subtitle="반경 800m 실측 559건 + 시장 보정">
          <Card>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] text-slate-500">
                  <th className="py-2 text-left font-medium">층</th>
                  <th className="py-2 text-right font-medium">사례 (n)</th>
                  <th className="py-2 text-right font-medium">평균</th>
                  <th className="py-2 text-right font-medium">중앙값</th>
                  <th className="py-2 text-right font-medium">DB 최대</th>
                  <th className="py-2 text-right font-medium">시장 보정 상한*</th>
                </tr>
              </thead>
              <tbody>
                {FACT.rentByFloor.map((r) => (
                  <tr key={r.floor} className="border-b border-slate-100">
                    <td className="py-2 font-semibold">{r.floor}</td>
                    <td className="py-2 text-right text-slate-600">{r.n}</td>
                    <td className="py-2 text-right">{r.avg}만</td>
                    <td className="py-2 text-right">{r.median}만</td>
                    <td className="py-2 text-right text-slate-500">{r.max}만</td>
                    <td className="py-2 text-right font-bold text-primary-600">{r.marketHi}만</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[10.5px] leading-relaxed text-slate-500">
              * 공공 실거래 DB는 강남 프라임 메인 라인 거래가 신고 누락·저가 위주로 잡혀 max 54만/평까지만 잡힘.
              실제 도산공원 메인 라인 1층 신축 매장은 60–80만/평에 형성. <span className="font-semibold text-slate-700">현장 답사 기반 +30~50% 보정</span> 적용.
            </p>
          </Card>
        </Section>

        {/* ━━━━━━ 4. 매가 결정 3대 변수 ━━━━━━ */}
        <Section title="03. 매가를 결정하는 3대 변수" subtitle="입지가 아니라 전략이 매가를 만듭니다">
          <div className="grid grid-cols-3 gap-3">
            <Variable
              n="①"
              title="임차인 구성 (MD)"
              impact="±15%"
              desc="공실률 / 업종 적합도 / 임차 안정성 → 매수자가 가장 먼저 보는 항목"
            />
            <Variable
              n="②"
              title="임대 수익률 (NOI)"
              impact="±20%"
              desc="현재 임대료 vs 시세 격차 — Cap rate 0.5%pt 차이가 매가 10% 좌우"
            />
            <Variable
              n="③"
              title="매수자 페르소나"
              impact="±10%"
              desc="개인 자산가 / 패밀리오피스 / 임대법인 / 사옥 매수자 — 타겟별 매도 자료 필요"
            />
          </div>
        </Section>

        {/* ━━━━━━ 5. MD 시나리오 (핵심 페이지) ━━━━━━ */}
        <div className="print-break" />
        <Section title="04. MD 2안 시나리오" subtitle={`총 ${ASSUMED.landPyeong}평 토지 / 연면적 ${ASSUMED.totalFloorPyeong}평 가정 — 미팅 시 실제 확정`}>
          <div className="grid grid-cols-2 gap-4">
            {/* 1안 — 사옥 */}
            <Card title="1안 · 사옥 전체 매도" tone="slate">
              <p className="mb-3 text-[11.5px] text-slate-600">
                매수자 = 입주 비즈니스가 있는 단일 매수자 (외국계 브랜드, 고급 브랜드 본사, 중소 사옥 수요 등)
              </p>
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="border-b border-slate-200 text-[10.5px] text-slate-500">
                    <th className="py-1.5 text-left">평가 기준</th>
                    <th className="py-1.5 text-right">매가 (억)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-100"><td className="py-1.5">보수 (사옥 수요 약함)</td><td className="py-1.5 text-right">{scenario1.low}</td></tr>
                  <tr className="border-b border-slate-100"><td className="py-1.5">적정 (적정 매수자 매칭)</td><td className="py-1.5 text-right font-semibold">{scenario1.mid}</td></tr>
                  <tr><td className="py-1.5">공격 (프리미엄 사옥 수요)</td><td className="py-1.5 text-right">{scenario1.high}</td></tr>
                </tbody>
              </table>
              <ul className="mt-3 space-y-1 text-[11px] text-slate-600">
                <li>✓ 매도 속도 빠름 (단일 거래)</li>
                <li>✗ 매수자 풀 좁음 (사옥 수요 한정)</li>
                <li>✗ 임대 NOI 부재 → cap rate 적용 불가, 매가 상한 제한</li>
              </ul>
            </Card>

            {/* 2안 — 분할 임대 */}
            <Card title="2안 · 분할 임대 후 매도" tone="primary">
              <p className="mb-3 text-[11.5px] text-slate-600">
                층별 임차 계획 + NOI 시뮬 → 매수자 풀 확장 (개인 자산가, 패밀리오피스, 임대법인 등 다수 페르소나)
              </p>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-primary-200 text-[10px] text-slate-500">
                    <th className="py-1 text-left">층</th>
                    <th className="py-1 text-right">평수</th>
                    <th className="py-1 text-left">임차 페르소나</th>
                    <th className="py-1 text-right">평당</th>
                    <th className="py-1 text-right">월세</th>
                  </tr>
                </thead>
                <tbody>
                  {SCENARIO_2_RENT.map((r) => (
                    <tr key={r.floor} className="border-b border-primary-50">
                      <td className="py-1 font-semibold">{r.floor}</td>
                      <td className="py-1 text-right text-slate-500">{r.pyeong}</td>
                      <td className="py-1 text-[10.5px] text-slate-700">{r.target}</td>
                      <td className="py-1 text-right">{r.payeongRent}만</td>
                      <td className="py-1 text-right font-semibold">{r.monthly.toLocaleString()}만</td>
                    </tr>
                  ))}
                  <tr className="bg-primary-50">
                    <td className="py-1.5 font-bold" colSpan={4}>월 임대수익 합계</td>
                    <td className="py-1.5 text-right font-bold text-primary-700">{monthlyRentSum.toLocaleString()}만</td>
                  </tr>
                </tbody>
              </table>
            </Card>
          </div>

          {/* NOI → 매가 시뮬 */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Card title="연 임대수익" tone="primary">
              <p className="text-[24px] font-black text-primary-700 number-display">{(annualRent / 10000).toFixed(1)}<span className="text-[14px] font-medium text-slate-500">억</span></p>
              <p className="text-[10.5px] text-slate-500">월 {monthlyRentSum.toLocaleString()}만 × 12개월</p>
            </Card>
            <Card title="NOI (운영비 8% 차감)" tone="primary">
              <p className="text-[24px] font-black text-primary-700 number-display">{noiEok.toFixed(1)}<span className="text-[14px] font-medium text-slate-500">억</span></p>
              <p className="text-[10.5px] text-slate-500">관리·세금·공실 가정</p>
            </Card>
            <Card title="총 사업비 가정" tone="slate">
              <p className="text-[24px] font-black text-slate-700 number-display">{ASSUMED.totalCost}<span className="text-[14px] font-medium text-slate-500">억</span></p>
              <p className="text-[10.5px] text-slate-500">매입가+공사비+금융비 (미팅 시 확정)</p>
            </Card>
          </div>

          {/* Cap rate 매가 시뮬 */}
          <Card className="mt-4">
            <h4 className="mb-2 text-[12px] font-semibold text-slate-700">2안 — Cap Rate 적용 매가 시뮬</h4>
            <div className="grid grid-cols-3 gap-2">
              {capScenarios.map((c) => (
                <div key={c.cap} className="rounded-lg bg-slate-50 px-4 py-3 text-center">
                  <p className="text-[10.5px] font-medium text-slate-500">{c.label}</p>
                  <p className="mt-0.5 text-[24px] font-black text-primary-700 number-display">{c.price}<span className="text-[12px] font-medium text-slate-500"> 억</span></p>
                  <p className="text-[10px] text-slate-500">사업비 대비 {Math.round(((c.price - ASSUMED.totalCost) / ASSUMED.totalCost) * 100)}% 차익</p>
                </div>
              ))}
            </div>
          </Card>
        </Section>

        {/* ━━━━━━ 6. 시나리오 비교 차트 ━━━━━━ */}
        <Section title="05. 시나리오 매가 비교" subtitle="1안 vs 2안 — 컨설팅이 만드는 격차">
          <Card>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={compareData} barCategoryGap={50}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="kind" tick={{ fill: "#475569", fontSize: 12 }} />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 11 }} unit=" 억" />
                <Tooltip
                  formatter={(v) => [`${v} 억`, ""]}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="보수" fill="#CBD5E1" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="보수" position="top" fontSize={10} fill="#475569" formatter={(v) => `${v}억`} />
                </Bar>
                <Bar dataKey="적정" fill="#6366F1" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="적정" position="top" fontSize={10} fill="#4338CA" formatter={(v) => `${v}억`} />
                </Bar>
                <Bar dataKey="공격" fill="#10B981" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="공격" position="top" fontSize={10} fill="#047857" formatter={(v) => `${v}억`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 flex items-center justify-center gap-6 text-[11px]">
              <Legend color="#CBD5E1" label="보수" />
              <Legend color="#6366F1" label="적정" />
              <Legend color="#10B981" label="공격" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-[11px] font-medium text-emerald-700">보수 시나리오 격차</p>
                <p className="mt-0.5 text-[20px] font-black text-emerald-700 number-display">+{upliftLow.toFixed(1)} 억</p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-[11px] font-medium text-emerald-700">공격 시나리오 격차</p>
                <p className="mt-0.5 text-[20px] font-black text-emerald-700 number-display">+{upliftHigh.toFixed(1)} 억</p>
              </div>
            </div>
            <p className="mt-3 text-center text-[12.5px] font-semibold text-slate-700">
              MD 전환 + NOI 시뮬 + 매수자 페르소나 매칭 = <span className="text-emerald-600">매가 +{Math.round(capScenarios[1].price - scenario1.mid)}억 ({Math.round(((capScenarios[1].price - scenario1.mid) / scenario1.mid) * 100)}%) 잠재력</span>
            </p>
          </Card>
        </Section>

        {/* ━━━━━━ 7. 컨설팅 패키지 ━━━━━━ */}
        <div className="print-break" />
        <Section title="06. 컨설팅 패키지 제안" subtitle="2~4주 · 500~1,000만원">
          <Card>
            <div className="grid grid-cols-4 gap-3">
              {[
                { wk: "Week 1", title: "정밀 진단", items: ["현장 답사 (메인/이면 입지 보정)", "인근 브랜드 분포 매핑", "직장·소득 데이터 보강"] },
                { wk: "Week 2", title: "MD 설계", items: ["층별 임차 페르소나 확정", "임대료 시뮬 검증", "LOI 후보 발굴 (네트워크)"] },
                { wk: "Week 3", title: "NOI·매가", items: ["NOI 산출 + 운영비 정밀화", "Cap rate 시나리오 3종", "사업 수익률 분석"] },
                { wk: "Week 4", title: "매도 패키지", items: ["매수자 페르소나별 자료", "매도 스토리북", "협상 전략 + Q&A 준비"] },
              ].map((w) => (
                <div key={w.wk} className="rounded-lg border border-primary-200 bg-primary-50/50 px-3 py-3">
                  <p className="text-[10px] font-bold text-primary-600">{w.wk}</p>
                  <p className="mt-0.5 text-[13px] font-bold text-slate-900">{w.title}</p>
                  <ul className="mt-2 space-y-1 text-[10.5px] text-slate-600">
                    {w.items.map((it, i) => <li key={i} className="leading-snug">· {it}</li>)}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg bg-slate-900 px-5 py-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-slate-300">최종 산출물</p>
                  <p className="mt-1 text-[13px] font-semibold">매수자별 매도 패키지 + 협상 자료</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-medium text-slate-300">컨설팅 비용</p>
                  <p className="mt-1 text-[20px] font-black text-amber-400 number-display">500–1,000만원</p>
                </div>
              </div>
              <p className="mt-3 border-t border-slate-700 pt-3 text-[11px] leading-relaxed text-slate-200">
                <span className="font-bold text-amber-300">매가 1% 차이만 만들어도 1억 이상 차익 (100억 기준).</span> 본 자료에서 제시한 격차 +{Math.round(capScenarios[1].price - scenario1.mid)}억 중 일부만 실현돼도 ROI 10배 이상.
              </p>
            </div>
          </Card>
        </Section>

        {/* ━━━━━━ 8. 차별화 ━━━━━━ */}
        <Section title="07. 본 컨설팅의 차별화" subtitle="일반 중개·감정·시공이 못 하는 영역">
          <div className="grid grid-cols-3 gap-3">
            <Diff
              n="01"
              title="데이터 기반"
              desc="92만 유동인구·559건 임대 실측·서울 7개 카테고리 벤치마크를 직접 분석. 자체 도구로 분기별 갱신."
            />
            <Diff
              n="02"
              title="임차사·시행 경험"
              desc="롯데 리테일 입점 전략 + 쿠시먼·브릭스 자문. 임차사가 어떤 자리를 선호하는지, 시행사가 어떻게 NOI를 만드는지 양쪽 시각."
            />
            <Diff
              n="03"
              title="매수자 시각"
              desc="단순 임대 자문이 아닌 매도용 패키지. 매수자가 cap rate 협상 시 보는 항목까지 사전 방어 자료 작성."
            />
          </div>
        </Section>

        {/* Footer */}
        <footer className="mt-8 border-t border-slate-200 pt-4 text-[10px] leading-relaxed text-slate-400">
          <p>
            <span className="font-semibold text-slate-600">데이터 출처</span>: 서울시 상권분석 통계 (2025 Q4) · 공공 임대 실거래 DB · 자체 시장 보정.
            방문자/임대 통계는 trdar 단위 평균이며 656-3 단독 수치는 1차 답사로 보정 예정.
          </p>
          <p className="mt-1">
            <span className="font-semibold text-slate-600">면책</span>: 본 자료의 매가·임대료·수익률은 시장 추정치이며 보증을 의미하지 않습니다.
            건물 면적·사업비·법적 제약 사항은 1차 미팅에서 확정 후 정밀 분석으로 갱신됩니다.
          </p>
          <p className="mt-2 flex items-center justify-between">
            <span>BRIX Commercial Real Estate Advisory</span>
            <span>강남구 신사동 656-3 · 1차 미팅 자료</span>
          </p>
        </footer>

        {/* Print / Action bar */}
        <div className="no-print mt-8 flex items-center justify-end gap-2">
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-slate-800 active:scale-95"
          >
            PDF로 저장 / 인쇄
          </button>
        </div>

      </div>
    </div>
  );
}

/* ── 보조 컴포넌트 ── */
function HeroStat({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-5 py-4">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-[28px] font-black ${color} number-display`}>{value}</p>
      <p className="mt-0.5 text-[10.5px] text-slate-500">{sub}</p>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-end justify-between border-b border-slate-200 pb-2">
        <h2 className="text-[18px] font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-[11px] font-medium text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Card({
  title, subTitle, children, tone = "default", className = "",
}: { title?: string; subTitle?: string; children: React.ReactNode; tone?: "default" | "primary" | "slate"; className?: string }) {
  const toneCls = tone === "primary"
    ? "border-primary-200 bg-primary-50/40"
    : tone === "slate"
    ? "border-slate-200 bg-slate-50/60"
    : "border-slate-200 bg-white";
  return (
    <div className={`rounded-xl border ${toneCls} px-5 py-4 ${className}`}>
      {title && (
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-[12.5px] font-semibold text-slate-700">{title}</h3>
          {subTitle && <span className="text-[10px] text-slate-500">{subTitle}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

function Row({ k, v, highlight = false }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-1.5 last:border-b-0">
      <span className="text-[11px] text-slate-500">{k}</span>
      <span className={`text-[12px] ${highlight ? "font-semibold text-primary-700" : "font-medium text-slate-800"}`}>{v}</span>
    </div>
  );
}

function Variable({ n, title, impact, desc }: { n: string; title: string; impact: string; desc: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-baseline gap-2">
        <span className="text-[20px] font-black text-primary-600">{n}</span>
        <span className="text-[13px] font-bold text-slate-900">{title}</span>
      </div>
      <p className="mt-1 text-[11px] font-semibold text-emerald-600">매가 영향 {impact}</p>
      <p className="mt-1 text-[11px] leading-snug text-slate-600">{desc}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-slate-600">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function Diff({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 px-5 py-4 text-white">
      <p className="text-[10px] font-bold tracking-widest text-amber-400">DIFF · {n}</p>
      <p className="mt-1 text-[14px] font-bold">{title}</p>
      <p className="mt-2 text-[11px] leading-snug text-slate-300">{desc}</p>
    </div>
  );
}
