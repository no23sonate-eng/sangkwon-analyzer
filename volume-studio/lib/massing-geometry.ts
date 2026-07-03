/* ── 3D 매스 기하 헬퍼 ──

   필지 링(lng/lat) 또는 폭×깊이 직사각형을 로컬 미터 좌표(원점=중심)로 변환하고,
   층별 바닥면적(plateM2)에 맞춰 발자국 폴리곤을 만든다.

   - 균일 적층: 건폐율 발자국 = 필지 폴리곤을 면적비 sqrt 스케일로 축소(중심 기준)
   - 일조 계단 후퇴(stepped): 남측은 고정, 북측(y+)에서 깊이를 잘라내는
     반평면 클리핑 — 엔진의 "남측 배치 + 정북 후퇴" 가정과 일치
*/

export type Pt = [number, number]; // [x(m 동서), y(m 남북)]

/** lng/lat 링 → 로컬 미터 좌표(중심 원점, 등장방형 근사) */
export function ringToLocalMeters(ring: [number, number][]): Pt[] {
  const latAvg = ring.reduce((s, [, la]) => s + la, 0) / ring.length;
  const mLng = 111320 * Math.cos((latAvg * Math.PI) / 180);
  const mLat = 111320;
  const xs = ring.map(([lng]) => lng * mLng);
  const ys = ring.map(([, lat]) => lat * mLat);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return ring.map(([lng, lat]) => [lng * mLng - cx, lat * mLat - cy]);
}

/** 폭×깊이 직사각형 링 (중심 원점) */
export function rectRing(widthM: number, depthM: number): Pt[] {
  const w = widthM / 2, d = depthM / 2;
  return [[-w, -d], [w, -d], [w, d], [-w, d]];
}

export function ringArea(ring: Pt[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

/** 중심 기준 균일 스케일 → 목표 면적으로 축소 (건폐율 발자국) */
export function scaleToArea(ring: Pt[], targetM2: number): Pt[] {
  const a = ringArea(ring);
  if (a <= 0 || targetM2 >= a) return ring;
  const s = Math.sqrt(targetM2 / a);
  return ring.map(([x, y]) => [x * s, y * s]);
}

/** y ≤ yMax 반평면 클리핑 (Sutherland–Hodgman 1면) — 정북(y+) 후퇴 */
export function clipNorth(ring: Pt[], yMax: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < ring.length; i++) {
    const cur = ring[i];
    const nxt = ring[(i + 1) % ring.length];
    const inCur = cur[1] <= yMax;
    const inNxt = nxt[1] <= yMax;
    if (inCur) out.push(cur);
    if (inCur !== inNxt) {
      const t = (yMax - cur[1]) / (nxt[1] - cur[1]);
      out.push([cur[0] + (nxt[0] - cur[0]) * t, yMax]);
    }
  }
  return out;
}

/** 층별 발자국: 남측 고정, 북측을 잘라 목표 면적(이분법) — 일조 계단용 */
export function clipToAreaFromNorth(base: Pt[], targetM2: number): Pt[] {
  const full = ringArea(base);
  if (targetM2 >= full * 0.995) return base;
  const ys = base.map(([, y]) => y);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (ringArea(clipNorth(base, mid)) < targetM2) lo = mid; else hi = mid;
  }
  const r = clipNorth(base, (lo + hi) / 2);
  return r.length >= 3 ? r : base;
}
