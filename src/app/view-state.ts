// Shared camera-view state, mutated by the renderer and read by the UI.
// Kept here (not in React state) because the renderer runs outside React; UI
// components poll it (like the Scanner) to swap overlays without prop threading.

export type CameraView = "cockpit" | "chase" | "map";

/** Within the map view, which zoom tier is active (docs/12 multi-scale map). */
export type MapTier = "system" | "sector";

export const viewState: {
  view: CameraView;
  /** Active map zoom tier — only meaningful while `view === "map"`. */
  mapTier: MapTier;
  /** 0→1 cross-fade progress when the tier flips (drives a fade overlay). */
  transitionT: number;
} = { view: "chase", mapTier: "system", transitionT: 0 };
