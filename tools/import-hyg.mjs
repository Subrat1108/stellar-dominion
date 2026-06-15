// HYG catalog import — DEV-ONLY, run once with `node tools/import-hyg.mjs`.
//
// Fetches the HYG stellar database (astronexus/HYG-Database on GitHub), filters
// to the local neighborhood, strips it to the handful of fields the content
// engine needs, and writes a compact flat JSON file that ships with the game.
// The GAME NEVER FETCHES AT RUNTIME — it reads the committed JSON.
//
// Step 1A ships a LOCAL ~25 ly subset (light for a MacBook Air, contains Tau
// Ceti + its real neighbors). Widen to the full 50 pc for Step 1B by raising
// MAX_DIST_PC to 50 and re-running. The HYG record id + galactic XYZ are the
// stable inputs the engine hashes for per-system seeds (docs/13).
//
// Source: https://github.com/astronexus/HYG-Database (CC BY-SA 4.0 / public).

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const SOURCE_URL =
  "https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv";

const LY_PER_PC = 3.2615638;
const MAX_DIST_LY = 25;
const MAX_DIST_PC = MAX_DIST_LY / LY_PER_PC; // ≈ 7.665 pc

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, "../src/sim/data/hyg-neighborhood.json");

/** Parse one CSV line into fields, honouring double-quoted values. */
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

async function main() {
  console.log(`Fetching HYG catalog…\n  ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching HYG CSV`);
  const text = await res.text();

  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const header = parseCsvLine(lines[0]);
  const col = (name) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`HYG header missing column "${name}"`);
    return i;
  };
  const cId = col("id");
  const cHip = col("hip");
  const cHd = col("hd");
  const cGl = col("gl");
  const cProper = col("proper");
  const cBf = col("bf");
  const cDist = col("dist");
  const cMag = col("mag");
  const cSpect = col("spect");
  const cX = col("x");
  const cY = col("y");
  const cZ = col("z");
  const cLum = col("lum");

  const round = (n, p = 6) => {
    const f = 10 ** p;
    return Math.round(n * f) / f;
  };

  const stars = [];
  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i]);
    const dist = Number(f[cDist]);
    // dist === 0 is the Sun; keep it. Skip rows with bad/zero parallax (HYG
    // encodes those as dist = 100000) or beyond the neighborhood radius.
    if (!Number.isFinite(dist) || dist > MAX_DIST_PC) continue;

    const id = Number(f[cId]);
    const hip = f[cHip]?.trim();
    const hd = f[cHd]?.trim();
    const gl = f[cGl]?.trim();
    const bf = f[cBf]?.trim();
    // Best display name: common proper name → Bayer/Flamsteed → Gliese → HD.
    const name =
      f[cProper]?.trim() || bf || (gl ? `Gl ${gl}` : "") || (hd ? `HD ${hd}` : "") || null;
    const spect = f[cSpect]?.trim() || null;
    const lum = Number(f[cLum]);
    stars.push({
      id,
      name,
      // Cross-catalog identifiers — the real-planets table keys on these so it
      // survives HYG row-id changes between catalog versions.
      hip: hip ? Number(hip) : null,
      hd: hd ? Number(hd) : null,
      gl: gl || null,
      spect,
      distPc: round(dist, 4),
      mag: round(Number(f[cMag]), 3),
      lum: Number.isFinite(lum) ? round(lum, 6) : null,
      // Equatorial cartesian coords in parsecs — the stable per-system hash key.
      x: round(Number(f[cX]), 6),
      y: round(Number(f[cY]), 6),
      z: round(Number(f[cZ]), 6),
    });
  }

  // Deterministic order (by HYG id) so the bundled file is stable across runs.
  stars.sort((a, b) => a.id - b.id);

  const payload = {
    source: "HYG Database v4.1 (astronexus/HYG-Database)",
    license: "CC BY-SA 4.0",
    maxDistLy: MAX_DIST_LY,
    generatedBy: "tools/import-hyg.mjs",
    count: stars.length,
    stars,
  };

  await writeFile(OUT_PATH, JSON.stringify(payload) + "\n", "utf8");
  const named = stars.filter((s) => s.name).length;
  console.log(
    `Wrote ${stars.length} stars (${named} named) within ${MAX_DIST_LY} ly\n  → ${OUT_PATH}`,
  );
  // Sanity-check by HD/HIP (robust to name formatting).
  const checks = [
    ["Sol", (s) => s.id === 0],
    ["Tau Ceti (HD 10700)", (s) => s.hd === 10700],
    ["Epsilon Eridani (HD 22049)", (s) => s.hd === 22049],
    ["Luyten 726-8 (HIP 1475)", (s) => s.hip === 1475],
  ];
  for (const [label, pred] of checks) {
    const hit = stars.find(pred);
    console.log(
      `  ${hit ? "✓" : "·"} ${label}${hit ? ` → "${hit.name}" (${hit.distPc} pc, ${hit.spect ?? "?"}, id ${hit.id})` : " — not in subset"}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
