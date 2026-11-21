// Builds assets/js/routes.generated.js: truck paths that follow the real
// streets named on the District 5 route sheets (tools/route-sheets.mjs).
//
//   1. Street geometry comes from OpenStreetMap (cached in tools/osm-cache.json).
//   2. Each sheet section's streets are matched by name and kept only if they
//      sit together in one neighbourhood (many street names repeat elsewhere).
//   3. OSRM (the OpenStreetMap routing engine) joins the matched streets, in
//      sheet order, into one drivable path per truck.
//
// Usage: node tools/build-routes.mjs          (add --refresh to re-download)
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { ROUTES } from "./route-sheets.mjs";

const BBOX = [14.690, 121.005, 14.728, 121.048];           // S, W, N, E — San Bartolome and its edges
const CENTER = [14.7085, 121.0285];
const CACHE = new URL("./osm-cache.json", import.meta.url);
const UA = { "User-Agent": "sb-wastetrack (student capstone project)" };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- geometry ----------
function dist([a1, o1], [a2, o2]) {
  const R = 6371000, r = Math.PI / 180;
  const h = Math.sin((a2 - a1) * r / 2) ** 2 + Math.cos(a1 * r) * Math.cos(a2 * r) * Math.sin((o2 - o1) * r / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const mean = pts => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
const r5 = n => Math.round(n * 1e5) / 1e5;

// ---------- names ----------
function norm(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\bsaint\b/g, "st").replace(/\bsanta\b/g, "sta").replace(/\bsanto\b/g, "sto")
    .replace(/[.'’]/g, "").replace(/[-/]/g, " ")
    .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|lane|extension|ext)\s*$/g, "")
    .replace(/\s+/g, " ").trim();
}

// ---------- 1. OpenStreetMap data ----------
async function overpass() {
  const b = BBOX.join(",");
  const q = `[out:json][timeout:90];
    (way["highway"]["name"](${b}););
    out geom;
    (node["place"]["name"](${b}); way["place"]["name"](${b}); way["landuse"="residential"]["name"](${b});
     node["amenity"]["name"](${b}); way["amenity"]["name"](${b}););
    out center tags;`;
  const endpoints = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
  for (let round = 0; round < 3; round++) {
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { ...UA, "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(100000) });
        if (!res.ok) { console.log(`  ${new URL(ep).host}: HTTP ${res.status}`); continue; }
        const j = await res.json();
        if (j.elements?.length) return j;
      } catch (e) { console.log(`  ${new URL(ep).host}: ${e.message}`); }
    }
    await sleep(5000);
  }
  throw new Error("Could not download OpenStreetMap data — try again later.");
}
// OpenStreetMap's own map API, fetched in tiles (it caps each request at 50,000 points).
// Returns the same shape as the Overpass query above, keeping only what we use.
async function osmApi() {
  const [S, W, N, E] = BBOX, n = 3, nodes = new Map(), seen = new Set(), elements = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const b = [W + (E - W) * j / n, S + (N - S) * i / n, W + (E - W) * (j + 1) / n, S + (N - S) * (i + 1) / n].map(x => x.toFixed(5)).join(",");
    let data = null;
    for (let attempt = 0; attempt < 3 && !data; attempt++) {
      try {
        const res = await fetch(`https://api.openstreetmap.org/api/0.6/map.json?bbox=${b}`, { headers: UA, signal: AbortSignal.timeout(90000) });
        if (!res.ok) throw new Error("HTTP " + res.status + " " + (await res.text()).slice(0, 120));
        data = await res.json();
      } catch (e) { console.log(`  tile ${i},${j}: ${e.message}`); await sleep(3000); }
    }
    if (!data) throw new Error("Could not download map tile " + b);
    for (const e of data.elements) if (e.type === "node") nodes.set(e.id, e);
    for (const e of data.elements) {
      if (seen.has(e.type + e.id) || !e.tags?.name) continue;
      const t = e.tags;
      if (e.type === "way" && t.highway) {
        const geometry = e.nodes.map(id => nodes.get(id)).filter(Boolean).map(nd => ({ lat: nd.lat, lon: nd.lon }));
        if (geometry.length > 1) { seen.add(e.type + e.id); elements.push({ type: "way", tags: { highway: t.highway, name: t.name }, geometry }); }
      } else if (t.place || t.amenity || t.landuse === "residential") {
        let at = e.type === "node" ? e : null;
        if (e.type === "way") { const g = e.nodes.map(id => nodes.get(id)).filter(Boolean); if (g.length) at = { lat: g.reduce((s, x) => s + x.lat, 0) / g.length, lon: g.reduce((s, x) => s + x.lon, 0) / g.length }; }
        if (at) { seen.add(e.type + e.id); elements.push({ type: e.type, tags: { name: t.name, kind: t.place || t.amenity || t.landuse }, center: { lat: at.lat, lon: at.lon } }); }
      }
    }
    console.log(`  tile ${i * n + j + 1}/${n * n} ok`);
    await sleep(800);
  }
  return { elements };
}

