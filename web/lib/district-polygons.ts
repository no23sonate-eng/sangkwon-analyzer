/* ── 주요 상권 실제 도로 기반 폴리곤 ──
   각 상권별 3개 zone(대로변/이면/배후) 폴리곤을 도로·블록 경계에 맞춰 정의
   좌표: [lng, lat] (GeoJSON 표준)
*/

export interface ZonePolygon {
  zone: "main" | "side" | "rear";
  label: string;
  coordinates: [number, number][][]; // GeoJSON Polygon coordinates
}

export interface DistrictPolygons {
  districtId: string;
  zones: ZonePolygon[];
}

const POLYGONS: Record<string, ZonePolygon[]> = {
  gangnam: [
    // 대로변: 강남대로 양쪽 ~50m (신논현~강남역~역삼역 구간)
    {
      zone: "main",
      label: "대로변",
      coordinates: [[
        [127.0258, 37.5055], // 신논현역 서측
        [127.0272, 37.5058], // 신논현역 동측
        [127.0285, 37.4990], // 강남역 동측
        [127.0295, 37.4940], // 역삼역 방면 동측
        [127.0285, 37.4935], // 역삼역 방면 서측
        [127.0275, 37.4985], // 강남역 서측
        [127.0258, 37.5055], // 닫기
      ]],
    },
    // 이면: 강남대로 뒤 1~2블록 (먹자골목, 사무실 밀집)
    {
      zone: "side",
      label: "이면",
      coordinates: [[
        // 서측 이면
        [127.0235, 37.5050],
        [127.0258, 37.5055],
        [127.0275, 37.4985],
        [127.0265, 37.4935],
        [127.0245, 37.4938],
        [127.0240, 37.4980],
        [127.0235, 37.5050],
      ]],
    },
    {
      zone: "side",
      label: "이면",
      coordinates: [[
        // 동측 이면 (테헤란로 방면)
        [127.0272, 37.5058],
        [127.0310, 37.5045],
        [127.0320, 37.4990],
        [127.0310, 37.4940],
        [127.0295, 37.4940],
        [127.0285, 37.4990],
        [127.0272, 37.5058],
      ]],
    },
    // 배후: 이면 뒤 주거전이지대
    {
      zone: "rear",
      label: "배후",
      coordinates: [[
        // 서측 배후
        [127.0210, 37.5048],
        [127.0235, 37.5050],
        [127.0240, 37.4980],
        [127.0245, 37.4938],
        [127.0225, 37.4935],
        [127.0215, 37.4975],
        [127.0210, 37.5048],
      ]],
    },
    {
      zone: "rear",
      label: "배후",
      coordinates: [[
        // 동측 배후
        [127.0310, 37.5045],
        [127.0345, 37.5035],
        [127.0350, 37.4985],
        [127.0340, 37.4935],
        [127.0310, 37.4940],
        [127.0320, 37.4990],
        [127.0310, 37.5045],
      ]],
    },
  ],

  hongdae: [
    // 대로변: 홍대 걷고싶은거리 + 양화로 메인
    {
      zone: "main",
      label: "대로변",
      coordinates: [[
        [126.9220, 37.5570], // 홍대입구역 북서
        [126.9265, 37.5575], // 홍대입구역 북동
        [126.9270, 37.5540], // 걷고싶은거리 동측
        [126.9250, 37.5515], // 남단 동측
        [126.9210, 37.5520], // 남단 서측
        [126.9205, 37.5555], // 서측
        [126.9220, 37.5570],
      ]],
    },
    // 이면: 골목 상권 (카페골목, 클럽거리 등)
    {
      zone: "side",
      label: "이면",
      coordinates: [[
        // 서교동 서측 골목
        [126.9170, 37.5565],
        [126.9205, 37.5570],
        [126.9205, 37.5555],
        [126.9210, 37.5520],
        [126.9180, 37.5510],
        [126.9165, 37.5540],
        [126.9170, 37.5565],
      ]],
    },
    {
      zone: "side",
      label: "이면",
      coordinates: [[
        // 동측 골목 (경의선 책거리 방면)
        [126.9265, 37.5575],
        [126.9300, 37.5570],
        [126.9310, 37.5545],
        [126.9295, 37.5515],
        [126.9270, 37.5540],
        [126.9265, 37.5575],
      ]],
    },
    // 배후: 주거전이지대 (연남동 진입부, 상수동 경계)
    {
      zone: "rear",
      label: "배후",
      coordinates: [[
        // 서측 배후 (서강대 방면)
        [126.9130, 37.5560],
        [126.9170, 37.5565],
        [126.9165, 37.5540],
        [126.9180, 37.5510],
        [126.9155, 37.5495],
        [126.9125, 37.5530],
        [126.9130, 37.5560],
      ]],
    },
    {
      zone: "rear",
      label: "배후",
      coordinates: [[
        // 북측 배후 (연남동 진입)
        [126.9190, 37.5585],
        [126.9250, 37.5595],
        [126.9265, 37.5575],
        [126.9220, 37.5570],
        [126.9205, 37.5570],
        [126.9190, 37.5585],
      ]],
    },
  ],

  seongsu: [
    {
      zone: "main",
      label: "대로변",
      coordinates: [[
        [127.0500, 37.5460], // 서울숲역 부근
        [127.0580, 37.5460],
        [127.0585, 37.5435],
        [127.0505, 37.5435],
        [127.0500, 37.5460],
      ]],
    },
    {
      zone: "side",
      label: "이면",
      coordinates: [[
        [127.0490, 37.5475],
        [127.0590, 37.5475],
        [127.0580, 37.5460],
        [127.0500, 37.5460],
        [127.0490, 37.5475],
      ]],
    },
    {
      zone: "side",
      label: "이면",
      coordinates: [[
        [127.0505, 37.5435],
        [127.0585, 37.5435],
        [127.0590, 37.5415],
        [127.0500, 37.5415],
        [127.0505, 37.5435],
      ]],
    },
    {
      zone: "rear",
      label: "배후",
      coordinates: [[
        [127.0480, 37.5490],
        [127.0600, 37.5490],
        [127.0590, 37.5475],
        [127.0490, 37.5475],
        [127.0480, 37.5490],
      ]],
    },
    {
      zone: "rear",
      label: "배후",
      coordinates: [[
        [127.0500, 37.5415],
        [127.0590, 37.5415],
        [127.0595, 37.5395],
        [127.0495, 37.5395],
        [127.0500, 37.5415],
      ]],
    },
  ],

  myeongdong: [
    {
      zone: "main",
      label: "대로변",
      coordinates: [[
        [126.9820, 37.5640],
        [126.9855, 37.5645],
        [126.9860, 37.5615],
        [126.9825, 37.5610],
        [126.9820, 37.5640],
      ]],
    },
    {
      zone: "side",
      label: "이면",
      coordinates: [[
        [126.9790, 37.5638],
        [126.9820, 37.5640],
        [126.9825, 37.5610],
        [126.9795, 37.5607],
        [126.9790, 37.5638],
      ]],
    },
    {
      zone: "side",
      label: "이면",
      coordinates: [[
        [126.9855, 37.5645],
        [126.9880, 37.5642],
        [126.9882, 37.5612],
        [126.9860, 37.5615],
        [126.9855, 37.5645],
      ]],
    },
    {
      zone: "rear",
      label: "배후",
      coordinates: [[
        [126.9770, 37.5635],
        [126.9790, 37.5638],
        [126.9795, 37.5607],
        [126.9775, 37.5603],
        [126.9770, 37.5635],
      ]],
    },
  ],
};

