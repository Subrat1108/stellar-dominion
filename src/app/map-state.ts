// Shared map-node state (Exploration Polish C) — written by the renderer each
// frame while in the map view, read by the React MapView overlay.
//
// Same idiom as view-state.ts / steer-state.ts: the renderer runs outside React,
// so it publishes projected screen positions for every visible map node into this
// plain mutable ref, and the DOM overlay (ui/MapView.tsx) polls it (via a game
// tick) to draw labels + hit-targets and to open the detail popup. Keeping the 3D
// in Three and the labels/clicks in the DOM is cheap on integrated GPUs (the same
// project-to-screen pattern the flight target marker already uses in scene.ts).

import type { MapTier } from "./view-state.ts";

/** How a node is classified for labels + valid-action logic. */
export type MapNodeKind = "star" | "planet" | "gas-giant" | "moon" | "system" | "galaxy";

/** One clickable map node, positioned in screen pixels by the renderer. */
export interface MapNode {
  /** Stable key: the ECS entity id (in-system tiers) or systemId (sector tier). */
  id: string;
  /** ECS entity id when this node is a body in the active system. */
  entityId?: number;
  /** Stable systemId when this node is a star system (sector tier). */
  systemId?: string;
  kind: MapNodeKind;
  /** Display name. */
  label: string;
  /** Short type / tier descriptor under the name (e.g. "Rocky Planet", "G8V"). */
  typeLabel: string;
  /** Screen position (px, top-left origin) of the node centre. */
  screenX: number;
  screenY: number;
  /** True when the node is in front of the camera and inside the viewport. */
  onScreen: boolean;
  /** CSS hex colour for the label dot. */
  color: string;
}

export const mapState: {
  /** Projected nodes for the current tier (rebuilt each frame in map view). */
  nodes: MapNode[];
  /** The tier the nodes belong to (mirrors viewState.mapTier). */
  tier: MapTier;
} = { nodes: [], tier: "system" };
