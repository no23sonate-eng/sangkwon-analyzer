import { NextResponse } from 'next/server';
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, "reverse-geocode", 60, 60_000);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!lat || !lng) {
    return NextResponse.json(
      { error: 'lat and lng parameters are required' },
      { status: 400 }
    );
  }

  try {
    const kakaoRes = await fetch(
      `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${encodeURIComponent(lng)}&y=${encodeURIComponent(lat)}`,
      {
        headers: {
          Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}`,
        },
      }
    );

    if (!kakaoRes.ok) {
      return NextResponse.json(
        { error: 'Kakao API request failed' },
        { status: kakaoRes.status }
      );
    }

    const data = await kakaoRes.json();

    if (!data.documents || data.documents.length === 0) {
      return NextResponse.json(
        { error: 'No address found for the given coordinates' },
        { status: 404 }
      );
    }

    const doc = data.documents[0];
    const addr = doc.address;
    const road = doc.road_address;

    if (!addr && !road) {
      return NextResponse.json(
        { error: 'No address found for the given coordinates' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      address: addr?.address_name ?? road?.address_name ?? '',
      gu: addr?.region_2depth_name ?? road?.region_2depth_name ?? '',
      dong: addr?.region_3depth_name ?? road?.region_3depth_name ?? '',
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to reverse geocode coordinates' },
      { status: 500 }
    );
  }
}