let osm;
if (existsSync(CACHE) && !process.argv.includes("--refresh")) osm = JSON.parse(await readFile(CACHE, "utf8"));
else {
  console.log("Downloading street data from OpenStreetMap…");
  try { osm = await osmApi(); } catch (e) { console.log("  map API failed (" + e.message + "), trying Overpass…"); osm = await overpass(); }
  await writeFile(CACHE, JSON.stringify(osm));
}

const ways = osm.elements.filter(e => e.type === "way" && e.tags?.highway && e.geometry).map(w => {
  const pts = w.geometry.map(g => [g.lat, g.lon]);
  return { name: w.tags.name, key: norm(w.tags.name), pts, mid: pts[Math.floor(pts.length / 2)] };
});
const places = osm.elements.filter(e => !e.tags?.highway && e.tags?.name).map(p => ({
  name: p.tags.name, key: norm(p.tags.name), kind: p.tags.kind || p.tags.amenity || p.tags.place || p.tags.landuse, at: p.center ? [p.center.lat, p.center.lon] : [p.lat, p.lon],
})).filter(p => p.at[0]);
console.log(`OpenStreetMap: ${ways.length} named street segments, ${places.length} named places`);

// ---------- 2. match each section's streets ----------
// Hand-placed anchors for sections the map data can't locate by name.
// Filled in after checking the report this script prints.
const HINTS = existsSync(new URL("./section-hints.json", import.meta.url))
  ? JSON.parse(await readFile(new URL("./section-hints.json", import.meta.url), "utf8")) : {};

// A named place on the map (subdivision, church, school…) that clearly is this section.
const GENERIC = /\b(subdivision|subd|village|compound|homes?|i|ii|iii|iv|vii|de|ng)\b/g;
const NOT_A_PLACE = /restaurant|fast_food|cafe|bank|atm|fuel|pharmacy|bar|pub|parking|clinic|dentist|hotel/;
const compact = s => norm(s).replace(GENERIC, "").replace(/\s+/g, "");
function findPlaces(name) {
  const keys = name.split("/").map(compact).filter(k => k.length >= 5);
  return places.filter(p => !NOT_A_PLACE.test(p.kind || "") && keys.some(k => compact(p.name).includes(k)));
}

// A street on the sheet matches a map street of the same name, allowing for
// initials in front ("Macapagal" = "P. Macapagal Street").
function waysFor(street) {
  const keys = street.split("|").map(norm);
  return ways.filter(w => keys.some(k => w.key === k || new RegExp(`^(?:[a-z] )+${k.replace(/[^a-z0-9 ]/g, "")}$`).test(w.key)));
}
const nearestVertex = (ws, to) => ws.flatMap(w => w.pts).reduce((b, p) => (dist(p, to) < dist(b, to) ? p : b));

