"use client";

import { useCallback, useRef, useEffect, useMemo, useState } from "react";
import MapGL, {
  Marker,
  Source,
  Layer,
  NavigationControl,
  type MapRef,
  type MapMouseEvent,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { useAnalysisStore } from "@/store/analysisStore";
import { findNearbyTrdar, analyzeArea, getStoreCount, reverseGeocode } from "@/lib/api";
import { palette, getCategoryColor } from "@/lib/colors";
import {
  getTrafficHeatmap, getSalesHeatmap,
  getOpenHeatmap, getCloseHeatmap,
} from "@/lib/heatmap-data";

// ── Vworld 한국 정부 지도 ──
const MAP_STYLE = {
  version: 8 as const,
  sources: {
    vworld: {
      type: "raster" as const,
      tiles: ["https://xdworld.vworld.kr/2d/Base/service/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© Vworld",
      maxzoom: 19,
    },
  },
  layers: [
    { id: "vworld-tiles", type: "raster" as const, source: "vworld", minzoom: 0, maxzoom: 19 },
  ],
};

/** 좌표 + 반경(m)으로 원형 GeoJSON */
function makeCircle(lat: number, lng: number, radiusM: number, n = 64) {
  const coords: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = (2 * Math.PI * i) / n;
    const dLat = (radiusM / 111320) * Math.cos(a);
    const dLng = (radiusM / (111320 * Math.cos((lat * Math.PI) / 180))) * Math.sin(a);
    coords.push([lng + dLng, lat + dLat]);
  }
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [coords] },
  };
}

