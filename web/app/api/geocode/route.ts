import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json(
      { error: 'address parameter is required' },
      { status: 400 }
    );
  }

  // Try Kakao Local API first
  try {
    const kakaoRes = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`,
      {
        headers: {
          Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}`,
        },
      }
    );

    if (kakaoRes.ok) {
      const data = await kakaoRes.json();

      if (data.documents && data.documents.length > 0) {
        const first = data.documents[0];
        return NextResponse.json({
          address: first.address_name,
          lat: parseFloat(first.y),
          lng: parseFloat(first.x),
        });
      }
    }
  } catch {
    // Kakao failed, fall through to Nominatim
  }

  // Fallback to Nominatim
  try {
    const nominatimRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`,
      {
        headers: {
          'User-Agent': 'commercial-area-analyzer/1.0',
        },
      }
    );

    if (nominatimRes.ok) {
      const data = await nominatimRes.json();

      if (data.length > 0) {
        const first = data[0];
        return NextResponse.json({
          address: first.display_name,
          lat: parseFloat(first.lat),
          lng: parseFloat(first.lon),
        });
      }
    }
  } catch {
    // Nominatim also failed
  }

  return NextResponse.json(
    { error: 'Failed to geocode address' },
    { status: 404 }
  );
}