export function getDistrictPolygons(districtId: string): ZonePolygon[] | null {
  return POLYGONS[districtId] ?? null;
}

export function getDistrictPolygonGeoJSON(districtId: string, color: string) {
  const zones = POLYGONS[districtId];
  if (!zones) return null;

  const ZONE_STYLE = {
    main: { color: "#EF4444", opacity: 0.4, strokeWidth: 2.5, strokeOpacity: 0.9 },
    side: { color: "#F59E0B", opacity: 0.25, strokeWidth: 1.5, strokeOpacity: 0.7 },
    rear: { color: "#3B82F6", opacity: 0.12, strokeWidth: 1, strokeOpacity: 0.4 },
  };

  const features = zones.map((z, i) => ({
    type: "Feature" as const,
    properties: {
      zone: z.zone,
      label: z.label,
      fillColor: ZONE_STYLE[z.zone].color,
      fillOpacity: ZONE_STYLE[z.zone].opacity,
      strokeColor: ZONE_STYLE[z.zone].color,
      strokeWidth: ZONE_STYLE[z.zone].strokeWidth,
      strokeOpacity: ZONE_STYLE[z.zone].strokeOpacity,
    },
    geometry: {
      type: "Polygon" as const,
      coordinates: z.coordinates,
    },
  }));

  return { type: "FeatureCollection" as const, features };
}
