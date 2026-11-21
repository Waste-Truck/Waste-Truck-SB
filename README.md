# SB WasteTrack — Barangay San Bartolome

Real-time garbage truck tracker for Barangay San Bartolome, Novaliches, Quezon City.
Households can watch the trucks on a live map, get ETA alerts, confirm pickups and report
garbage that is piling up; drivers submit photo proof at every stop; barangay staff manage
unserved areas, reports, announcements and schedules.

**Live site:** https://waste-truck.github.io/Waste-Truck-SB/ (after GitHub Pages is switched on, see below)

## Features

- **Live map** of all 8 trucks (routes BC-05-53 to BC-05-66) on the real streets from the District 5 route sheets
- **ETA alerts**, pickup confirmation and a 14-day pickup history for each household's area
- **Garbage reports** with a required, time- and location-stamped photo; staff update the status and reply
- **Driver console** with turn-by-turn directions, required photo proof, and "truck full — end route early"
- **Management console**: unserved areas (assign / redirect / reschedule), photo and garbage-type verification,
  announcements and holiday/typhoon schedule changes, summary charts, CSV export, printable PDF report, settings
- **English / Tagalog** toggle
- **Live GPS** from phones through Firebase (optional — without it the trucks run on a simulation)

## Run it

It is a static website — no build step needed.

- **Online:** GitHub Pages (below), or any static host.
- **On a computer:** `node server.mjs`, then open http://localhost:8080
- **Without a server:** open `WasteTrack-offline.html` (everything in one file; map images need internet)

### Publish with GitHub Pages

Repository **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main`, folder `/ (root)` → Save**.
After a minute the site is at https://waste-truck.github.io/Waste-Truck-SB/

## Project files

| Path | What it is |
|---|---|
| `index.html` | The website |
| `assets/js/app.js` | All the app logic (map, simulation, household / driver / management screens) |
| `assets/js/i18n.js` | English and Tagalog text |
| `assets/js/data.js` | Collection schedule, trucks, areas — edit drivers and time windows here |
| `assets/js/routes.generated.js` | Truck paths on real streets (generated — do not edit) |
| `assets/css/styles.css`, `assets/img/` | Styles and images |
| `WasteTrack-offline.html` | Single-file copy of the site (generated) |
| `server.mjs` | Small local web server (`node server.mjs`) |
| `build-offline.mjs` | Rebuilds `WasteTrack-offline.html`: `node build-offline.mjs` |
| `tools/route-sheets.mjs` | The District 5 route sheets, typed up (routes, trucks, streets) |
| `tools/build-routes.mjs` | Rebuilds the truck paths from the route sheets: `node tools/build-routes.mjs` |
| `tools/osm-cache.json` | Cached OpenStreetMap street data used by the route builder |
| `tools/firebase-relay-worker.js` | Optional relay so the Traccar Client phone app can send GPS to Firebase |

## Live GPS (optional)

1. Create a free Firebase Realtime Database and publish rules that allow reading and writing `/trucks`.
2. In the site: **Management → Settings → Live GPS**, paste the database URL and save.
3. On the driver's phone, send positions to `/trucks/<device id>` (`{ "lat": …, "lon": …, "t": … }`) —
   with GPSLogger (custom URL) or Traccar Client through `tools/firebase-relay-worker.js` on Cloudflare Workers.

## Good to know

- This is a prototype: data (reports, history, settings, announcements) is saved in each visitor's browser,
  not on a server. Sample history, ratings and reports are generated for demos and marked **SAMPLE**.
- Driver names and time windows are placeholders. 13 compounds that are not named on OpenStreetMap
  are placed approximately beside their neighbours on the same route.

## Sources and credits

- Collection schedule and District 5 route sheets: Barangay San Bartolome
- Barangay information: [barangaysanbartolome.ph](https://www.barangaysanbartolome.ph/)
- Street data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL); routing by [OSRM](https://project-osrm.org/)
- Map images: Esri, OpenTopoMap; map library [Leaflet](https://leafletjs.com/); icons [Lucide](https://lucide.dev/)
