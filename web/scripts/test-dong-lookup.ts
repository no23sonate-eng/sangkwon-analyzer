import { findDongByCoord, resolveDong, adjacentDongs } from "../lib/dong-lookup";

const cases = [
  { name: "한남동 중심", lat: 37.5350, lng: 127.0000 },
  { name: "한남동 726 인근", lat: 37.5374, lng: 127.0029 },
  { name: "강남역", lat: 37.4976, lng: 127.0278 },
  { name: "성수동 카페거리", lat: 37.5435, lng: 127.0540 },
  { name: "한강 위 (폴백)", lat: 37.5300, lng: 126.9950 },
];

for (const c of cases) {
  const exact = findDongByCoord(c.lat, c.lng);
  const resolved = resolveDong(c.lat, c.lng);
  console.log(`[${c.name}] (${c.lat}, ${c.lng})`);
  console.log(`  exact: ${exact ? exact.full_name + " (" + exact.dong_code + ")" : "OUTSIDE"}`);
  console.log(`  resolved: ${resolved.full_name}`);
}

const hannamCode = findDongByCoord(37.5350, 127.0000)?.dong_code;
if (hannamCode) {
  const adj = adjacentDongs(hannamCode, 5);
  console.log(`\n한남동(${hannamCode}) 인접 5개:`);
  adj.forEach((d) => console.log(`  - ${d.full_name}`));
}
