/* ============================================================
   Fetch wrapper for the FastAPI backend
   ============================================================ */

import type {
  GeocodeResult,
  TrdarItem,
  AnalysisData,
  StoreCountData,
} from "./types";

const BASE_URL = "";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/** Geocode an address string → { address, lat, lng } */
export function geocode(address: string): Promise<GeocodeResult> {
  return fetchJson<GeocodeResult>(
    `/api/geocode?address=${encodeURIComponent(address)}`
  );
}

/** Reverse geocode: lat/lng → address, gu, dong */
export interface ReverseGeocodeResult {
  address: string;
  lat: number;
  lng: number;
  gu: string;
  dong: string;
}

export function reverseGeocode(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult> {
  return fetchJson<ReverseGeocodeResult>(
    `/api/reverse-geocode?lat=${lat}&lng=${lng}`
  );
}

/** Find nearby 상권 by coordinate */
export function findNearbyTrdar(
  lat: number,
  lng: number,
  radius = 500
): Promise<TrdarItem[]> {
  return fetchJson<TrdarItem[]>(
    `/api/trdar/by-coord?lat=${lat}&lng=${lng}&radius=${radius}`
  );
}

/** Full analysis for a given 상권 code */
export function analyzeDistrict(
  trdarCd: string,
  lat: number,
  lng: number,
  radius = 300
): Promise<AnalysisData> {
  return fetchJson<AnalysisData>(
    `/api/analyze/${trdarCd}?lat=${lat}&lng=${lng}&radius=${radius}`
  );
}

/** Get store count breakdown for a 상권 */
export function getStoreCount(trdarCd: string): Promise<StoreCountData> {
  return fetchJson<StoreCountData>(`/api/store-count/${trdarCd}`);
}

/** Area-based analysis: aggregates data from ALL 상권 within radius */
export interface AreaAnalysisData extends AnalysisData {
  trdar_count: number;
  trdar_names: string[];
}

export function analyzeArea(
  lat: number,
  lng: number,
  radius: number
): Promise<AreaAnalysisData> {
  return fetchJson<AreaAnalysisData>(
    `/api/analyze-area?lat=${lat}&lng=${lng}&radius=${radius}`
  );
}

/** Search 상권 by keyword */
export interface TrdarSearchResult {
  trdar_cd: string;
  trdar_nm: string;
  keyword?: string;
  priority?: number;
  lat?: number;
  lng?: number;
}

export function searchTrdar(keyword: string): Promise<TrdarSearchResult[]> {
  return fetchJson<TrdarSearchResult[]>(
    `/api/trdar/search?keyword=${encodeURIComponent(keyword)}`
  );
}
