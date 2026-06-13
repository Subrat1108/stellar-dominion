// Shared camera-view state, mutated by the renderer and read by the debug UI.
// Kept here (not in React state) because the renderer runs outside React.

export type CameraView = "cockpit" | "chase" | "map";

export const viewState: { view: CameraView } = { view: "chase" };
