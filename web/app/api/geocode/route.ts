import { NextResponse } from 'next/server';
import { rateLimit } from "@/lib/rate-limit";

/**
 * Geocode a query string to coordinates.
 * Strategy:
 * 1) Kakao 주소 검색 (도로명/지번 주소 정확 매칭)
 * 2) Kakao 키워드 검색 (상호명/지역명/건물명)
 * 3) Kakao 주소 (부분 매칭)
 * 4) Nominatim (해외 or 최후 폴백)
 */
export async function GET(request: Request) {
  const limited = rateLimit(request, "geocode", 60, 60_000);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('address');

  if (!query) {
    return NextResponse.json({ error: 'address parameter is required' }, { status: 400 });
  }

  const apiKey = process.env.KAKAO_REST_API_KEY;
  const headers = { Authorization: `KakaoAK ${apiKey}` };

  // 1) Kakao 주소 검색 (도로명/지번)
  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=1`,
      { headers }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.documents?.length > 0) {
        const first = data.documents[0];
        return NextResponse.json({
          address: first.address_name,
          lat: parseFloat(first.y),
          lng: parseFloat(first.x),
          source: 'kakao-address',
        });
      }
    }
  } catch {}

  // 2) Kakao 키워드 검색 (서울 지역 우선)
  try {
    // 서울 중심 좌표 + 반경 20km로 제한해서 정확도 ↑
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&x=126.9780&y=37.5665&radius=20000&size=5&sort=accuracy`,
      { headers }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.documents?.length > 0) {
        // 서울 지역 결과 우선
        const seoulResult = data.documents.find((d: { address_name?: string }) =>
          d.address_name?.startsWith('서울')
        ) ?? data.documents[0];
        return NextResponse.json({
          address: seoulResult.address_name ?? seoulResult.place_name,
          lat: parseFloat(seoulResult.y),
          lng: parseFloat(seoulResult.x),
          source: 'kakao-keyword',
          place_name: seoulResult.place_name,
        });
      }
    }
  } catch {}

  // 3) Kakao 주소 검색 (전국 범위)
  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`,
      { headers }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.documents?.length > 0) {
        const first = data.documents[0];
        return NextResponse.json({
          address: first.address_name ?? first.place_name,
          lat: parseFloat(first.y),
          lng: parseFloat(first.x),
          source: 'kakao-keyword-wide',
        });
      }
    }
  } catch {}

  return NextResponse.json({ error: 'Failed to geocode address' }, { status: 404 });
}
