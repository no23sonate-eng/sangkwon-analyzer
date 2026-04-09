/* ============================================================
   Zustand store — replaces Streamlit session_state
   ============================================================ */

"use client";

import { create } from "zustand";
import type {
  TrdarItem,
  AnalysisData,
  StoreCountData,
  PanelTab,
  ViewState,
} from "@/lib/types";

interface AnalysisState {
  /* ---- Map ---- */
  viewState: ViewState;
  setViewState: (vs: ViewState) => void;

  /** Coordinates + address of last click / search */
  clickedLat: number | null;
  clickedLng: number | null;
  clickedAddress: string | null;
  clickedGu: string | null;
  clickedDong: string | null;
  setClicked: (lat: number, lng: number) => void;
  setClickedAddress: (address: string, gu: string, dong: string) => void;

  /* ---- Nearby districts ---- */
  nearbyList: TrdarItem[];
  setNearbyList: (list: TrdarItem[]) => void;

  /* ---- Selected district ---- */
  selectedTrdar: TrdarItem | null;
  setSelectedTrdar: (t: TrdarItem | null) => void;

  /* ---- Analysis data ---- */
  analysisData: AnalysisData | null;
  setAnalysisData: (d: AnalysisData | null) => void;

  storeCountData: StoreCountData | null;
  setStoreCountData: (d: StoreCountData | null) => void;

  /* ---- Radius ---- */
  radius: number;
  setRadius: (r: number) => void;

  /* ---- Draw mode ---- */
  drawMode: "none" | "circle" | "rectangle" | "polygon";
  setDrawMode: (m: "none" | "circle" | "rectangle" | "polygon") => void;

  /* ---- Panel ---- */
  panelOpen: boolean;
  setPanelOpen: (v: boolean) => void;

  activeTab: PanelTab;
  setActiveTab: (t: PanelTab) => void;

  /* ---- Loading ---- */
  loading: boolean;
  setLoading: (v: boolean) => void;

  /* ---- Map Filters (패널↔지도 연동) ---- */
  highlightCategory: string | null;
  setHighlightCategory: (c: string | null) => void;

  highlightTimeSlot: string | null;
  setHighlightTimeSlot: (t: string | null) => void;

  /* ---- Hovered district ---- */
  hoveredTrdar: TrdarItem | null;
  setHoveredTrdar: (t: TrdarItem | null) => void;

  /* ---- Heatmap & Layers ---- */
  heatmapOn: boolean;
  setHeatmapOn: (v: boolean) => void;
  heatmapType: "openclose" | "traffic" | "sales";
  setHeatmapType: (v: "openclose" | "traffic" | "sales") => void;
  heatmapTimeSlot: number;
  setHeatmapTimeSlot: (v: number) => void;
  showStoreMarkers: boolean;
  setShowStoreMarkers: (v: boolean) => void;
  showDistrictBounds: boolean;
  setShowDistrictBounds: (v: boolean) => void;

  /* ---- Reset ---- */
  reset: () => void;
}

const defaultViewState: ViewState = {
  longitude: 126.978,
  latitude: 37.5665,
  zoom: 12,
  pitch: 0,
  bearing: 0,
};

export const useAnalysisStore = create<AnalysisState>((set) => ({
  viewState: defaultViewState,
  setViewState: (vs) => set({ viewState: vs }),

  clickedLat: null,
  clickedLng: null,
  clickedAddress: null,
  clickedGu: null,
  clickedDong: null,
  setClicked: (lat, lng) => set({ clickedLat: lat, clickedLng: lng }),
  setClickedAddress: (address, gu, dong) => set({ clickedAddress: address, clickedGu: gu, clickedDong: dong }),

  nearbyList: [],
  setNearbyList: (list) => set({ nearbyList: list }),

  selectedTrdar: null,
  setSelectedTrdar: (t) => set({ selectedTrdar: t }),

  analysisData: null,
  setAnalysisData: (d) => set({ analysisData: d }),

  storeCountData: null,
  setStoreCountData: (d) => set({ storeCountData: d }),

  radius: 300,
  setRadius: (r) => set({ radius: r }),

  drawMode: "none",
  setDrawMode: (m) => set({ drawMode: m }),

  panelOpen: false,
  setPanelOpen: (v) => set({ panelOpen: v }),

  activeTab: "category",
  setActiveTab: (t) => set({ activeTab: t }),

  loading: false,
  setLoading: (v) => set({ loading: v }),

  highlightCategory: null,
  setHighlightCategory: (c) => set({ highlightCategory: c }),

  highlightTimeSlot: null,
  setHighlightTimeSlot: (t) => set({ highlightTimeSlot: t }),

  hoveredTrdar: null,
  setHoveredTrdar: (t) => set({ hoveredTrdar: t }),

  heatmapOn: false,
  setHeatmapOn: (v) => set({ heatmapOn: v }),
  heatmapType: "openclose",
  setHeatmapType: (v) => set({ heatmapType: v }),
  heatmapTimeSlot: 6,
  setHeatmapTimeSlot: (v) => set({ heatmapTimeSlot: v }),
  showStoreMarkers: true,
  setShowStoreMarkers: (v) => set({ showStoreMarkers: v }),
  showDistrictBounds: true,
  setShowDistrictBounds: (v) => set({ showDistrictBounds: v }),

  reset: () =>
    set({
      clickedLat: null,
      clickedLng: null,
      clickedAddress: null,
      clickedGu: null,
      clickedDong: null,
      nearbyList: [],
      selectedTrdar: null,
      analysisData: null,
      storeCountData: null,
      panelOpen: false,
      activeTab: "category",
      loading: false,
      highlightCategory: null,
      highlightTimeSlot: null,
      hoveredTrdar: null,
    }),
}));
