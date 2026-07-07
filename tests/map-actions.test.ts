import { describe, it, expect } from "vitest";
import { bodyActions, type BodyActionContext } from "../src/sim/map/actions.ts";

// A permissive baseline; each test overrides only the fields it exercises.
function ctx(over: Partial<BodyActionContext>): BodyActionContext {
  return {
    nodeKind: "planet",
    tier: "system",
    landed: false,
    autopilotActive: false,
    orbitingHere: false,
    distFromShip: 1000,
    landingRange: 10,
    enterOrbitRange: 20,
    isActiveSystem: false,
    reachable: false,
    scanned: false,
    visited: false,
    locked: false,
    ...over,
  };
}

describe("bodyActions — scaffold / locked", () => {
  it("galaxy nodes have no actions", () => {
    expect(bodyActions(ctx({ nodeKind: "galaxy" }))).toEqual([]);
  });
  it("locked nodes have no actions", () => {
    expect(bodyActions(ctx({ nodeKind: "system", locked: true, reachable: true, scanned: true }))).toEqual([]);
  });
});

describe("bodyActions — sector system nodes", () => {
  it("active system, visited → GET_DETAILS only", () => {
    expect(bodyActions(ctx({ nodeKind: "system", isActiveSystem: true, visited: true }))).toEqual(["GET_DETAILS"]);
  });
  it("active system, never inspected → nothing", () => {
    expect(bodyActions(ctx({ nodeKind: "system", isActiveSystem: true, visited: false }))).toEqual([]);
  });
  it("reachable + scanned → WARP + GET_DETAILS", () => {
    expect(bodyActions(ctx({ nodeKind: "system", reachable: true, scanned: true }))).toEqual(["WARP", "GET_DETAILS"]);
  });
  it("reachable + unscanned → SCAN only", () => {
    expect(bodyActions(ctx({ nodeKind: "system", reachable: true, scanned: false }))).toEqual(["SCAN"]);
  });
  it("not reachable → nothing", () => {
    expect(bodyActions(ctx({ nodeKind: "system", reachable: false, scanned: true }))).toEqual([]);
  });
  it("landed → cannot warp even if reachable+scanned", () => {
    expect(bodyActions(ctx({ nodeKind: "system", reachable: true, scanned: true, landed: true }))).toEqual([]);
  });
});

describe("bodyActions — in-system bodies", () => {
  it("star → GET_DETAILS only", () => {
    expect(bodyActions(ctx({ nodeKind: "star" }))).toEqual(["GET_DETAILS"]);
  });

  it("planet far away → SET_COURSE, AUTOPILOT, GET_DETAILS", () => {
    expect(bodyActions(ctx({ nodeKind: "planet", distFromShip: 1000 }))).toEqual([
      "SET_COURSE", "AUTOPILOT", "GET_DETAILS",
    ]);
  });

  it("planet in range → adds ENTER_ORBIT and LAND", () => {
    const a = bodyActions(ctx({ nodeKind: "planet", distFromShip: 5, landingRange: 10, enterOrbitRange: 20 }));
    expect(a).toEqual(["SET_COURSE", "AUTOPILOT", "ENTER_ORBIT", "LAND", "GET_DETAILS"]);
  });

  it("planet within orbit range but outside landing range → ENTER_ORBIT, no LAND", () => {
    const a = bodyActions(ctx({ nodeKind: "planet", distFromShip: 15, landingRange: 10, enterOrbitRange: 20 }));
    expect(a).toEqual(["SET_COURSE", "AUTOPILOT", "ENTER_ORBIT", "GET_DETAILS"]);
  });

  it("gas giant in range → ENTER_ORBIT but never LAND", () => {
    const a = bodyActions(ctx({ nodeKind: "gas-giant", distFromShip: 5, landingRange: 10, enterOrbitRange: 20 }));
    expect(a).toEqual(["SET_COURSE", "AUTOPILOT", "ENTER_ORBIT", "GET_DETAILS"]);
  });

  it("moon in range → landable like a planet", () => {
    const a = bodyActions(ctx({ nodeKind: "moon", distFromShip: 5, landingRange: 10, enterOrbitRange: 20 }));
    expect(a).toEqual(["SET_COURSE", "AUTOPILOT", "ENTER_ORBIT", "LAND", "GET_DETAILS"]);
  });

  it("autopilot engaged → no ENTER_ORBIT offered", () => {
    const a = bodyActions(ctx({ nodeKind: "planet", distFromShip: 5, autopilotActive: true }));
    expect(a).not.toContain("ENTER_ORBIT");
  });

  it("already orbiting here → no ENTER_ORBIT offered", () => {
    const a = bodyActions(ctx({ nodeKind: "planet", distFromShip: 5, orbitingHere: true }));
    expect(a).not.toContain("ENTER_ORBIT");
  });

  it("landed on a body → GET_DETAILS only (take-off is a separate control)", () => {
    expect(bodyActions(ctx({ nodeKind: "planet", distFromShip: 5, landed: true }))).toEqual(["GET_DETAILS"]);
  });

  it("intra tier behaves like the system tier for a body", () => {
    const sys = bodyActions(ctx({ nodeKind: "planet", tier: "system", distFromShip: 5 }));
    const intra = bodyActions(ctx({ nodeKind: "planet", tier: "intra", distFromShip: 5 }));
    expect(intra).toEqual(sys);
  });
});
