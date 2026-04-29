import { getDongLandPrice, inverseRentFromDongLand } from "../lib/dong-sale-data";
import { findDongByCoord } from "../lib/dong-lookup";

console.log("=== 동 단위 매매역산 검증 ===\n");

// 한남동 726-54 추정 좌표
const lat = 37.5374, lng = 127.0029;
const dong = findDongByCoord(lat, lng);
console.log(`한남동 726-54 좌표 (${lat}, ${lng}) → ${dong?.full_name} (${dong?.dong_code})`);

const guName = dong?.gu_name ?? "용산구";
const dongName = dong?.dong_name ?? "한남동";

// 동 단위 토지 평당가
const price = getDongLandPrice(guName, dongName, dong?.dong_code);
console.log(`\n[토지 평당가]`);
console.log(`  ${price?.detail}`);
console.log(`  값: ${price?.pricePerPyeong?.toLocaleString()} 만원/평 (대지)`);
console.log(`  source: ${price?.source}`);

// 캡레이트 3종 매매역산
console.log(`\n[매매역산 — 캡레이트별]`);
for (const cap of [4.5, 5.0, 5.5]) {
  const r = inverseRentFromDongLand(guName, dongName, dong?.dong_code, cap);
  console.log(`  cap ${cap}%: ${r?.rent} 만원/평/월 (대지 기준 평균값)`);
}

// 비교: 한남동 리포트 1층 가정값
console.log(`\n[참고] 한남동 리포트 1층 임대료 가정: 120 만원/평/월`);
console.log(`매매역산 평균값 × 1.5~2.0 = 1층 추정. 빌딩 평균 임대료 추정에 강함.\n`);

// 인접동 폴백 테스트 — 표본 적은 동 (예: 동빙고동)
console.log(`=== 인접동 폴백 테스트 (동빙고동 좌표) ===`);
const dbDong = findDongByCoord(37.5236, 126.9925);
console.log(`동빙고동 → ${dbDong?.full_name}`);
const dbPrice = getDongLandPrice(dbDong?.gu_name ?? "용산구", dbDong?.dong_name ?? "동빙고동", dbDong?.dong_code);
console.log(`  ${dbPrice?.detail ?? "데이터 없음"}`);
console.log(`  ${dbPrice?.pricePerPyeong} 만원/평, source=${dbPrice?.source}\n`);