export default function MapContainer() {
  const mapRef = useRef<MapRef>(null);

  const viewState = useAnalysisStore((s) => s.viewState);
  const setViewState = useAnalysisStore((s) => s.setViewState);
  const setClicked = useAnalysisStore((s) => s.setClicked);
  const setClickedAddress = useAnalysisStore((s) => s.setClickedAddress);
  const setNearbyList = useAnalysisStore((s) => s.setNearbyList);
  const setSelectedTrdar = useAnalysisStore((s) => s.setSelectedTrdar);
  const setAnalysisData = useAnalysisStore((s) => s.setAnalysisData);
  const setStoreCountData = useAnalysisStore((s) => s.setStoreCountData);
  const setPanelOpen = useAnalysisStore((s) => s.setPanelOpen);
  const setLoading = useAnalysisStore((s) => s.setLoading);
  const selectedTrdar = useAnalysisStore((s) => s.selectedTrdar);
  const nearbyList = useAnalysisStore((s) => s.nearbyList);
  const analysisData = useAnalysisStore((s) => s.analysisData);
  const clickedLat = useAnalysisStore((s) => s.clickedLat);
  const clickedLng = useAnalysisStore((s) => s.clickedLng);
  const radius = useAnalysisStore((s) => s.radius);
  const highlightCategory = useAnalysisStore((s) => s.highlightCategory);
  const heatmapOn = useAnalysisStore((s) => s.heatmapOn);
  const heatmapType = useAnalysisStore((s) => s.heatmapType);
  const heatmapTimeSlot = useAnalysisStore((s) => s.heatmapTimeSlot);
  const showStoreMarkers = useAnalysisStore((s) => s.showStoreMarkers);
  const showDistrictBounds = useAnalysisStore((s) => s.showDistrictBounds);
  const hoveredTrdar = useAnalysisStore((s) => s.hoveredTrdar);
  const setHoveredTrdar = useAnalysisStore((s) => s.setHoveredTrdar);

  // ── 반경 원 GeoJSON ──
  const circleGeoJSON = useMemo(() => {
    if (clickedLat == null || clickedLng == null) return null;
    return { type: "FeatureCollection" as const, features: [makeCircle(clickedLat, clickedLng, radius)] };
  }, [clickedLat, clickedLng, radius]);

  // ── 히트맵 GeoJSON (선택 상권 반경 내 로컬 정규화) ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [openHeatGeoJSON, setOpenHeatGeoJSON] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [closeHeatGeoJSON, setCloseHeatGeoJSON] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [trafficHeatGeoJSON, setTrafficHeatGeoJSON] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [salesHeatGeoJSON, setSalesHeatGeoJSON] = useState<any>(null);

  // 히트맵 반경: 선택 반경의 2배 (더 넓은 범위)
  const heatRadius = Math.max(radius * 2, 1000);

  useEffect(() => {
    if (!heatmapOn || clickedLat == null || clickedLng == null) {
      setOpenHeatGeoJSON(null);
      setCloseHeatGeoJSON(null);
      setTrafficHeatGeoJSON(null);
      setSalesHeatGeoJSON(null);
      return;
    }

    const lat = clickedLat;
    const lng = clickedLng;
    const r = heatRadius;

    if (heatmapType === "openclose") {
      getOpenHeatmap(lat, lng, r).then(setOpenHeatGeoJSON);
      getCloseHeatmap(lat, lng, r).then(setCloseHeatGeoJSON);
      setTrafficHeatGeoJSON(null);
      setSalesHeatGeoJSON(null);
    } else if (heatmapType === "traffic") {
      getTrafficHeatmap(lat, lng, r).then(setTrafficHeatGeoJSON);
      setOpenHeatGeoJSON(null);
      setCloseHeatGeoJSON(null);
      setSalesHeatGeoJSON(null);
    } else if (heatmapType === "sales") {
      getSalesHeatmap(lat, lng, r).then(setSalesHeatGeoJSON);
      setOpenHeatGeoJSON(null);
      setCloseHeatGeoJSON(null);
      setTrafficHeatGeoJSON(null);
    }
  }, [heatmapOn, heatmapType, clickedLat, clickedLng, heatRadius]);

  // ── 점포 마커 GeoJSON (업종 필터 + 클러스터링용) ──
  const storeGeoJSON = useMemo(() => {
    const stores = analysisData?.stores;
    if (!stores?.length) return null;
    const features = stores
      .filter((s) => s["위도"] && s["경도"])
      .map((s) => ({
        type: "Feature" as const,
        properties: {
          category: String(s["대분류명"] ?? "기타"),
          name: String(s["상호명"] ?? ""),
          sub: String(s["중분류명"] ?? ""),
        },
        geometry: {
          type: "Point" as const,
          coordinates: [Number(s["경도"]), Number(s["위도"])],
        },
      }));
    return { type: "FeatureCollection" as const, features };
  }, [analysisData]);

  // ── 상권 경계 폴리곤 GeoJSON ──
  const districtGeoJSON = useMemo(() => {
    if (!nearbyList.length) return null;
    const features = nearbyList
      .filter((d) => d.lat != null && d.lng != null)
      .map((d) => ({
        type: "Feature" as const,
        properties: {
          trdar_cd: d.trdar_cd,
          trdar_nm: d.trdar_nm,
          distance: d.distance ?? 0,
        },
        geometry: {
          type: "Polygon" as const,
          // 상권 영역을 ~150m 반경 원으로 근사
          coordinates: [
            Array.from({ length: 33 }, (_, i) => {
              const a = (2 * Math.PI * i) / 32;
              const r = 150;
              return [
                (d.lng ?? 0) + (r / (111320 * Math.cos(((d.lat ?? 0) * Math.PI) / 180))) * Math.sin(a),
                (d.lat ?? 0) + (r / 111320) * Math.cos(a),
              ];
            }),
          ],
        },
      }));
    return { type: "FeatureCollection" as const, features };
  }, [nearbyList]);

  // ── 분석 로드 ──
  const loadAnalysis = useCallback(
    async (lat: number, lng: number, r: number) => {
      setLoading(true);
      try {
        reverseGeocode(lat, lng)
          .then((res) => setClickedAddress(res.address, res.gu, res.dong))
          .catch(() => setClickedAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`, "", ""));

        const list = await findNearbyTrdar(lat, lng, Math.max(r, 500));
        setNearbyList(list);

        if (list.length > 0) {
          const closest = list[0];
          setSelectedTrdar(closest);
          setPanelOpen(true);
          const [analysis, stores] = await Promise.all([
            analyzeArea(lat, lng, r),
            getStoreCount(closest.trdar_cd),
          ]);
          setAnalysisData(analysis);
          setStoreCountData(stores);
        } else {
          setSelectedTrdar(null);
          setAnalysisData(null);
          setStoreCountData(null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setClickedAddress, setNearbyList, setSelectedTrdar, setPanelOpen, setAnalysisData, setStoreCountData],
  );

  // ── 그리기 모드 ──
  const drawMode = useAnalysisStore((s) => s.drawMode);
  const setDrawMode = useAnalysisStore((s) => s.setDrawMode);
  const [drawStart, setDrawStart] = useState<{ lat: number; lng: number } | null>(null);
  const [drawRadius, setDrawRadius] = useState(0);
  const [drawing, setDrawing] = useState(false);

  // 그리기 중 원 GeoJSON
  const drawCircleGeoJSON = useMemo(() => {
    if (!drawStart || drawRadius <= 0) return null;
    return { type: "FeatureCollection" as const, features: [makeCircle(drawStart.lat, drawStart.lng, drawRadius)] };
  }, [drawStart, drawRadius]);

  // 거리 계산 (두 좌표 간 미터)
  const calcDist = useCallback((lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  // 그리기 모드 이벤트
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || drawMode === "none") return;

    map.getCanvas().style.cursor = "crosshair";

    const onMouseDown = (e: maplibregl.MapMouseEvent) => {
      e.preventDefault();
      const { lat, lng } = e.lngLat;
      setDrawStart({ lat, lng });
      setDrawing(true);
      setDrawRadius(0);
      map.dragPan.disable();
    };

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (!drawing) return;
      const start = useAnalysisStore.getState();
      const ds = drawStart;
      if (!ds) return;
      const dist = calcDist(ds.lat, ds.lng, e.lngLat.lat, e.lngLat.lng);
      // 스냅: 150, 300, 500, 1000m
      const snaps = [150, 300, 500, 1000];
      const snapped = snaps.find((s) => Math.abs(dist - s) < 30) ?? Math.round(dist);
      setDrawRadius(snapped);
    };

    const onMouseUp = () => {
      if (!drawing || !drawStart || drawRadius < 50) {
        setDrawing(false);
        return;
      }
      setDrawing(false);
      map.dragPan.enable();
      map.getCanvas().style.cursor = "";

      // 분석 실행
      const { lat, lng } = drawStart;
      const store = useAnalysisStore.getState();
      store.setClicked(lat, lng);
      store.setRadius(drawRadius);
      store.setDrawMode("none");
      loadAnalysis(lat, lng, drawRadius);

      // 초기화
      setDrawStart(null);
      setDrawRadius(0);
    };

    map.on("mousedown", onMouseDown);
    map.on("mousemove", onMouseMove);
    map.on("mouseup", onMouseUp);

    return () => {
      map.off("mousedown", onMouseDown);
      map.off("mousemove", onMouseMove);
      map.off("mouseup", onMouseUp);
      map.dragPan.enable();
      map.getCanvas().style.cursor = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawMode, drawing, drawStart, drawRadius, calcDist, loadAnalysis]);

  const handleMapClick = useCallback(
    async (e: MapMouseEvent) => {
      // 그리기 모드에서는 클릭 무시 (mousedown/up 으로 처리)
      if (drawMode !== "none") return;
      const { lng, lat } = e.lngLat;
      setClicked(lat, lng);
      setPanelOpen(false);
      await loadAnalysis(lat, lng, radius);
    },
    [drawMode, setClicked, setPanelOpen, loadAnalysis, radius],
  );

  useEffect(() => {
    const { clickedLat: lat, clickedLng: lng } = useAnalysisStore.getState();
    if (lat != null && lng != null) loadAnalysis(lat, lng, radius);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius]);

  useEffect(() => {
    if (selectedTrdar && mapRef.current) {
      const lat = selectedTrdar.lat ?? clickedLat;
      const lng = selectedTrdar.lng ?? clickedLng;
      if (lat != null && lng != null) {
        mapRef.current.flyTo({ center: [lng, lat], zoom: 15, duration: 800 });
      }
    }
  }, [selectedTrdar, clickedLat, clickedLng]);


  // ── 클러스터 클릭 줌인 ──
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const onClick = (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ["store-clusters"] });
      if (features.length > 0) {
        const clusterId = features[0].properties?.cluster_id;
        const source = map.getSource("store-data") as maplibregl.GeoJSONSource | undefined;
        if (source && clusterId != null) {
          source.getClusterExpansionZoom(clusterId).then((zoom) => {
            const coords = (features[0].geometry as GeoJSON.Point).coordinates;
            map.easeTo({ center: [coords[0], coords[1]], zoom: zoom + 1 });
          });
        }
      }
    };

    map.on("click", "store-clusters", onClick);
    return () => { map.off("click", "store-clusters", onClick); };
  }, [storeGeoJSON]);

  // 업종 필터 표현식
  const storeOpacityExpr: maplibregl.ExpressionSpecification = highlightCategory
    ? ["case", ["==", ["get", "category"], highlightCategory], 1, 0.15]
    : ["literal", 0.85];

  return (
    <MapGL
      ref={mapRef}
      {...viewState}
      onMove={(evt) => setViewState(evt.viewState)}
      onClick={handleMapClick}
      mapStyle={MAP_STYLE}
      style={{ width: "100%", height: "100%" }}
      attributionControl={false}
    >
      <NavigationControl position="bottom-right" />

      {/* ── 개업 히트맵 (파란색 — 활기) ── */}
      {openHeatGeoJSON && (
        <Source id="open-heatmap" type="geojson" data={openHeatGeoJSON}>
          <Layer
            id="open-heatmap-layer"
            type="heatmap"
            paint={{
              "heatmap-weight": ["get", "intensity"],
              "heatmap-intensity": [
                "interpolate", ["linear"], ["zoom"],
                8, 1.2, 11, 2.5, 14, 4.0, 17, 5.0,
              ],
              "heatmap-radius": [
                "interpolate", ["linear"], ["zoom"],
                8, 40, 11, 70, 14, 100, 17, 130,
              ],
              "heatmap-opacity": [
                "interpolate", ["linear"], ["zoom"],
                8, 0.85, 14, 0.7, 17, 0.55,
              ],
              "heatmap-color": [
                "interpolate", ["linear"], ["heatmap-density"],
                0, "rgba(59,130,246,0)",
                0.1, "rgba(59,130,246,0.1)",
                0.25, "rgba(59,130,246,0.25)",
                0.4, "rgba(37,99,235,0.4)",
                0.6, "rgba(37,99,235,0.55)",
                0.8, "rgba(29,78,216,0.7)",
                1, "rgba(29,78,216,0.85)",
              ],
            }}
          />
        </Source>
      )}

      {/* ── 폐업 히트맵 (빨간색 — 침체) ── */}
      {closeHeatGeoJSON && (
        <Source id="close-heatmap" type="geojson" data={closeHeatGeoJSON}>
          <Layer
            id="close-heatmap-layer"
            type="heatmap"
            paint={{
              "heatmap-weight": ["get", "intensity"],
              "heatmap-intensity": [
                "interpolate", ["linear"], ["zoom"],
                8, 1.2, 11, 2.5, 14, 4.0, 17, 5.0,
              ],
              "heatmap-radius": [
                "interpolate", ["linear"], ["zoom"],
                8, 40, 11, 70, 14, 100, 17, 130,
              ],
              "heatmap-opacity": [
                "interpolate", ["linear"], ["zoom"],
                8, 0.85, 14, 0.7, 17, 0.55,
              ],
              "heatmap-color": [
                "interpolate", ["linear"], ["heatmap-density"],
                0, "rgba(239,68,68,0)",
                0.1, "rgba(239,68,68,0.1)",
                0.25, "rgba(239,68,68,0.25)",
                0.4, "rgba(220,38,38,0.4)",
                0.6, "rgba(220,38,38,0.55)",
                0.8, "rgba(185,28,28,0.7)",
                1, "rgba(185,28,28,0.85)",
              ],
            }}
          />
        </Source>
      )}

      {/* ── 유동인구 히트맵 (초록~빨강) ── */}
      {trafficHeatGeoJSON && (
        <Source id="traffic-heatmap" type="geojson" data={trafficHeatGeoJSON}>
          <Layer
            id="traffic-heatmap-layer"
            type="heatmap"
            paint={{
              "heatmap-weight": ["get", "intensity"],
              "heatmap-intensity": [
                "interpolate", ["linear"], ["zoom"],
                8, 1.2, 11, 2.5, 14, 4.0, 17, 5.0,
              ],
              "heatmap-radius": [
                "interpolate", ["linear"], ["zoom"],
                8, 40, 11, 70, 14, 100, 17, 130,
              ],
              "heatmap-opacity": [
                "interpolate", ["linear"], ["zoom"],
                8, 0.85, 14, 0.7, 17, 0.55,
              ],
              "heatmap-color": [
                "interpolate", ["linear"], ["heatmap-density"],
                0, "rgba(0,0,0,0)",
                0.15, "rgba(34,197,94,0.3)",
                0.3, "rgba(234,179,8,0.45)",
                0.5, "rgba(249,115,22,0.6)",
                0.7, "rgba(239,68,68,0.75)",
                1, "rgba(185,28,28,0.9)",
              ],
            }}
          />
        </Source>
      )}

      {/* ── 매출 히트맵 (초록~빨강) ── */}
      {salesHeatGeoJSON && (
        <Source id="sales-heatmap" type="geojson" data={salesHeatGeoJSON}>
          <Layer
            id="sales-heatmap-layer"
            type="heatmap"
            paint={{
              "heatmap-weight": ["get", "intensity"],
              "heatmap-intensity": [
                "interpolate", ["linear"], ["zoom"],
                8, 1.2, 11, 2.5, 14, 4.0, 17, 5.0,
              ],
              "heatmap-radius": [
                "interpolate", ["linear"], ["zoom"],
                8, 40, 11, 70, 14, 100, 17, 130,
              ],
              "heatmap-opacity": [
                "interpolate", ["linear"], ["zoom"],
                8, 0.85, 14, 0.7, 17, 0.55,
              ],
              "heatmap-color": [
                "interpolate", ["linear"], ["heatmap-density"],
                0, "rgba(0,0,0,0)",
                0.15, "rgba(34,197,94,0.3)",
                0.3, "rgba(234,179,8,0.45)",
                0.5, "rgba(249,115,22,0.6)",
                0.7, "rgba(239,68,68,0.75)",
                1, "rgba(185,28,28,0.9)",
              ],
            }}
          />
        </Source>
      )}

      {/* 상권 경계 폴리곤 제거됨 */}

      {/* ── 점포 마커 (클러스터링) ── */}
      {showStoreMarkers && storeGeoJSON && (
        <Source
          id="store-data"
          type="geojson"
          data={storeGeoJSON}
          cluster={true}
          clusterMaxZoom={16}
          clusterRadius={40}
        >
          {/* 클러스터 원 */}
          <Layer
            id="store-clusters"
            type="circle"
            filter={["has", "point_count"]}
            paint={{
              "circle-color": "#FFFFFF",
              "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 50, 26],
              "circle-stroke-width": 2.5,
              "circle-stroke-color": "#6366F1",
              "circle-opacity": 0.95,
            }}
          />
          {/* 클러스터 숫자 */}
          <Layer
            id="store-cluster-count"
            type="symbol"
            filter={["has", "point_count"]}
            layout={{
              "text-field": "{point_count_abbreviated}",
              "text-size": 12,
              "text-font": ["Open Sans Bold"],
            }}
            paint={{ "text-color": "#4F46E5" }}
          />
          {/* 개별 점포 마커 */}
          <Layer
            id="store-unclustered"
            type="circle"
            filter={["!", ["has", "point_count"]]}
            paint={{
              "circle-radius": 5,
              "circle-color": [
                "match",
                ["get", "category"],
                "음식", getCategoryColor("음식"),
                "소매", getCategoryColor("소매"),
                "생활서비스", getCategoryColor("생활서비스"),
                "학문/교육", getCategoryColor("학문/교육"),
                "숙박", getCategoryColor("숙박"),
                "부동산", getCategoryColor("부동산"),
                "스포츠", getCategoryColor("스포츠"),
                "#94A3B8",
              ],
              "circle-opacity": storeOpacityExpr,
              "circle-stroke-width": 1,
              "circle-stroke-color": "#FFFFFF",
              "circle-stroke-opacity": storeOpacityExpr,
            }}
          />
        </Source>
      )}

      {/* ── 그리기 중 원 (드래그 중 표시) ── */}
      {drawCircleGeoJSON && (
        <Source id="draw-circle" type="geojson" data={drawCircleGeoJSON}>
          <Layer id="draw-circle-fill" type="fill" paint={{ "fill-color": "#6366F1", "fill-opacity": 0.1 }} />
          <Layer id="draw-circle-line" type="line" paint={{ "line-color": "#6366F1", "line-width": 2.5, "line-dasharray": [3, 2] }} />
        </Source>
      )}
      {/* 그리기 중 반경 표시 */}
      {drawStart && drawRadius > 0 && (
        <Marker latitude={drawStart.lat + drawRadius / 111320} longitude={drawStart.lng} anchor="bottom">
          <div className="rounded-full bg-primary-600 px-2.5 py-1 text-[12px] font-bold text-white shadow-lg">
            {drawRadius >= 1000 ? `${(drawRadius / 1000).toFixed(1)}km` : `${drawRadius}m`}
          </div>
        </Marker>
      )}

      {/* ── 반경 원 ── */}
      {circleGeoJSON && (
        <Source id="radius-circle" type="geojson" data={circleGeoJSON}>
          <Layer id="radius-fill" type="fill" paint={{ "fill-color": palette.orange, "fill-opacity": 0.06 }} />
          <Layer id="radius-line" type="line" paint={{ "line-color": palette.orange, "line-width": 2, "line-opacity": 0.45, "line-dasharray": [4, 3] }} />
        </Source>
      )}

      {/* ── 반경 라벨 ── */}
      {clickedLat != null && clickedLng != null && (
        <Marker latitude={clickedLat + radius / 111320} longitude={clickedLng} anchor="bottom">
          <div className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "rgba(255,255,255,0.92)", color: palette.orange, border: `1px solid ${palette.orange}40`, boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
            반경 {radius}m
          </div>
        </Marker>
      )}

      {/* ── 중심점 ── */}
      {clickedLat != null && clickedLng != null && (
        <Marker latitude={clickedLat} longitude={clickedLng} anchor="center">
          <div className="relative flex items-center justify-center">
            <div className="absolute h-8 w-8 animate-ping rounded-full" style={{ background: palette.orange, opacity: 0.2 }} />
            <div className="relative z-10 rounded-full border-[2.5px] border-white" style={{ width: 14, height: 14, background: palette.orange, boxShadow: "0 0 10px rgba(248,138,74,0.5)" }} />
          </div>
        </Marker>
      )}

      {/* 상권 마커 제거됨 */}


      {/* ── 히트맵 범례 + 안내 ── */}
      {heatmapOn && (
        <div className="absolute bottom-6 left-4 z-10 rounded-xl bg-white/90 px-4 py-3 shadow-lg backdrop-blur-sm">
          {clickedLat == null ? (
            <p className="text-[12px] text-gray-500">
              지도를 클릭하면 해당 상권의 히트맵이 표시됩니다
            </p>
          ) : heatmapType === "openclose" ? (
            <>
              <p className="mb-2 text-[11px] font-semibold text-gray-700">개폐업 히트맵 · 반경 {(heatRadius/1000).toFixed(1)}km</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-8 rounded-full" style={{ background: "linear-gradient(to right, rgba(59,130,246,0.2), rgba(29,78,216,0.8))" }} />
                  <span className="text-[10px] text-gray-600">개업 활발</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-8 rounded-full" style={{ background: "linear-gradient(to right, rgba(239,68,68,0.2), rgba(185,28,28,0.8))" }} />
                  <span className="text-[10px] text-gray-600">폐업 집중</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="mb-2 text-[11px] font-semibold text-gray-700">
                {heatmapType === "traffic" ? "유동인구" : "매출"} 히트맵 · 반경 {(heatRadius/1000).toFixed(1)}km
              </p>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-500">낮음</span>
                <div className="h-3 w-24 rounded-full" style={{ background: "linear-gradient(to right, rgba(34,197,94,0.3), rgba(234,179,8,0.5), rgba(249,115,22,0.7), rgba(185,28,28,0.9))" }} />
                <span className="text-[10px] text-gray-500">높음</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── 업종 필터 표시 ── */}
      {highlightCategory && (
        <div className="absolute right-4 top-4 z-20 animate-fade-in">
          <button
            onClick={() => useAnalysisStore.getState().setHighlightCategory(null)}
            className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-medium shadow-lg transition-all hover:bg-gray-50"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: getCategoryColor(highlightCategory) }} />
            {highlightCategory} 필터
            <span className="text-muted">✕</span>
          </button>
        </div>
      )}
    </MapGL>
  );
}
