// SB WasteTrack — GPS relay (Cloudflare Worker)
// Receives locations from the Traccar Client phone app (Play Store) and writes
// them to your Firebase Realtime Database, where the website reads them.
//
//   Traccar Client ──► this relay ──► Firebase  /trucks/<device id>  { lat, lon, t, acc, spd, batt }
//
// Setup: paste this whole file into a new Cloudflare Worker, change FIREBASE_URL
// below to your database link, and click Deploy. Put the Worker's link
// (https://…workers.dev) in Traccar Client as the "Server URL".

const FIREBASE_URL = "https://YOUR-PROJECT-default-rtdb.asia-southeast1.firebasedatabase.app";

export default {
  async fetch(request) {
    // Traccar Client sends a form POST: id, lat, lon, timestamp, accuracy, speed (knots), batt …
    // (query-string GETs from older apps work too)
    const p = new URL(request.url).searchParams;
    if (request.method === "POST") {
      const type = request.headers.get("content-type") || "";
      const text = await request.text();
      if (type.includes("json")) {
        try { for (const [k, v] of Object.entries(JSON.parse(text))) p.set(k, String(v)); } catch { /* ignore */ }
      } else {
        for (const [k, v] of new URLSearchParams(text)) p.set(k, v);
      }
    }

    // Firebase keys can't contain . # $ [ ] /
    const id = (p.get("id") || p.get("deviceid") || "").trim().replace(/[.#$[\]/]/g, "_");
    const lat = parseFloat(p.get("lat")), lon = parseFloat(p.get("lon"));
    if (!id || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      // A plain visit in a browser lands here — handy to check the relay is online
      return new Response("SB WasteTrack GPS relay is running. Waiting for id, lat and lon.", { status: request.method === "GET" ? 200 : 400 });
    }
    const num = k => { const v = parseFloat(p.get(k)); return Number.isFinite(v) ? v : null; };
    const knots = num("speed");
    const position = {
      lat, lon,
      t: num("timestamp") || Math.floor(Date.now() / 1000),   // seconds
      acc: num("accuracy"),
      spd: knots == null ? null : Math.round(knots * 0.514444 * 10) / 10,   // knots → m/s
      batt: num("batt"),
    };

    const res = await fetch(`${FIREBASE_URL}/trucks/${encodeURIComponent(id)}.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(position),
    });
    // Traccar Client keeps the point and retries later unless it gets a 200
    return new Response(res.ok ? "OK" : `Firebase refused the update (${res.status})`, { status: res.ok ? 200 : 502 });
  },
};
