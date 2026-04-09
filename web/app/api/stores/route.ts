import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat") ?? "0";
  const lng = searchParams.get("lng") ?? "0";
  const radius = searchParams.get("radius") ?? "300";

  const apiKey = process.env.DATA_GO_KR_API_KEY;
  if (!apiKey) return NextResponse.json({ stores: [], total: 0, by_category: {}, by_subcategory: {} });

  const url = `https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius?ServiceKey=${apiKey}&pageNo=1&numOfRows=1000&radius=${radius}&cx=${lng}&cy=${lat}&type=json`;

  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    const json = await res.json();
    const items = json?.body?.items ?? [];

    const byCategory: Record<string, { count: number; ratio: number }> = {};
    const bySubcategory: Record<string, { count: number; ratio: number }> = {};
    const total = items.length || 1;

    for (const item of items) {
      const cat = item.indsLclsNm ?? "기타";
      const sub = item.indsMclsNm ?? item.indsLclsNm ?? "기타";
      byCategory[cat] = byCategory[cat] ?? { count: 0, ratio: 0 };
      byCategory[cat].count++;
      bySubcategory[sub] = bySubcategory[sub] ?? { count: 0, ratio: 0 };
      bySubcategory[sub].count++;
    }
    for (const v of Object.values(byCategory)) v.ratio = Math.round((v.count / total) * 100 * 10) / 10;
    for (const v of Object.values(bySubcategory)) v.ratio = Math.round((v.count / total) * 100 * 10) / 10;

    return NextResponse.json({
      stores: items.map((i: Record<string, string>) => ({
        name: i.bizesNm, category: i.indsLclsNm, subcategory: i.indsMclsNm,
        address: i.lnoAdr ?? i.rdnmAdr, lat: parseFloat(i.lat), lng: parseFloat(i.lon),
      })),
      total: items.length,
      by_category: byCategory,
      by_subcategory: bySubcategory,
    });
  } catch {
    return NextResponse.json({ stores: [], total: 0, by_category: {}, by_subcategory: {} });
  }
}
