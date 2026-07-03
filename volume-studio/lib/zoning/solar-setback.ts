/* ── 정북방향 일조권 사선제한 (건축법 시행령 §86②) ──

   전용주거·일반주거지역에서 건축물 각 부분을 정북방향 인접대지경계선으로부터
   아래 거리 이상 띄워야 한다(2023년 개정 반영):
     - 높이 10m 이하 부분: 1.5m 이상
     - 높이 10m 초과 부분: 해당 부분 높이의 1/2 이상

   대지 형상(북측 폭 W, 남북 깊이 D)이 주어지면 남측에 건물을 붙였다고 가정하고
   층별로 쌓아 올리며 정북 사선 안에 들어오는 봉투(envelope) 연면적을 계산한다.
   대지 형상이 없으면 정북일조를 적용할 수 없으므로 경고만 반환한다(면적 미감소).

   ⚠ 한계: 실제 대지는 부정형·경사·2면 이상 도로 접함 등으로 결과가 달라진다.
   본 계산은 직사각형 대지 + 남측 배치 가정의 개략 봉투이며 인허가 도서가 아니다.
*/

const NORTH_LOW_HEIGHT = 10; // m — 이 높이 이하는 1.5m 이격
const NORTH_LOW_SETBACK = 1.5; // m

export interface SolarInput {
  northLotWidthM: number; // 대지 동서 폭 (정북경계선 길이)
  lotDepthM: number; // 대지 남북 깊이
  groundFloorHeightM: number;
  floorHeightM: number;
  footprintCapM2: number; // 건폐율로 정해진 층별 최대 바닥면적
  farGfaM2: number; // 용적률로 정해진 지상 연면적 상한
  sideSetbackM?: number; // 좌우 대지안의 공지 (기본 1m씩)
  southSetbackM?: number; // 남측 대지안의 공지 (기본 1m)
  maxFloors?: number;
}

export interface SolarResult {
  applied: true;
  floors: number;
  gfaM2: number; // 일조 봉투 안에서 확보되는 지상 연면적
  limitedBySolar: boolean; // 용적률 상한보다 봉투가 작아 감소가 발생했는지
  buildingHeightM: number;
  floorFootprints: number[]; // 층별 바닥면적 (하부→상부)
}

export interface SolarSkipped {
  applied: false;
  reason: string;
}

export function solarEnvelope(input: SolarInput): SolarResult {
  const side = input.sideSetbackM ?? 1;
  const south = input.southSetbackM ?? 1;
  const maxFloors = input.maxFloors ?? 60;

  const usableWidth = Math.max(0, input.northLotWidthM - side * 2);

  const floorFootprints: number[] = [];
  let cumHeight = 0;
  let totalGfa = 0;
  let limitedBySolar = false;

  for (let k = 0; k < maxFloors; k++) {
    const thisFloorHeight = k === 0 ? input.groundFloorHeightM : input.floorHeightM;
    const floorTop = cumHeight + thisFloorHeight;

    // 해당 층 상단 높이 기준 정북 이격거리
    const northSetback =
      floorTop <= NORTH_LOW_HEIGHT ? NORTH_LOW_SETBACK : floorTop / 2;

    // 남측에 붙였을 때 정북 사선 안에서 확보되는 남북 깊이
    const depthK = input.lotDepthM - south - northSetback;
    if (depthK <= 0) break; // 더 이상 층을 올릴 공간 없음

    let footK = Math.min(usableWidth * depthK, input.footprintCapM2);
    if (footK <= 0) break;

    // 용적률 상한 도달 시 마지막 층은 잔여만
    if (totalGfa + footK >= input.farGfaM2) {
      footK = input.farGfaM2 - totalGfa;
      if (footK > 0) {
        floorFootprints.push(footK);
        totalGfa += footK;
        cumHeight = floorTop;
      }
      break;
    }

    // 정북 사선 때문에 건폐율 footprint보다 작아지면 일조 제약 발생으로 표시
    if (usableWidth * depthK < input.footprintCapM2 - 0.5) limitedBySolar = true;

    floorFootprints.push(footK);
    totalGfa += footK;
    cumHeight = floorTop;
  }

  return {
    applied: true,
    floors: floorFootprints.length,
    gfaM2: Math.round(totalGfa),
    limitedBySolar,
    buildingHeightM: Math.round(cumHeight * 10) / 10,
    floorFootprints: floorFootprints.map((f) => Math.round(f)),
  };
}
