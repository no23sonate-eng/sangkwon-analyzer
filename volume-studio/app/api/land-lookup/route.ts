import { NextResponse } from "next/server";
import {
  parseGeocode, parseFeatures, outerRing, polygonMetrics,
  extractZoneName, zoneNameToKey, extractDistrictNames, parseHeightLimit,
  extractRoadInfo, parseElevation,
} from "@/lib/zoning/land-lookup";

/* ── 주소 → 필지 자동조회 (VWorld) ──
   GET /api/land-lookup?address=...
   반환: 좌표 · 필지 링(lng/lat) · 면적/북측폭/남북깊이 · 용도지역(zoneKey)
   필요 env: VWORLD_API_KEY — 해외 IP 차단이므로 국내 실행에서만 동작.
*/

const VW = "https://api.vworld.kr/req";
const VW_DOMAIN = process.env.VWORLD_DOMAIN ?? "localhost";

async function vw(path: string, params: Record<string, string>): Promise<unknown> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${VW}/${path}?${qs}`, {
    signal: AbortSignal.timeout(10_000),
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`VWorld HTTP ${res.status}`);
  return res.json();
}

export async function GET(request: Request) {
  const key = process.env.VWORLD_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "VWORLD_API_KEY 미설정 — volume-studio/.env.local 에 VWORLD_API_KEY=발급키 를 추가하고 재시작하세요." },
      { status: 400 },
    );
  }
  const address = new URL(request.url).searchParams.get("address")?.trim();
  if (!address) return NextResponse.json({ error: "address 파라미터가 필요합니다." }, { status: 400 });

  const warnings: string[] = [];
  try {
    // 1. 주소 → 좌표 (지번 → 도로명 폴백)
    let point = null as null | { lat: number; lng: number; refined?: string };
    for (const type of ["parcel", "road"]) {
      try {
        const g = await vw("address", {
          service: "address", request: "getcoord", version: "2.0", format: "json",
          crs: "epsg:4326", refine: "true", simple: "false", type, address, key,
        });
        point = parseGeocode(g);
        if (point) break;
      } catch { /* 다음 타입 */ }
    }
    if (!point) return NextResponse.json({ error: `주소를 찾지 못했습니다: "${address}"` }, { status: 404 });
    const pt = `POINT(${point.lng} ${point.lat})`;

    // 2. 연속지적도 필지 폴리곤
    let parcel: null | {
      areaM2: number; northWidthM: number; lotDepthM: number;
      jibun?: string; pnu?: string; ring: [number, number][];
    } = null;
    try {
      const pj = await vw("data", {
        service: "data", request: "GetFeature", data: "LP_PA_CBND_BUBUN",
        format: "json", crs: "EPSG:4326", geometry: "true", size: "1",
        geomFilter: pt, key, domain: VW_DOMAIN,
      });
      const feats = parseFeatures(pj);
      const ring = feats[0] ? outerRing(feats[0].geometry) : null;
      if (ring) {
        const m = polygonMetrics(ring);
        parcel = {
          areaM2: m.areaM2, northWidthM: m.northWidthM, lotDepthM: m.lotDepthM,
          jibun: (feats[0].properties.jibun as string) ?? undefined,
          pnu: (feats[0].properties.pnu as string) ?? undefined,
          ring,
        };
      }
    } catch { /* warning */ }
    if (!parcel) warnings.push("필지 폴리곤 조회 실패 — 면적·형상을 직접 입력하세요.");

    // 3. 용도지역
    let zoneName: string | null = null;
    let zoneKey: string | null = null;
    try {
      const zj = await vw("data", {
        service: "data", request: "GetFeature", data: "LT_C_UQ111",
        format: "json", crs: "EPSG:4326", geometry: "false", size: "5",
        geomFilter: pt, key, domain: VW_DOMAIN,
      });
      for (const f of parseFeatures(zj)) {
        const name = extractZoneName(f.properties);
        if (name && zoneNameToKey(name)) { zoneName = name; zoneKey = zoneNameToKey(name); break; }
        if (name && !zoneName) zoneName = name;
      }
    } catch { /* warning */ }
    if (!zoneKey) warnings.push(`용도지역 자동 매핑 실패${zoneName ? ` (조회값: ${zoneName})` : ""} — 직접 선택하세요.`);

    // 4. 규제 구역(용도지구·용도구역·지구단위계획) — 고도지구 높이 자동 파싱
    const districts: { layer: string; names: string[] }[] = [];
    for (const [layer, label] of [
      ["LT_C_UQ112", "용도지구(고도·경관 등)"],
      ["LT_C_UQ113", "용도구역"],
      ["LT_C_UPISUQ153", "지구단위계획구역"],
    ] as const) {
      try {
        const dj = await vw("data", {
          service: "data", request: "GetFeature", data: layer,
          format: "json", crs: "EPSG:4326", geometry: "false", size: "10",
          geomFilter: pt, key, domain: VW_DOMAIN,
        });
        const names = [...new Set(parseFeatures(dj).flatMap((f) => extractDistrictNames(f.properties)))];
        if (names.length) districts.push({ layer: label, names });
      } catch { /* 레이어별 실패 무시 */ }
    }
    const heightLimitM = parseHeightLimit(districts.flatMap((d) => d.names));

    // 5. 전면도로 자동 감지 — 인접 도로 폭(사선·접도 검토 입력)
    //    도로 레이어는 지역·버전별로 상이 → 여러 후보를 순차 시도(방어적).
    let road: { name?: string; widthM?: number } | null = null;
    for (const layer of ["LT_L_MOCTLINK", "LT_L_SPRD", "LT_C_UPISUQ161"]) {
      try {
        const rj = await vw("data", {
          service: "data", request: "GetFeature", data: layer,
          format: "json", crs: "EPSG:4326", geometry: "false", size: "5",
          buffer: "15", geomFilter: pt, key, domain: VW_DOMAIN,
        });
        for (const f of parseFeatures(rj)) {
          const info = extractRoadInfo(f.properties);
          if (info.name || info.widthM) {
            const prev: { name?: string; widthM?: number } = road ?? {};
            road = { name: info.name ?? prev.name, widthM: info.widthM ?? prev.widthM };
            if (road.widthM) break;
          }
        }
        if (road?.widthM) break;
      } catch { /* 레이어별 실패 무시 */ }
    }
    if (!road?.widthM) warnings.push("전면도로 폭 자동감지 실패 — 접도·사선 검토용으로 직접 입력하세요.");

    // 6. 대지 표고(도로 고저차 참고용) — DEM point elevation (best-effort)
    //    ※ 정밀 고저차는 현황측량 사항. 여기서는 개략 표고만 참고 제공.
    let elevationM: number | null = null;
    try {
      const ej = await vw("data", {
        service: "data", request: "GetFeature", data: "LT_P_DEM",
        format: "json", crs: "EPSG:4326", geometry: "false", size: "1",
        geomFilter: pt, key, domain: VW_DOMAIN,
      });
      elevationM = parseElevation(ej);
    } catch { /* DEM 미지원 무시 */ }

    return NextResponse.json({
      address, refined: point.refined ?? null,
      point: { lat: point.lat, lng: point.lng },
      parcel, zoneName, zoneKey, districts, heightLimitM,
      road, elevationM, warnings,
      source: "VWorld 연속지적도·용도지역(LT_C_UQ111)·도로",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `VWorld 조회 실패: ${msg}. 국내 네트워크·키·도메인(localhost) 등록을 확인하세요.` },
      { status: 502 },
    );
  }
}
