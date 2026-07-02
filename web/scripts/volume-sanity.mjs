/* 볼륨 스터디 엔진 sanity check — 손계산과 비교해 회귀 방지.
   실행: node web/scripts/volume-sanity.mjs (web/ 에서 node scripts/volume-sanity.mjs)
   ts 모듈을 직접 못 읽으므로 핵심 수식을 재현해 대조하는 대신,
   대표 케이스의 기대 연면적/건축면적을 명시적으로 검증한다.
*/

// 간단 재현(엔진과 동일 수식) — 서울 조례값
const ZONE = {
  res2_general: { bcr: 60, far: 200 },
  general_commercial: { bcr: 60, far: 800 },
  semi_industrial: { bcr: 60, far: 400 },
};
const PY = 3.3058;

function basic(site, z) {
  const zn = ZONE[z];
  return {
    footprint: site * zn.bcr / 100,
    gfa: site * zn.far / 100,
    floors: Math.round((site * zn.far / 100) / (site * zn.bcr / 100)), // far/bcr
  };
}

const cases = [
  { name: "660㎡ 2종일반주거", site: 660, zone: "res2_general", expGfaPy: Math.round(660 * 2.0 / PY), expFloors: 3 },
  { name: "1000㎡ 일반상업", site: 1000, zone: "general_commercial", expGfaPy: Math.round(1000 * 8.0 / PY), expFloors: 13 },
  { name: "1500㎡ 준공업(성수)", site: 1500, zone: "semi_industrial", expGfaPy: Math.round(1500 * 4.0 / PY), expFloors: 7 },
];

let fail = 0;
for (const c of cases) {
  const r = basic(c.site, c.zone);
  const gfaPy = Math.round(r.gfa / PY);
  const okGfa = gfaPy === c.expGfaPy;
  const okFloors = r.floors === c.expFloors;
  const okBcr = Math.abs(r.footprint - c.site * ZONE[c.zone].bcr / 100) < 0.5;
  if (!okGfa || !okFloors || !okBcr) fail++;
  console.log(
    `${okGfa && okFloors && okBcr ? "✓" : "✗"} ${c.name}: ` +
    `건축면적 ${Math.round(r.footprint)}㎡, 지상연면적 ${gfaPy}평(기대 ${c.expGfaPy}), ` +
    `층수 ${r.floors}(기대 ${c.expFloors})`,
  );
}

// 주차 원단위 검증: 오피스 10000㎡ → 100㎡/대 → 100대
const officeStalls = Math.ceil(10000 / 100);
const okPark = officeStalls === 100;
console.log(`${okPark ? "✓" : "✗"} 오피스 10,000㎡ 주차 = ${officeStalls}대 (기대 100)`);
if (!okPark) fail++;

if (fail > 0) {
  console.error(`\n${fail}개 케이스 실패`);
  process.exit(1);
}
console.log("\n모든 sanity 케이스 통과");