function resolveRoute(r) {
  const secs = r.sections.map(sec => ({
    ...sec, cands: sec.streets.map(s => ({ street: s.split("|")[0], ways: waysFor(s) })),
    hint: HINTS[`${r.route}|${sec.name}`] || sec.near || null,
    anchor: null, matched: [], missing: sec.streets.map(s => s.split("|")[0]), points: [],
  }));
  const done = () => secs.filter(s => s.anchor).map(s => s.anchor);
  const gap = p => { const a = done(); return a.length ? Math.min(...a.map(x => dist(x, p))) : null; };

  // How many of the section's streets sit together around a given spot
  const cluster = (s, at) => s.cands.filter(c => c.ways.some(w => dist(w.mid, at) < 400)).length;
  const rawBest = s => Math.max(0, ...s.cands.flatMap(c => c.ways).map(w => cluster(s, w.mid)));

  // Street sections first, most recognisable first; each later one must sit
  // close to the sections already placed on this route.
  for (const s of secs.filter(x => x.cands.some(c => c.ways.length)).sort((a, b) => rawBest(b) - rawBest(a))) {
    const pl = findPlaces(s.name);
    let seed = s.hint, best = -Infinity;
    if (!seed) for (const w of s.cands.flatMap(c => c.ways)) {
      const g = gap(w.mid);
      const score = cluster(s, w.mid) + (pl.some(p => dist(p.at, w.mid) < 500) ? 1.5 : 0) - (g ?? 0) / 500 - dist(w.mid, CENTER) / 4000;
      if (score > best) { best = score; seed = w.mid; }
    }
    const pick = (centre, radius) => s.cands.map(c => ({ street: c.street, ways: c.ways.filter(w => (s.hint ? Math.min(...w.pts.map(p => dist(p, centre))) : dist(w.mid, centre)) < radius) }));
    let chosen = pick(seed, 500);
    const mids = chosen.flatMap(c => c.ways.map(w => w.mid));
    if (mids.length && !s.hint) chosen = pick(mean(mids), 450);
    // one waypoint per street: the middle of its longest segment (or the point nearest a hint)
    s.points = chosen.filter(c => c.ways.length).map(c => ({
      street: c.street,
      at: s.hint ? nearestVertex(c.ways, s.hint) : c.ways.slice().sort((a, b) => dist(a.mid, seed) - dist(b.mid, seed))[0].mid,
    }));
    if (!s.points.length) continue;
    s.anchor = mean(s.points.map(p => p.at));
    s.matched = s.points.map(p => p.street);
    s.missing = chosen.filter(c => !c.ways.length).map(c => c.street);
  }

  // Sections with no (matched) streets: a named place near the rest of the route…
  for (const s of secs.filter(x => !x.anchor)) {
    if (s.hint) { s.anchor = s.hint; s.placed = "hand-placed"; continue; }
    const pl = findPlaces(s.name).map(p => ({ p, g: gap(p.at) })).filter(x => x.g === null || x.g < 800).sort((a, b) => (a.g ?? 0) - (b.g ?? 0))[0];
    if (pl) { s.anchor = pl.p.at; s.placed = pl.p.name; }
  }
  // …otherwise a spot between their neighbours on the sheet.
  secs.forEach((s, i) => {
    if (s.anchor) return;
    const prev = secs.slice(0, i).reverse().find(x => x.anchor && !x.approx);
    const next = secs.slice(i + 1).find(x => x.anchor);
    s.approx = true;
    if (prev && next) {
      const run = secs.slice(secs.indexOf(prev) + 1, secs.indexOf(next)), f = (run.indexOf(s) + 1) / (run.length + 1);
      s.anchor = [prev.anchor[0] + (next.anchor[0] - prev.anchor[0]) * f, prev.anchor[1] + (next.anchor[1] - prev.anchor[1]) * f];
    } else if (prev) {
      // nothing after it on the sheet: keep it right beside the last placed section
      // (about 90 m away, fanned out) so it never drifts outside the listed area
      const n = secs.slice(secs.indexOf(prev) + 1, i + 1).length, ang = n * 1.9;
      s.anchor = [prev.anchor[0] + Math.sin(ang) * 0.0008, prev.anchor[1] + Math.cos(ang) * 0.0008];
    } else s.anchor = next?.anchor || null;
  });
  return { ...r, sections: secs };
}

const matched = ROUTES.map(resolveRoute);

console.log("\nRoute sheet → map matching");
for (const r of matched) {
  console.log(`\n${r.route}  (Truck ${r.truck})`);
  for (const s of r.sections) {
    const tag = s.approx ? "APPROX (between neighbours)" : s.placed ? `placed by "${s.placed}"` : "by streets";
    console.log(`  ${s.name.padEnd(42)} ${String(s.matched.length).padStart(2)}/${String(s.streets.length).padEnd(2)} streets  ${s.anchor ? s.anchor.map(n => n.toFixed(5)).join(",") : "NOT PLACED"}  ${tag}${s.missing.length ? "  missing: " + s.missing.join(", ") : ""}`);
  }
}
if (process.argv.includes("--match-only")) process.exit(0);

// ---------- 3. join into drivable paths ----------
async function osrm(coords) {
  const url = "https://router.project-osrm.org/route/v1/driving/" + coords.map(c => `${c[1]},${c[0]}`).join(";") + "?overview=full&geometries=geojson&steps=true&continue_straight=false";
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) });
      const j = await res.json();
      if (j.code === "Ok") return j;
      console.log("  routing:", j.code, j.message || "");
    } catch (e) { console.log("  routing:", e.message); }
    await sleep(3000);
  }
  throw new Error("Routing service unavailable — try again later.");
}

const trucks = {};
for (const truckId of [...new Set(matched.map(r => r.truck))]) {
  const routes = matched.filter(r => r.truck === truckId);
  // waypoints in sheet order: every matched street, or the section anchor if it has none
  const wps = [];
  for (const r of routes) for (const s of r.sections) {
    if (!s.anchor) continue;
    const pts = s.points.length ? s.points.map(p => p.at) : [s.anchor];
    pts.forEach((at, i) => wps.push({ at, route: r.route, section: s.name, isStop: i === Math.floor(pts.length / 2) }));
  }
  const res = await osrm(wps.map(w => w.at));
  await sleep(1200);                                       // be polite to the free service
  const raw = res.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
  const path = [raw[0]];
  for (const p of raw) if (dist(p, path[path.length - 1]) > 2) path.push(p);
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + dist(path[i - 1], path[i]));

  // where along the path each waypoint falls (search forward so order is kept)
  let from = 0;
  wps.forEach((w, wi) => {
    const snapped = [res.waypoints[wi].location[1], res.waypoints[wi].location[0]];
    let best = from, bd = Infinity;
    for (let i = from; i < path.length; i++) { const d = dist(path[i], snapped); if (d < bd) { bd = d; best = i; } if (bd < 3) break; }
    w.i = best; w.d = cum[best]; from = best;
  });

  // Turn-by-turn steps for the driver: [distance along path, maneuver, direction, street name].
  // Waypoint "arrive/depart" steps are dropped — the app announces stops itself.
  const steps = [];
  let si = 0;
  for (const s of res.routes[0].legs.flatMap(l => l.steps)) {
    const m = s.maneuver;
    if (m.type === "arrive" || (m.type === "depart" && steps.length)) continue;
    const at = [m.location[1], m.location[0]];
    let best = si, bd = Infinity;
    for (let i = si; i < path.length; i++) { const d = dist(path[i], at); if (d < bd) { bd = d; best = i; } if (bd < 3) break; }
    si = best;
    const step = [Math.round(cum[best]), m.type, m.modifier || "", s.name || ""];
    const prev = steps[steps.length - 1];
    if (prev && step[0] - prev[0] < 8 && step[1] === prev[1]) continue;   // duplicate at the same spot
    steps.push(step);
  }

  trucks[truckId] = {
    type: routes[0].type,
    length: Math.round(cum[cum.length - 1]),
    path: path.map(p => [r5(p[0]), r5(p[1])]),
    steps,
    routes: routes.map(r => {
      const mine = wps.filter(w => w.route === r.route);
      return {
        id: r.route, remarks: r.remarks,
        from: Math.round(mine[0]?.d ?? 0), to: Math.round(mine[mine.length - 1]?.d ?? 0),
        sections: r.sections.filter(s => s.anchor).map(s => {
          const stop = mine.find(w => w.section === s.name && w.isStop);
          return { name: s.name, d: Math.round(stop.d), latlng: path[stop.i].map(r5), streets: s.matched, missing: s.missing, approx: !!s.approx };
        }),
      };
    }),
  };
  console.log(`Truck ${truckId}: ${(cum[cum.length - 1] / 1000).toFixed(1)} km, ${path.length} points, ${wps.length} waypoints — ` +
    trucks[truckId].routes.map(r => `${r.id} ${((r.to - r.from) / 1000).toFixed(1)} km`).join(", "));
  // flag long hops between consecutive waypoints (usually a mis-placed street)
  wps.forEach((w, i) => { if (i && w.d - wps[i - 1].d > 1500) console.log(`   long hop ${((w.d - wps[i - 1].d) / 1000).toFixed(1)} km: ${wps[i - 1].section} → ${w.section}`); });
}

const out = `/* GENERATED by tools/build-routes.mjs — do not edit by hand.
   Truck paths follow the streets on the District 5 route sheets, using
   OpenStreetMap street data (© OpenStreetMap contributors) and OSRM routing. */
const ROUTE_GEO = ${JSON.stringify({ trucks })};
`;
await writeFile(new URL("../assets/js/routes.generated.js", import.meta.url), out);
console.log(`\nWrote assets/js/routes.generated.js (${(out.length / 1024).toFixed(0)} KB)`);
