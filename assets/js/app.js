/* SB WasteTrack — garbage truck tracker (front-end prototype).
   Three demo roles share one page: Resident, Driver, Management.
   GPS positions are SIMULATED along the route-sheet paths and all data lives
   in this browser's localStorage. To go live, replace `stepTruck()` with
   positions pushed from the trucks' GPS devices and move the stored records
   (day, history, reports, announcements, config) to a server.
   All visible text goes through tr() — see i18n.js for English / Tagalog. */

(() => {
  "use strict";

  // ---------- Config ----------
  const TICK_MS = 250;
  const SIM_SPEED = 28;        // metres per second on screen (demo speed — routes are several km)
  const REAL_SPEED = 2.8;      // m/s incl. stops (~10 km/h) — used for ETA
  const STOP_MIN = 1;          // minutes added to ETA per stop still ahead
  const DWELL_MS = 4000;       // autopilot: time at a stop before the simulated proof
  const ETA_ALERT_MIN = 5;
  const PHOTO_MAX = 640;       // proof photos are downscaled to keep storage small
  const HISTORY_DAYS = 60;     // days of collection history kept on this device
  const ORDER = [1, 2, 3, 4, 5, 6, 0];   // Mon → Sun

  // ---------- Storage ----------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem("sb." + key); return v == null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem("sb." + key, JSON.stringify(value)); return true; }
      catch { toast(tr("toast.storageFull"), "error"); return false; }
    },
  };

  // ---------- Helpers ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const icons = () => window.lucide && lucide.createIcons();
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const truckById = id => TRUCKS.find(t => t.id === id);
  const areaById = id => AREAS.find(a => a.id === id);
  const fmtTime = d => d.toLocaleTimeString(LOCALE, { hour: "numeric", minute: "2-digit" });
  const fmtDate = d => d.toLocaleDateString(LOCALE, { weekday: "short", month: "short", day: "numeric" });
  const fmtDay = d => d.toLocaleDateString(LOCALE, { month: "short", day: "numeric" });
  const fmtStamp = ts => new Date(ts).toLocaleString(LOCALE, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" });
  // Photo stamps stay in one fixed format so evidence reads the same everywhere
  const stampTime = ts => new Date(ts).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" });
  const fmtDist = m => m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1)} km`;
  const ll = p => `${p[0].toFixed(5)}, ${p[1].toFixed(5)}`;
  const initials = n => n.split(" ").map(p => p[0]).slice(0, 2).join("");
  const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const keyToDate = k => new Date(k + "T00:00");
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const txt = v => (v && typeof v === "object" ? (v[LANG] || v.en) : v) || "";   // sample text is stored in both languages
  function timeAgo(ts) {
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return tr("time.now");
    if (s < 3600) return tr("time.min", { n: Math.floor(s / 60) });
    if (s < 86400) return tr("time.hr", { n: Math.floor(s / 3600) });
    return tr("time.day", { n: Math.floor(s / 86400) });
  }
  function haversine([a1, o1], [a2, o2]) {
    const R = 6371000, r = Math.PI / 180;
    const dA = (a2 - a1) * r, dO = (o2 - o1) * r;
    const h = Math.sin(dA / 2) ** 2 + Math.cos(a1 * r) * Math.cos(a2 * r) * Math.sin(dO / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function svg(name, cls = "") {
    const paths = {
      truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
      home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
      trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
      check: '<path d="M20 6 9 17l-5-5"/>',
      x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
      star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
      flag: '<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"/>',
    };
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}">${paths[name]}</svg>`;
  }
  const chip = (text, cls) => `<span class="pill ${cls}">${text}</span>`;

  // Translated labels for stored ids
  const dayName = n => tr("day." + n);
  const daysText = days => ORDER.filter(d => days.includes(d)).map(dayName).join(" • ");
  const groupLabel = a => (a.group === "custom" ? daysText(a.days) : tr("group." + a.group));
  const reasonText = id => (I18N.en["reason." + id] ? tr("reason." + id) : id || "");
  const statusText = id => tr("rstatus." + id);
  const wasteText = id => tr("waste." + id);
  const rtypeText = id => tr("rtype." + id);

  // ---------- Management settings (edited on the Settings tab) ----------
  // Applied on top of data.js before anything else uses the trucks and areas.
  const config = store.get("config", null) || {};
  const sameDays = (a, b) => [...a].sort().join() === [...b].sort().join();
  const groupFor = days => SCHEDULE_GROUPS.find(g => sameDays(g.days, days))?.id || "custom";
  TRUCKS.forEach(t => { const o = config.trucks?.[t.id]; if (o?.driver) t.driver = o.driver; if (o?.window) t.window = o.window; });
  AREAS.forEach(a => {
    a.baseDays = a.days.slice();                       // the schedule PDF's days, to compare edits against
    const o = config.areas?.[a.id];
    if (o?.days) { a.days = o.days.slice(); a.group = groupFor(a.days); }
  });
  (config.added || []).forEach(c => {
    const near = areaById(c.near);
    if (near) AREAS.push({ id: c.id, name: c.name, route: near.route, section: near.section, truck: near.truck, days: c.days.slice(), group: groupFor(c.days), custom: true, near: c.near });
  });

  // ---------- State ----------
  let role = store.get("role", "resident");
  let myAreaId = store.get("area", AREAS[0].id);
  if (!areaById(myAreaId)) myAreaId = AREAS[0].id;
  let driverTruckId = store.get("driverTruck", TRUCKS[0].id);
  if (!truckById(driverTruckId)) driverTruckId = TRUCKS[0].id;
  let manualTruck = store.get("manualTruck", null);   // truck driven by hand (no autopilot)
  let reports = store.get("reports", null);
  let notifs = store.get("notifs", []);
  let feedback = store.get("feedback", []);
  let areaPhotos = store.get("areaPhotos", {});
  let carry = store.get("carry", []);                 // rescheduled catch-ups: [{areaId, date}]
  let announcements = store.get("announcements", null);
  let dismissed = store.get("dismissedAnn", []);
  let history = store.get("history", {});             // past days: { "YYYY-MM-DD": { stops, ended } }
  let adminTab = store.get("adminTab", "today");
  let pickMode = false, pickedLatLng = null, pickMarker = null;
  let reportPhotoRaw = null, missedPhoto = null, rating = 0;
  let shownConfirmThisSession = false;
  let rev = 0, dirty = true;                          // rev bumps when records change

  // Reason ids line up with UNSERVED_REASONS in data.js (English wording kept there for the phone app).
  // Older saves stored that English text; convert to the language-neutral ids used now.
  const REASON_IDS = ["full", "blocked", "breakdown"];
  const OLD_REASON = Object.fromEntries(UNSERVED_REASONS.map((text, i) => [text, REASON_IDS[i]]));
  const OLD_STATUS = { Received: "received", "In review": "review", Cleared: "cleared" };
  const fixReason = r => { if (r && OLD_REASON[r.reason]) r.reason = OLD_REASON[r.reason]; return r; };

  // Today's collection records. Archived into `history` and reset on a new date.
  //   day.stops[areaId]  = { status: "collected" | "unserved", ... proof ... }
  //   day.trucks[truckId] = { ended: { reason, photo proof ... } }
  let day = store.get("day", null);
  let photos = store.get("photos", {});
  if (day) { Object.values(day.stops).forEach(r => { fixReason(r); fixReason(r.recovered); }); Object.values(day.trucks).forEach(x => fixReason(x.ended)); }
  if (!day || day.key !== dateKey()) {
    if (day && Object.keys(day.stops).length) archiveDay(day);
    day = { key: dateKey(), stops: {}, trucks: {} };
    photos = {};
    store.set("day", day); store.set("photos", photos);
    carry = carry.filter(c => c.date >= day.key); store.set("carry", carry);
  }
  function archiveDay(d) {
    const stops = {}, ended = {};
    for (const [id, r] of Object.entries(d.stops)) {
      stops[id] = { s: r.status === "collected" ? "c" : "u", t: r.truck, at: r.at, r: r.reason || null, a: r.action?.kind || null, ty: r.types || [] };
    }
    for (const [id, x] of Object.entries(d.trucks)) if (x.ended) ended[id] = x.ended.reason;
    history[d.key] = { stops, ended };
    const oldest = dateKey(addDays(new Date(), -HISTORY_DAYS));
    Object.keys(history).forEach(k => { if (k < oldest) delete history[k]; });
    store.set("history", history);
  }
  const saveDay = () => store.set("day", day);
  function savePhoto(dataUrl) {
    const id = uid();
    photos[id] = dataUrl;
    if (store.set("photos", photos)) return id;
    delete photos[id];
    return null;
  }

  // ---------- Schedule (regular days + announcements that cancel or add a collection) ----------
  if (!announcements) {
    // Two clearly-marked samples so the feature is visible in a demo
    const now = new Date();
    let undas = new Date(now.getFullYear(), 10, 1);
    if (undas < addDays(now, -2)) undas = new Date(now.getFullYear() + 1, 10, 1);
    announcements = [
      { id: uid(), kind: "cancel", scope: "all", from: dateKey(undas), to: dateKey(addDays(undas, 1)), createdAt: Date.now() - 864e5, sample: true,
        title: { en: "No collection on Nov 1–2 (Undas)", tl: "Walang koleksyon sa Nob 1–2 (Undas)" },
        body: { en: "Garbage collection is suspended for All Saints' and All Souls' Day. Please keep your garbage inside until your next collection day.", tl: "Walang koleksyon ng basura sa Undas. Pakitago muna ang basura sa loob hanggang sa susunod ninyong araw ng koleksyon." } },
      { id: uid(), kind: "notice", scope: "all", from: dateKey(now), to: dateKey(addDays(now, 10)), createdAt: Date.now() - 2 * 864e5, sample: true,
        title: { en: "Segregation reminder", tl: "Paalala sa paghihiwalay ng basura" },
        body: { en: "Bag biodegradable and non-biodegradable waste separately. Mixed garbage may be left uncollected.", tl: "Ihiwalay ang nabubulok at di-nabubulok na basura. Maaaring hindi kunin ang halo-halong basura." } },
    ];
    store.set("announcements", announcements);
  }
  const inScope = (n, a) => n.scope === "all" || n.scope === "group:" + a.group || n.scope === "area:" + a.id;
  const overrideFor = (a, dk) => announcements
    .filter(n => n.kind !== "notice" && dk >= n.from && dk <= n.to && inScope(n, a))
    .sort((x, y) => y.createdAt - x.createdAt)[0];
  function servedOn(a, date) {
    const dk = dateKey(date), o = overrideFor(a, dk);
    if (o) return o.kind === "extra";
    return a.days.includes(date.getDay()) || carry.some(c => c.areaId === a.id && c.date === dk);
  }
  let servedCache = new Map();                         // today's answer per area (cleared when the schedule changes)
  const scheduleChanged = () => { servedCache = new Map(); rev++; dirty = true; };
  function servedToday(a) {
    if (!servedCache.has(a.id)) servedCache.set(a.id, servedOn(a, new Date()));
    return servedCache.get(a.id);
  }
  function nextCollection(area, from = new Date(), skipToday = false) {
    for (let i = skipToday ? 1 : 0; i < 30; i++) { const d = addDays(from, i); if (servedOn(area, d)) return { date: d, inDays: i }; }
    return null;
  }
  // The next regular day ignoring announcements — to tell residents when a change affects them
  function regularNext(area, from = new Date()) {
    for (let i = 0; i < 8; i++) { const d = addDays(from, i); if (area.days.includes(d.getDay())) return d; }
    return null;
  }

  // ---------- Route geometry ----------
  // Each truck's path follows the streets on its route sheets (routes.generated.js).
  // A truck with two routes drives them one after the other along the same path.
  function cumulative(pts) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + haversine(pts[i - 1], pts[i]));
    return cum;
  }
  function pointOn(pts, cum, d) {
    const len = cum[cum.length - 1];
    d = Math.max(0, Math.min(len, d));
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const seg = cum[i] - cum[i - 1] || 1;
    const f = (d - cum[i - 1]) / seg;
    const [a, b] = [pts[i - 1], pts[i] || pts[i - 1]];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  }
  TRUCKS.forEach(t => {
    const geo = ROUTE_GEO.trucks[t.id];
    t.loop = geo.path;
    t.cum = cumulative(t.loop);
    t.length = t.cum[t.cum.length - 1];
    t.steps = geo.steps || [];
    const indexAt = d => { let i = 0; while (i < t.cum.length - 1 && t.cum[i] < d) i++; return i; };
    t.legs = geo.routes.map(r => {
      const a = indexAt(r.from), b = indexAt(r.to);
      return { ...r, a, b, from: t.cum[a], to: t.cum[b], pts: t.loop.slice(a, b + 1) };
    });
  });
  const pointAt = (t, d) => pointOn(t.loop, t.cum, d);
  // Each area's pickup stop is its section's point on the route
  AREAS.forEach(a => {
    const t = truckById(a.truck);
    const leg = t.legs.find(l => l.id === a.route);
    const sec = leg.sections.find(s => s.name === a.section);
    let best = leg.a;
    for (let i = leg.a; i <= leg.b; i++) if (haversine(t.loop[i], sec.latlng) < haversine(t.loop[best], sec.latlng)) best = i;
    a.stopD = t.cum[best];
    a.latlng = t.loop[best];
    a.approx = sec.approx;            // not named on the map — placed beside its neighbours
    a.streets = sec.streets;
  });

  // ---------- Stop records ----------
  const rec = a => day.stops[a.id];
  const ended = t => day.trucks[t.id]?.ended;
  const todayStops = t => AREAS.filter(a => a.truck === t.id && servedToday(a)).sort((x, y) => x.stopD - y.stopD);
  const nextPending = t => ended(t) ? null : todayStops(t).find(a => !rec(a));
  // Unserved areas that management handed to this truck
  const extras = t => ended(t) ? [] : AREAS.filter(a => { const r = rec(a); return r && r.status === "unserved" && r.action && r.action.truck === t.id; });
  function truckLoad(t) {
    if (ended(t)?.reason === "full") return 100;
    const stops = todayStops(t);
    const own = stops.filter(a => rec(a)?.status === "collected" && rec(a).truck === t.id).length;
    const extra = AREAS.filter(a => a.truck !== t.id && rec(a)?.status === "collected" && rec(a).truck === t.id).length;
    return Math.min(98, Math.round((stops.length ? own / stops.length * 82 : 0) + extra * 8));
  }

  // Resume each truck where today's records left it
  TRUCKS.forEach(t => {
    const stops = todayStops(t);
    const doneD = stops.filter(a => rec(a)?.status === "collected").map(a => a.stopD);
    // start at the beginning of the first route that has a pickup today
    const firstLeg = stops.length ? t.legs.find(l => l.id === stops[0].route) : null;
    t.d = doneD.length ? Math.max(...doneD) : firstLeg ? firstLeg.from : 0;
    t.pos = ended(t)?.latlng || pointAt(t, t.d);
    t.state = "route"; t.current = null; t.wait = 0; t.detour = null;
    t.manual = t.id === manualTruck;
  });

  // ---------- Sample data (clearly marked) so history, summaries and reports aren't empty ----------
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  }
  function windowStart(t, date) {
    const m = /(\d+):(\d+)\s*(AM|PM)/i.exec(t.window || "");
    const d = new Date(date);
    d.setHours(m ? (+m[1] % 12) + (/pm/i.test(m[3]) ? 12 : 0) : 6, m ? +m[2] : 0, 0, 0);
    return d.getTime();
  }
  function seedSamples() {
    const level = store.get("seeded", 0);
    if (!reports) reports = [];
    reports.forEach(r => { if (OLD_STATUS[r.status]) r.status = OLD_STATUS[r.status]; r.thread ||= []; if (r.mine === undefined) r.mine = !r.sample; });
    if (level >= 2) return;

    // 14 days of collection history
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    for (let i = 1; i <= 14; i++) {
      const d = addDays(today0, -i), dk = dateKey(d);
      if (history[dk]) continue;
      const rand = rng(+dk.replace(/-/g, ""));
      const stops = {}, endedT = {};
      TRUCKS.forEach(t => {
        const list = AREAS.filter(a => a.truck === t.id && !a.custom && a.days.includes(d.getDay())).sort((x, y) => x.stopD - y.stopD);
        const cut = list.length > 2 && rand() < 0.15 ? 1 + Math.floor(rand() * (list.length - 1)) : list.length;
        if (cut < list.length) endedT[t.id] = rand() < 0.85 ? "full" : "blocked";
        const start = windowStart(t, d);
        list.forEach((a, j) => {
          const at = start + (j + 1) * (7 + rand() * 9) * 60000;
          stops[a.id] = j < cut
            ? { s: "c", t: t.id, at, ty: [["bio", "residual"], ["residual", "recycle"], ["bio"]][j % 3] }
            : { s: "u", t: t.id, at: start + cut * 9 * 60000, r: endedT[t.id], a: rand() < 0.6 ? "redirect" : "reschedule" };
        });
      });
      history[dk] = { stops, ended: endedT, sample: true };
    }
    store.set("history", history);

    // Resident feedback
    const comments = [
      { en: "Truck came on time. Salamat po!", tl: "Dumating sa oras ang trak. Salamat po!" },
      { en: "The crew was polite and quick.", tl: "Magalang at mabilis ang mga tauhan." },
      { en: "Late today, but the ETA alert helped.", tl: "Medyo late ngayon, pero nakatulong ang ETA alert." },
      { en: "", tl: "" },
      { en: "Please also pass by the back street.", tl: "Pakidaanan din po ang likod na kalye." },
      { en: "Very helpful app for our street.", tl: "Malaking tulong ang app sa aming kalye." },
    ];
    const fr = rng(4242);
    for (let k = 0; k < 18; k++) {
      const a = AREAS[Math.floor(fr() * Math.min(AREAS.length, 59))];
      feedback.push({ rating: [5, 5, 4, 4, 4, 3, 5, 2][Math.floor(fr() * 8)], text: comments[k % comments.length], areaId: a.id, at: Date.now() - (1 + fr() * 13) * 864e5, sample: true });
    }
    store.set("feedback", feedback);

    // Reports with staff updates
    const A = i => AREAS[Math.min(i, AREAS.length - 1)];
    const near = (a, dy, dx) => [a.latlng[0] + dy, a.latlng[1] + dx];
    const staff = (text, status, daysAgo) => ({ by: "staff", text, status, at: Date.now() - daysAgo * 864e5 });
    const samples = [
      { type: "piling", area: A(5), off: [0.0004, -0.0003], ago: 0.15, status: "review", types: ["residual"],
        notes: { en: "Sacks piling beside the corner post.", tl: "Nagtatambak ang mga sako sa tabi ng poste sa kanto." },
        thread: [staff({ en: "Thanks — our team will check this today.", tl: "Salamat — titingnan ito ng aming team ngayong araw." }, "review", 0.1)] },
      { type: "dumping", area: A(40), off: [-0.0003, 0.0004], ago: 1.1, status: "received", types: ["bulky"],
        notes: { en: "Bulky waste left on the vacant lot.", tl: "May iniwang malalaking basura sa bakanteng lote." }, thread: [] },
      { type: "piling", area: A(16), off: [0.0002, 0.0003], ago: 2.2, status: "scheduled", types: ["bio", "residual"],
        notes: { en: "Garbage left out since Sunday.", tl: "Nakalabas na ang basura mula pa noong Linggo." },
        thread: [staff({ en: "Scheduled for pickup on the next collection day.", tl: "Naka-iskedyul na kunin sa susunod na araw ng koleksyon." }, "scheduled", 2)] },
      { type: "missed", area: A(23), off: [0, 0], ago: 3.4, status: "cleared", types: [],
        notes: { en: "Truck did not pass our street.", tl: "Hindi dumaan ang trak sa aming kalye." },
        thread: [staff({ en: "Truck 166 collected it the next morning.", tl: "Kinuha ito ng Truck 166 kinabukasan ng umaga." }, "cleared", 3)] },
      { type: "spill", area: A(30), off: [-0.0002, -0.0002], ago: 5.3, status: "cleared", types: ["residual"],
        notes: { en: "Leak from the truck along the main road.", tl: "May tumagas mula sa trak sa main road." },
        thread: [staff({ en: "Road cleaned by the street sweepers.", tl: "Nalinis na ng mga street sweeper ang kalsada." }, "cleared", 5)] },
      { type: "dumping", area: A(44), off: [0.0003, 0.0001], ago: 8.2, status: "rejected", types: ["residual"],
        notes: { en: "Garbage near the creek.", tl: "May basura malapit sa sapa." },
        thread: [staff({ en: "Same spot as an earlier report — already handled.", tl: "Parehong lugar ng naunang report — naayos na." }, "rejected", 8)] },
    ];
    samples.forEach(s => {
      if (reports.some(r => r.sample && r.areaId === s.area.id && r.type === s.type)) return;
      reports.push({ id: uid(), type: s.type, areaId: s.area.id, latlng: near(s.area, ...s.off), notes: s.notes, photo: null, types: s.types,
        createdAt: Date.now() - s.ago * 864e5, status: s.status, thread: s.thread, verified: null, sample: true, mine: true });
    });
    reports.sort((a, b) => b.createdAt - a.createdAt);
    store.set("reports", reports);
    store.set("seeded", 2);
  }
  seedSamples();

  // ---------- Live GPS (Firebase Realtime Database) ----------
  // A phone app (e.g. GPSLogger) writes each truck's position to
  //   <database URL>/trucks/<device id>.json  as  { lat, lon, t, acc, spd }
  // The site listens for changes. A truck with a live position follows the real
  // GPS (no autopilot); trucks without one keep running on the simulation.
  const LIVE_STALE_MS = 120000;     // no update for 2 min → "signal lost"
  const ARRIVE_LIVE = 60;           // metres from a stop that counts as arrived (phone GPS accuracy)
  const LIVE = {
    url: (config.live?.url || "").trim().replace(/\/+$/, "").replace(/\.json$/, ""),
    devices: config.live?.devices || {},
    data: {}, rx: {}, loaded: false, status: "off", lastMsg: 0, es: null, poll: null,
  };
  const deviceFor = t => String(LIVE.devices[t.id] ?? `truck-${t.id}`).trim();
  function liveFix(t) {
    if (!LIVE.url) return null;
    const id = deviceFor(t), n = id && LIVE.data[id];
    if (!n || typeof n !== "object") return null;
    const lat = +n.lat, lon = +(n.lon ?? n.lng);
    if (!isFinite(lat) || !isFinite(lon) || (!lat && !lon)) return null;
    let ts = +n.t || +n.time || 0;
    if (ts && ts < 1e12) ts *= 1000;                   // GPSLogger sends seconds
    const seen = Math.max(LIVE.rx[id] || 0, ts || 0);   // when we last heard from it
    return { pos: [lat, lon], seen, acc: +n.acc || null, spd: +n.spd || null, test: !!n.test, stale: Date.now() - seen > LIVE_STALE_MS };
  }
  function setLiveStatus(s) { if (LIVE.status !== s) { LIVE.status = s; dirty = true; } }
  // Apply a Firebase streaming "put"/"patch" event at its path
  function applyLive(path, data, merge) {
    const parts = path.split("/").filter(Boolean);
    if (!parts.length) {
      if (merge) Object.assign(LIVE.data, data || {}); else LIVE.data = data || {};
      if (LIVE.loaded) Object.keys(data || {}).forEach(k => (LIVE.rx[k] = Date.now()));
      LIVE.loaded = true;
    } else {
      let o = LIVE.data;
      for (const p of parts.slice(0, -1)) o = (o[p] ??= {});
      const last = parts[parts.length - 1];
      if (data === null) delete o[last];
      else o[last] = merge && typeof o[last] === "object" ? { ...o[last], ...data } : data;
      LIVE.rx[parts[0]] = Date.now();
    }
    LIVE.lastMsg = Date.now();
    setLiveStatus("ok");
    dirty = true;
  }
  // Fallback when streaming isn't possible: fetch the whole list every 5 s
  function pollLive() {
    if (LIVE.poll) return;
    let prev = {};
    const once = async () => {
      try {
        const res = await fetch(LIVE.url + "/trucks.json", { cache: "no-store" });
        if (!res.ok) throw new Error(res.status);
        const data = (await res.json()) || {};
        for (const [k, v] of Object.entries(data)) if (JSON.stringify(v) !== JSON.stringify(prev[k]) && LIVE.loaded) LIVE.rx[k] = Date.now();
        prev = data; LIVE.data = data; LIVE.loaded = true; LIVE.lastMsg = Date.now();
        setLiveStatus("ok"); dirty = true;
      } catch { setLiveStatus("error"); }
    };
    once();
    LIVE.poll = setInterval(once, 5000);
  }
  function connectLive() {
    if (!LIVE.url) return;
    setLiveStatus("connecting");
    if (!window.EventSource) return pollLive();
    const es = new EventSource(LIVE.url + "/trucks.json");
    LIVE.es = es;
    es.addEventListener("put", e => { const m = JSON.parse(e.data); applyLive(m.path, m.data, false); });
    es.addEventListener("patch", e => { const m = JSON.parse(e.data); applyLive(m.path, m.data, true); });
    es.addEventListener("keep-alive", () => { LIVE.lastMsg = Date.now(); setLiveStatus("ok"); });
    es.addEventListener("cancel", () => { setLiveStatus("denied"); es.close(); });   // database rules refused reading
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) { LIVE.es = null; pollLive(); }   // not a stream (or blocked) → poll
      else setLiveStatus("error");                                                  // browser will retry by itself
    };
  }
  // Writes a test position for a truck (from the Settings tab) — checks the whole chain without a phone
  async function sendTestPosition(t) {
    if (!LIVE.url) return toast(tr("live.needUrl"), "error");
    const stop = todayStops(t)[0] || AREAS.find(a => a.truck === t.id);
    const at = stop ? stop.latlng : t.loop[0];
    const body = { lat: +(at[0] + 0.0012).toFixed(6), lon: +(at[1] + 0.0008).toFixed(6), t: Math.round(Date.now() / 1000), acc: 8, test: true };
    try {
      const res = await fetch(`${LIVE.url}/trucks/${encodeURIComponent(deviceFor(t))}.json`, { method: "PUT", body: JSON.stringify(body) });
      if (!res.ok) throw new Error(res.status === 401 ? "denied" : res.status);
      toast(tr("live.testSent", { id: t.id }));
    } catch (e) { toast(tr(String(e.message) === "denied" ? "live.testDenied" : "live.testFail"), "error"); }
  }
  // Rough distance along the truck's own path closest to a GPS fix (for directions and ETA)
  function nearestD(t, pos) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < t.loop.length; i++) {
      const d = haversine(t.loop[i], pos) + Math.abs(t.cum[i] - t.d) * 0.05;   // prefer staying near current progress
      if (d < bd) { bd = d; best = i; }
    }
    return t.cum[best];
  }

  // ---------- Photos: stamping, demo placeholders ----------
  // Burns the truck/area, time and GPS onto the image itself so the proof
  // can't be separated from when and where it was taken.
  function stamp(canvas, lines) {
    const ctx = canvas.getContext("2d");
    const fs = Math.max(11, Math.round(canvas.width / 46));
    const pad = Math.round(fs * 0.7), h = pad * 2 + lines.length * fs * 1.35;
    ctx.fillStyle = "rgba(7,26,11,.78)";
    ctx.fillRect(0, canvas.height - h, canvas.width, h);
    ctx.textBaseline = "top";
    lines.forEach((line, i) => {
      ctx.font = `${i === 0 ? 700 : 500} ${fs}px system-ui, sans-serif`;
      ctx.fillStyle = i === lines.length - 1 ? "#f9a53e" : "#fff";
      ctx.fillText(line, pad, canvas.height - h + pad + i * fs * 1.35, canvas.width - pad * 2);
    });
    return canvas.toDataURL("image/jpeg", 0.62);
  }
  function fitCanvas(source, w, h, max = PHOTO_MAX) {
    const scale = Math.min(1, max / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.round(w * scale); c.height = Math.round(h * scale);
    c.getContext("2d").drawImage(source, 0, 0, c.width, c.height);
    return c;
  }
  function loadImage(src) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
  function readPhoto(file, max = 900) {
    return new Promise(resolve => {
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = async () => {
        const img = await loadImage(reader.result);
        resolve(img ? fitCanvas(img, img.width, img.height, max).toDataURL("image/jpeg", 0.7) : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }
  // Placeholder image for autopilot trucks — clearly labelled, never stored.
  const demoCache = new Map();
  function demoPhoto(kind, lines) {
    const key = kind + lines.join("|");
    if (demoCache.has(key)) return demoCache.get(key);
    const c = document.createElement("canvas");
    c.width = 640; c.height = 420;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 640, 420);
    if (kind === "full") { g.addColorStop(0, "#7f1d1d"); g.addColorStop(1, "#1f2937"); }
    else { g.addColorStop(0, "#17602a"); g.addColorStop(1, "#334155"); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, 640, 420);
    ctx.strokeStyle = "rgba(255,255,255,.08)"; ctx.lineWidth = 18;
    for (let x = -420; x < 640; x += 60) { ctx.beginPath(); ctx.moveTo(x, 420); ctx.lineTo(x + 420, 0); ctx.stroke(); }
    ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.textAlign = "center";
    ctx.font = "800 30px system-ui, sans-serif";
    ctx.fillText(kind === "full" ? "TRUCK FULL" : "COLLECTED", 320, 150);
    ctx.font = "600 16px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.fillText("Simulated photo — demo only, no camera used", 320, 185);
    ctx.textAlign = "left";
    const url = stamp(c, lines);
    demoCache.set(key, url);
    return url;
  }
  const photoFor = r => (r.photoId && photos[r.photoId]) ||
    demoPhoto(r.status === "collected" ? "ok" : "full", [r.label, `${stampTime(r.at)} · GPS ${ll(r.latlng)}`, "SIMULATED PHOTO (demo)"]);

  const SOURCE_TONE = { live: "bg-brand-100 text-brand-800", file: "bg-amber-100 text-amber-800", demo: "bg-slate-200 text-slate-700" };
  const wasteChips = types => (types || []).map(id => {
    const w = WASTE_TYPES.find(x => x.id === id);
    return w ? `<span class="pill text-white" style="background:${w.color}">${esc(wasteText(id))}</span>` : "";
  }).join("");
  function proofBadges(r, area) {
    const out = [chip(tr("source." + r.source), SOURCE_TONE[r.source])];
    if (area) {
      const d = Math.round(haversine(r.latlng, area.latlng));
      out.push(d <= 60 ? chip(tr("badge.atArea"), "bg-brand-100 text-brand-800") : chip(tr("badge.fromArea", { m: d }), "bg-slate-100 text-slate-700"));
    }
    if (r.verified) out.push(chip(r.verified.ok === false ? tr("badge.flagged") : tr("badge.verified"), r.verified.ok === false ? "bg-red-100 text-red-700" : "bg-sky-100 text-sky-800"));
    else out.push(chip(tr("badge.awaiting"), "bg-slate-100 text-slate-500"));
    return out.join(" ");
  }
  function wastePicker(name, selected = []) {
    return `<div class="flex flex-wrap gap-2">${WASTE_TYPES.map(w => `
      <label class="wchip" title="${esc(tr("waste." + w.id + ".hint"))}">
        <input type="checkbox" name="${name}" value="${w.id}" ${selected.includes(w.id) ? "checked" : ""} />
        <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${w.color}"></span>${esc(wasteText(w.id))}
      </label>`).join("")}</div>`;
  }
  const pickedWaste = (name, root = document) => $$(`input[name="${name}"]:checked`, root).map(i => i.value);

  // ---------- Recording proof ----------
  function changed() { saveDay(); rev++; dirty = true; }

  function submitProof(t, area, { photoId, source, types, note }) {
    const prev = rec(area);
    day.stops[area.id] = {
      status: "collected", at: Date.now(), truck: t.id, latlng: t.pos.slice(),
      label: `Truck ${t.id} · ${area.name}`,
      photoId, source, types, note: note || "", verified: null,
      recovered: prev ? { ...prev } : null,   // keeps the earlier "unserved" proof on file
    };
    t.state = "route"; t.current = null; t.wait = 0;
    if (t.detour?.target === area.id) t.detour = null;
    changed();
  }

  function endRouteEarly(t, { photoId, source, reason, note }) {
    const remaining = todayStops(t).filter(a => !rec(a));
    const near = t.current || remaining[0];
    const proof = {
      status: "unserved", at: Date.now(), truck: t.id, latlng: t.pos.slice(),
      label: `Truck ${t.id} · ${near ? (t.current ? "at " : "on the way to ") + near.name : "route ended"}`,
      reason, note: note || "", photoId, source, verified: null,
    };
    extras(t).forEach(a => { rec(a).action = null; rec(a).bounced = t.id; }); // back to management
    day.trucks[t.id] = { ended: proof };
    remaining.forEach(a => { day.stops[a.id] = { ...proof, action: null }; });
    t.state = "ended"; t.current = null; t.wait = 0; t.detour = null;
    changed();
    return remaining.length;
  }

  // ---------- Street routing for redirected trucks ----------
  // A truck sent to an unserved area outside its route asks the OSRM routing
  // service for a street path. Offline it falls back to a straight line.
  async function planDetour(t, area) {
    t.detour = { target: area.id, pending: true };
    dirty = true;
    let pts = null, raw = [];
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${t.pos[1]},${t.pos[0]};${area.latlng[1]},${area.latlng[0]}?overview=full&geometries=geojson&steps=true`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const j = await res.json();
      if (j.code === "Ok") {
        pts = j.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
        raw = j.routes[0].legs[0].steps.map(s => [s.maneuver.location[1], s.maneuver.location[0], s.maneuver.type, s.maneuver.modifier || "", s.name || ""]);
      }
    } catch { /* offline or the service is busy */ }
    if (t.detour?.target !== area.id) return;          // plans changed while waiting
    const approx = !pts;
    pts = [t.pos.slice(), ...(pts || []), area.latlng.slice()];
    const cum = cumulative(pts);
    let from = 0;
    const steps = raw.filter(s => s[2] !== "arrive").map(s => {
      let best = from, bd = Infinity;
      for (let i = from; i < pts.length; i++) { const d = haversine(pts[i], [s[0], s[1]]); if (d < bd) { bd = d; best = i; } }
      from = best;
      return [cum[best], s[2], s[3], s[4]];
    });
    t.detour = { target: area.id, pts, cum, length: cum[cum.length - 1], d: 0, steps, approx };
    drawDetours();
    dirty = true;
  }

  // ---------- Truck simulation ----------
  function setState(t, state, current) {
    if (t.state !== state || t.current !== current) { t.state = state; t.current = current; t.wait = 0; dirty = true; }
  }
  function arriveAt(t, area, dt) {
    setState(t, "atStop", area);
    if (t.manual) return;                     // a real driver must submit the photo
    t.wait += dt * 1000;
    if (t.wait >= DWELL_MS) {
      submitProof(t, area, { photoId: null, source: "demo", types: [["bio", "residual"], ["residual", "recycle"], ["bio"]][AREAS.indexOf(area) % 3] });
    }
  }
  // A truck with a real GPS position: place it where the phone says, and work out
  // whether it's at a stop. A real driver always submits the photo (no autopilot).
  function stepLive(t, fix) {
    t.pos = fix.pos;
    t.d = nearestD(t, fix.pos);
    if (t.detour) { t.detour = null; drawDetours(); }
    if (ended(t)) return setState(t, "ended", null);
    const target = nextPending(t) || extras(t)[0];
    if (!target) return setState(t, todayStops(t).length || truckLoad(t) ? "done" : "none", null);
    t.target = target;
    if (haversine(fix.pos, target.latlng) <= ARRIVE_LIVE) return setState(t, "atStop", target);
    setState(t, target.truck === t.id ? "route" : "detour", null);
  }
  function stepTruck(t, dt) {
    const fix = liveFix(t);
    const wasLive = !!t.live;
    t.live = fix;
    if (!!fix !== wasLive) dirty = true;
    if (fix) return stepLive(t, fix);
    if (ended(t)) return setState(t, "ended", null);
    const np = nextPending(t);
    if (np) {
      if (t.d < np.stopD - 1) {
        t.d = Math.min(np.stopD, t.d + SIM_SPEED * dt);
        t.pos = pointAt(t, t.d);
        setState(t, "route", null);
      } else arriveAt(t, np, dt);
      return;
    }
    const ex = extras(t)[0];
    if (ex) {
      if (!t.detour || t.detour.target !== ex.id) { planDetour(t, ex); return setState(t, "planning", null); }
      if (t.detour.pending) return setState(t, "planning", null);
      const r = t.detour;
      if (r.d < r.length - 1) {
        r.d = Math.min(r.length, r.d + SIM_SPEED * dt);
        t.pos = pointOn(r.pts, r.cum, r.d);
        t.target = ex;
        if (t.state !== "detour") setState(t, "detour", null);
      } else arriveAt(t, ex, dt);
      return;
    }
    if (t.detour) { t.detour = null; drawDetours(); }
    setState(t, todayStops(t).length || truckLoad(t) ? "done" : "none", null);
  }
  function truckStatusText(t) {
    const e = ended(t);
    if (e) return tr("truck.endedEarly", { reason: reasonText(e.reason).toLowerCase() });
    if (t.state === "atStop" && t.current) return tr("truck.atStop", { name: t.current.name });
    if (t.state === "route") { const n = nextPending(t) || extras(t)[0]; return n ? tr("truck.next", { name: n.name }) : tr("truck.depot"); }
    if (t.state === "planning") return tr("truck.planning");
    if (t.state === "detour") return tr("truck.redirected", { name: t.target?.name || "" });
    if (t.state === "done") return tr("truck.done");
    return tr("truck.none");
  }

  // ---------- Resident view of an area ----------
  function areaStatus(area) {
    const r = rec(area);
    if (r?.status === "collected") return { kind: "collected", label: tr("status.collected"), tone: "green", t: truckById(r.truck), r };
    if (r?.status === "unserved") {
      const act = r.action;
      let detail = tr("unserved.arranging"), t = truckById(r.truck), eta = null, next = tr("unserved.awaiting");
      if (act?.kind === "reschedule") { next = tr("unserved.rescheduled"); detail = tr("unserved.newDate", { date: fmtDate(keyToDate(act.date)) }); }
      else if (act) {
        t = truckById(act.truck);
        next = tr(act.kind === "redirect" ? "unserved.redirected" : "unserved.assigned", { truck: t.id });
        if (t.current === area) detail = tr("unserved.arrivedWait");
        else {
          const left = t.detour?.target === area.id && !t.detour.pending ? t.detour.length - t.detour.d : haversine(t.pos, area.latlng) * 1.3;
          eta = Math.max(1, Math.round(left / REAL_SPEED / 60 + todayStops(t).filter(a => !rec(a)).length * STOP_MIN));
          detail = tr("unserved.eta", { n: eta });
        }
      }
      return { kind: "unserved", label: tr("status.notCollected"), tone: "red", t, r, detail, next, eta };
    }
    const t = truckById(area.truck);
    if (!servedToday(area)) {
      const o = overrideFor(area, day.key);
      if (o?.kind === "cancel") return { kind: "cancelled", label: tr("status.cancelled"), tone: "amber", t, ann: o };
      return { kind: "none", label: tr("status.none"), tone: "slate", t };
    }
    if (t.current === area) return { kind: "arrived", label: tr("status.arrived"), tone: "amber", eta: 0, t };
    const before = todayStops(t).filter(a => !rec(a) && a.stopD < area.stopD).length;
    // live trucks: straight-line distance × 1.4 for street detours; simulated: distance left along the route
    const left = t.live ? haversine(t.pos, area.latlng) * 1.4 : Math.max(0, area.stopD - t.d);
    const eta = Math.max(1, Math.round(left / REAL_SPEED / 60 + before * STOP_MIN));
    return { kind: "onway", label: tr("status.onway"), tone: "amber", eta, t };
  }

  // ---------- Map ----------
  const map = L.map("map", { zoomControl: true, scrollWheelZoom: false }).setView(MAP_CENTER, 15);
  function tileLayers() {
    return {
      terrain: L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
        maxZoom: 17, subdomains: "abc",
        attribution: "&copy; OpenStreetMap contributors, SRTM | &copy; OpenTopoMap (CC-BY-SA)",
      }),
      // Esri street map: unlike openstreetmap.org tiles, it also works when the page is
      // opened as a file (double-clicked), where the browser sends no website address
      streets: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19, attribution: "Tiles &copy; Esri — Esri, HERE, Garmin, &copy; OpenStreetMap contributors",
      }),
      satellite: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19, attribution: "Tiles &copy; Esri",
      }),
    };
  }
  const layers = tileLayers();
  const baseLayers = { [tr("layer.satellite")]: layers.satellite, [tr("layer.streets")]: layers.streets, [tr("layer.terrain")]: layers.terrain };
  // Road + place-name labels drawn over the satellite photo
  const labels = L.layerGroup([
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19 }),
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19 }),
  ]);
  layers.satellite.addTo(map);
  labels.addTo(map);
  L.control.layers(baseLayers, { [tr("layer.labels")]: labels }, { position: "topright" }).addTo(map);

  // Offline fallback: show a grid basemap only when the device is really
  // offline, or when not a single tile of the current layer could load.
  let tilesLoaded = 0;
  const setOffline = off => $("#map").classList.toggle("map-offline", off);
  Object.values(layers).forEach(layer => {
    layer.on("tileload", () => { tilesLoaded++; setOffline(false); });
    layer.on("tileerror", () => { if (!tilesLoaded || !navigator.onLine) setOffline(true); });
  });
  map.on("baselayerchange", () => { tilesLoaded = 0; });
  if (!navigator.onLine) setOffline(true);
  window.addEventListener("online", () => { setOffline(false); map.eachLayer(l => l.redraw && l.redraw()); });
  window.addEventListener("offline", () => setOffline(true));
  map.on("focus", () => map.scrollWheelZoom.enable());
  map.on("blur", () => map.scrollWheelZoom.disable());
  $("#map").dataset.offlineText = tr("map.offline");

  const routeLayer = L.layerGroup().addTo(map);
  const detourLayer = L.layerGroup().addTo(map);
  const stopLayer = L.layerGroup().addTo(map);
  const reportLayer = L.layerGroup().addTo(map);
  let homeMarker = null;

  TRUCKS.forEach(t => {
    // one line per route sheet; routes with no pickup today are drawn faint
    t.legs.forEach(leg => {
      const active = AREAS.some(a => a.route === leg.id && servedToday(a));
      L.polyline(leg.pts, active ? { color: t.color, weight: 5, opacity: 0.9 } : { color: t.color, weight: 3, opacity: 0.4, dashArray: "4 8" })
        .bindTooltip(`${leg.id} · ${tr("truck.label", { id: t.id })}${active ? "" : " · " + tr("map.noPickupToday")}`, { sticky: true })
        .addTo(routeLayer);
    });
    const icon = L.divIcon({
      className: "",
      iconSize: [40, 40], iconAnchor: [20, 20],
      html: `<div class="truck-marker"><span class="pulse" style="background:${t.color}"></span><span class="tag">${t.id}</span><div class="bubble" style="background:${t.color}">${svg("truck", "w-5 h-5")}</div></div>`,
    });
    t.marker = L.marker(t.pos, { icon, zIndexOffset: 1000 }).addTo(map).bindPopup(() => truckPopup(t));
  });
  function drawDetours() {
    detourLayer.clearLayers();
    TRUCKS.forEach(t => {
      if (!t.detour?.pts) return;
      L.polyline(t.detour.pts, { color: t.color, weight: 4, opacity: 0.95, dashArray: "2 7" })
        .bindTooltip(tr(t.detour.approx ? "map.detourApprox" : "map.detour", { id: t.id }), { sticky: true }).addTo(detourLayer);
    });
    drawDriverMap(true);
  }
  const fitRoutes = () => { map.invalidateSize(); map.fitBounds(L.latLngBounds(TRUCKS.flatMap(t => t.loop)), { padding: [24, 24] }); };
  function truckPopup(t) {
    return `<p class="font-bold text-brand-800">${tr("truck.label", { id: t.id })} <span class="text-slate-400 font-medium">· ${t.type}</span></p>
      <p class="text-xs text-slate-500">${t.routes}</p>
      <p class="text-xs mt-1"><b>${tr("truck.driver")}:</b> ${esc(t.driver)}</p>
      <p class="text-xs"><b>${tr("truck.status")}:</b> ${esc(truckStatusText(t))}</p>
      <p class="text-xs"><b>${tr("truck.load")}:</b> ${truckLoad(t)}%</p>`;
  }

  function drawStops() {
    stopLayer.clearLayers();
    AREAS.forEach(a => {
      if (a.id === myAreaId) return;
      const r = rec(a);
      const fill = r?.status === "collected" ? "#16a34a" : r?.status === "unserved" ? "#dc2626" : truckById(a.truck).color;
      const state = r?.status === "collected" ? tr("map.collected") : r?.status === "unserved" ? tr("map.notCollected") : servedToday(a) ? tr("map.pending") : tr("map.noPickupToday");
      L.circleMarker(a.latlng, { radius: r ? 6 : 5, color: "#fff", weight: 2, fillColor: fill, fillOpacity: servedToday(a) || r ? 0.95 : 0.45 })
        .bindTooltip(`${esc(a.name)}<br><span style="opacity:.7">${a.route} · ${tr("truck.label", { id: a.truck })} · ${esc(groupLabel(a))}<br>${state}${a.approx ? " · " + tr("map.approx") : ""}</span>`)
        .on("click", () => setMyArea(a.id, true))
        .addTo(stopLayer);
    });
    const me = areaById(myAreaId);
    if (homeMarker) homeMarker.remove();
    homeMarker = L.marker(me.latlng, {
      icon: L.divIcon({ className: "", iconSize: [34, 34], iconAnchor: [17, 17], html: `<div class="home-marker">${svg("home")}</div>` }),
      zIndexOffset: 900,
    }).addTo(map).bindTooltip(tr("map.myArea", { name: esc(me.name) }));
  }

  const OPEN_STATUSES = ["received", "review", "scheduled"];
  function drawReports() {
    reportLayer.clearLayers();
    reports.filter(r => OPEN_STATUSES.includes(r.status)).forEach(r => {
      const area = areaById(r.areaId);
      L.marker(r.latlng, {
        icon: L.divIcon({ className: "", iconSize: [30, 30], iconAnchor: [15, 30], html: `<div class="report-marker">${svg("trash")}</div>` }),
      }).bindPopup(`
        ${r.photo ? `<img src="${r.photo}" alt="" style="width:200px;height:120px;object-fit:cover;border-radius:10px;margin-bottom:8px">` : ""}
        <p class="font-bold text-red-700">${esc(rtypeText(r.type))}</p>
        <p class="text-xs text-slate-500">${esc(area?.name)} · ${timeAgo(r.createdAt)}</p>
        ${r.notes ? `<p class="text-xs mt-1">${esc(txt(r.notes))}</p>` : ""}
        <p class="text-xs mt-1"><b>${tr("truck.status")}:</b> ${esc(statusText(r.status))}</p>`).addTo(reportLayer);
    });
  }

  $("#legend").innerHTML = TRUCKS.map(t =>
    `<button data-fly="${t.id}" class="inline-flex items-center gap-1.5 rounded-full bg-white/95 shadow px-2.5 py-1 text-xs font-bold hover:bg-white">
      <span class="w-2.5 h-2.5 rounded-full" style="background:${t.color}"></span><span class="hidden sm:inline">${tr("legend.truck")}</span> ${t.id}</button>`).join("")
    + `<span class="inline-flex items-center gap-1.5 rounded-full bg-white/95 shadow px-2.5 py-1 text-xs font-bold"><span class="w-2.5 h-2.5 rounded-full bg-green-600"></span>${tr("legend.collected")}</span>`
    + `<span class="inline-flex items-center gap-1.5 rounded-full bg-white/95 shadow px-2.5 py-1 text-xs font-bold"><span class="w-2.5 h-2.5 rounded-full bg-red-600"></span>${tr("legend.notCollected")}</span>`;

  $("#showReports").addEventListener("change", e => {
    e.target.checked ? reportLayer.addTo(map) : reportLayer.remove();
  });

  map.on("click", e => {
    if (!pickMode) return;
    setPicked([e.latlng.lat, e.latlng.lng]);
    togglePick(false);
    $("#report").scrollIntoView({ behavior: "smooth" });
  });

  // ---------- Roles ----------
  function setRole(next, byUser) {
    role = next;
    store.set("role", role);
    $$("#roleSwitch [data-role]").forEach(b => { const on = b.dataset.role === role; b.classList.toggle("is-on", on); b.setAttribute("aria-selected", String(on)); });
    $("#viewResident").classList.toggle("hidden", role !== "resident");
    $("#viewDriver").classList.toggle("hidden", role !== "driver");
    $("#viewAdmin").classList.toggle("hidden", role !== "admin");
    if (role === "resident" && byUser) { fitRoutes(); drawDetours(); }   // lines drawn while the map was hidden have no size
    if (role === "driver" && manualTruck === null && !store.get("manualSet", false)) setManual(driverTruckId);
    if (role === "driver") { buildDriverShell(); renderDriver(); setTimeout(() => drvMap?.invalidateSize(), 60); }
    renderAdmin(true);
    if (byUser) window.scrollTo(0, 0);
  }
  function setManual(id) {
    manualTruck = id;
    store.set("manualTruck", id); store.set("manualSet", true);
    TRUCKS.forEach(t => { t.manual = t.id === id; t.wait = 0; });
    dirty = true;
  }
  $("#roleSwitch").addEventListener("click", e => { const b = e.target.closest("[data-role]"); if (b) setRole(b.dataset.role, true); });

  // ---------- Area selection ----------
  function fillAreaSelect(sel, value) {
    const groups = [...SCHEDULE_GROUPS.map(g => g.id), "custom"];
    sel.innerHTML = groups.map(g => {
      const list = AREAS.filter(a => a.group === g);
      return list.length ? `<optgroup label="${esc(g === "custom" ? tr("group.custom") : tr("group." + g))}">${list.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</optgroup>` : "";
    }).join("");
    if (value) sel.value = value;
  }
  fillAreaSelect($("#areaSelect"));
  fillAreaSelect($("#reportArea"));

  let lastSig = null, etaAlerted = false, trackerSig = "";
  function setMyArea(id, fly) {
    myAreaId = id;
    store.set("area", id);
    lastSig = null; etaAlerted = false; trackerSig = "";
    $("#areaSelect").value = id;
    $("#reportArea").value = id;
    drawStops();
    renderHero();
    renderTracker();
    renderProofCard();
    renderSchedule();
    renderBanner();
    renderHistory();
    loadAreaPhoto();
    if (fly) map.flyTo(areaById(id).latlng, 16, { duration: 0.8 });
  }
  $("#areaSelect").addEventListener("change", e => setMyArea(e.target.value, true));

  // ---------- Hero + tracker ----------
  function renderHero() {
    const a = areaById(myAreaId);
    const t = truckById(a.truck);
    const n = nextCollection(a);
    const today = servedToday(a);
    const cancelled = overrideFor(a, day.key)?.kind === "cancel";
    $("#nextDate").textContent = !n ? "—" : today ? tr("hero.today") : n.inDays === 1 ? tr("hero.tomorrow") : fmtDate(n.date);
    const reg = regularNext(a);
    const moved = n && reg && dateKey(n.date) !== dateKey(reg);
    $("#nextDays").textContent = groupLabel(a) + " · " + t.window + (moved ? " · " + tr("hero.changed") : "");
    $("#todayBadge").textContent = cancelled ? tr("hero.cancelled") : today ? tr("hero.collectionDay") : tr("hero.noPickup");
    $("#todayBadge").className = "text-xs font-semibold rounded-full px-2.5 py-1 " + (cancelled ? "bg-red-50 text-red-700" : today ? "bg-accent-500/15 text-accent-600" : "bg-slate-100 text-slate-500");
  }

  function renderTracker() {
    const a = areaById(myAreaId);
    const s = areaStatus(a);
    const t = s.t;
    const sig = [a.id, s.kind, s.eta, s.next, s.detail, t.id, rev].join("|");
    if (sig === trackerSig) return;
    trackerSig = sig;
    const tone = { slate: "bg-slate-100 text-slate-600", amber: "bg-amber-100 text-amber-800", green: "bg-brand-100 text-brand-800", red: "bg-red-100 text-red-700" }[s.tone];
    const stage = { none: 0, cancelled: 0, onway: 2, arrived: 3, collected: 5 }[s.kind];

    // hero card
    $("#heroEta").textContent = s.kind === "onway" ? tr("eta.min", { n: s.eta }) : s.kind === "arrived" ? tr("eta.now") : s.kind === "collected" ? tr("eta.collected")
      : s.kind === "unserved" ? (s.eta ? tr("eta.min", { n: s.eta }) : tr("status.notCollected")) : "—";
    $("#heroTruck").textContent = `${tr("truck.label", { id: t.id })} · ${s.kind === "unserved" ? s.next : s.label}`;
    $("#miniTimeline").innerHTML = s.kind === "unserved"
      ? `<li class="w-full rounded-xl bg-red-50 text-red-700 text-xs font-semibold px-3 py-2 normal-case">${esc(tr("mini.unserved", { reason: reasonText(s.r.reason).toLowerCase() }))} ${esc(s.detail)}</li>`
      : s.kind === "cancelled"
        ? `<li class="w-full rounded-xl bg-amber-50 text-amber-800 text-xs font-semibold px-3 py-2 normal-case">${esc(txt(s.ann.title))}</li>`
        : ["mini.sched", "mini.dispatch", "mini.onway", "mini.arrived", "mini.done"].map((k, i) =>
          `<li class="mini-step ${stage && i < stage ? "done" : ""} ${stage && i === stage ? "current" : ""}"><span class="d"></span>${tr(k)}</li>`).join("");

    // side panel
    $("#trackStatusPill").className = "pill " + tone;
    $("#trackStatusPill").textContent = s.label;
    $("#trackArea").textContent = a.name;
    let items;
    if (s.kind === "unserved") {
      items = [
        { label: tr("tl.scheduled"), sub: `${fmtDate(new Date())}, ${truckById(a.truck).window}`, done: true },
        { label: tr("tl.dispatched"), sub: tr("tl.leftDepot", { truck: s.r.truck }), done: true },
        { label: tr("tl.notCollected"), sub: tr("tl.notCollectedSub", { reason: reasonText(s.r.reason), time: fmtTime(new Date(s.r.at)) }), bad: true },
        { label: s.next, sub: s.detail, current: true },
      ];
    } else {
      const n = nextCollection(a);
      items = [
        { label: tr("tl.scheduled"), sub: stage ? `${fmtDate(new Date())}, ${t.window}` : n ? tr("tl.next", { date: fmtDate(n.date), window: t.window }) : "", show: true },
        { label: tr("tl.dispatched"), sub: tr("tl.leftDepot", { truck: t.id }) },
        { label: tr("tl.onway"), sub: s.eta ? tr("tl.eta", { n: s.eta }) : "" },
        { label: tr("tl.arrived"), sub: s.kind === "arrived" ? tr("tl.waitingProof") : tr("tl.reached") },
        { label: tr("tl.completed"), sub: tr("tl.completedSub") },
      ].map((it, i) => ({ ...it, done: stage > 0 && i < stage, current: stage > 0 && i === stage }));
      if (s.kind === "cancelled") items[0] = { label: tr("status.cancelled"), sub: txt(s.ann.title), bad: true };
    }
    $("#timeline").innerHTML = items.map(it => `
      <li class="tl-item ${it.done ? "done" : ""} ${it.current ? "current" : ""} ${it.bad ? "bad" : ""}">
        <span class="tl-dot">${it.done ? svg("check", "w-3.5 h-3.5") : it.bad ? svg("x", "w-3.5 h-3.5") : ""}</span>
        <div class="-mt-0.5">
          <p class="text-sm font-bold ${it.done || it.current || it.bad ? "text-slate-800" : "text-slate-400"}">${esc(it.label)}</p>
          ${it.sub && (it.done || it.current || it.bad || it.show) ? `<p class="text-xs ${it.current ? "text-accent-600 font-semibold" : it.bad ? "text-red-600 font-semibold" : "text-slate-500"}">${esc(it.sub)}</p>` : ""}
        </div></li>`).join("");

    $("#driverInitials").textContent = initials(t.driver);
    $("#driverName").textContent = t.driver;
    $("#driverTruckLine").textContent = tr("tracker.driverLine", { truck: t.id, routes: t.routes }) + (t.live && !t.live.stale ? " · " + tr("live.short") : "");
  }
  $("#focusTruck").addEventListener("click", () => {
    const t = areaStatus(areaById(myAreaId)).t;
    map.flyTo(t.marker.getLatLng(), 17, { duration: 0.8 });
    t.marker.openPopup();
  });

  // Driver's photo, shown straight to the resident
  function renderProofCard() {
    const a = areaById(myAreaId), r = rec(a);
    if (!r) { $("#proofCard").innerHTML = ""; return; }
    const bad = r.status === "unserved";
    $("#proofCard").innerHTML = `
      <div class="mt-4 rounded-2xl overflow-hidden ring-1 ${bad ? "ring-red-200 bg-red-50" : "ring-brand-100 bg-brand-50/60"}">
        <button data-act="photo" data-kind="stop" data-id="${a.id}" class="block w-full" aria-label="${esc(tr("proof.enlarge"))}">
          <img src="${photoFor(r)}" alt="${esc(tr("proof.alt"))}" class="w-full aspect-[16/10] object-cover" />
        </button>
        <div class="p-3">
          <p class="text-xs font-bold ${bad ? "text-red-700" : "text-brand-800"}">${bad ? esc(tr("proof.unserved", { reason: reasonText(r.reason).toLowerCase() })) : esc(tr("proof.collected"))}</p>
          <p class="text-[11px] text-slate-500">${fmtStamp(r.at)} · GPS ${ll(r.latlng)}</p>
          <div class="mt-2 flex flex-wrap gap-1">${proofBadges(r, a)}</div>
          ${r.types?.length ? `<div class="mt-2 flex flex-wrap gap-1">${wasteChips(r.verified?.types || r.types)}</div>` : ""}
          ${r.recovered ? `<button data-act="photo" data-kind="prev" data-id="${a.id}" class="mt-2 text-[11px] font-bold text-slate-500 hover:underline">${esc(tr("proof.earlier", { reason: reasonText(r.recovered.reason).toLowerCase() }))}</button>` : ""}
        </div>
      </div>`;
  }

  function loadColor(load) { return load >= 100 ? "#dc2626" : load > 75 ? "#f28c1b" : "#43ad4c"; }
  // "LIVE GPS · 8s ago" / "GPS signal lost · 3 min ago" badge for trucks fed by a real tracker
  function liveBadge(t) {
    if (!t.live) return "";
    const ago = timeAgo(t.live.seen);
    return t.live.stale ? chip(tr("live.lost", { ago }), "bg-red-100 text-red-700") : chip(`<span class="live-dot"></span>${tr("live.badge", { ago })}`, "bg-brand-100 text-brand-800");
  }
  function renderFleet() {
    $("#fleetList").innerHTML = TRUCKS.map(t => {
      const load = truckLoad(t), e = ended(t);
      return `<li>
        <button data-fly="${t.id}" class="w-full flex items-center gap-3 py-3 text-left hover:bg-slate-50 rounded-xl px-2 -mx-2 transition">
          <span class="grid place-items-center w-10 h-10 rounded-xl text-white shrink-0" style="background:${t.color}">${svg("truck", "w-5 h-5")}</span>
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-2"><b class="text-sm">${tr("truck.label", { id: t.id })}</b><span class="text-[10px] font-bold text-slate-400">${t.type}</span>${liveBadge(t)}</span>
            <span class="block text-xs ${e ? "text-red-600 font-semibold" : "text-slate-500"} truncate">${esc(truckStatusText(t))}</span>
            <span class="meter mt-1.5"><span style="width:${load}%;background:${loadColor(load)}"></span></span>
          </span>
          <span class="text-xs font-bold ${load >= 100 ? "text-red-600" : "text-slate-500"}">${load}%</span>
        </button>
      </li>`;
    }).join("");
    TRUCKS.forEach(t => {
      const el = t.marker.getElement();
      el?.classList.toggle("is-full", !!ended(t));
      el?.classList.toggle("is-live", !!t.live && !t.live.stale && !ended(t));
    });
  }

  // ---------- Camera capture (in-app, stamped) ----------
  let activeStream = null, modalOnClose = null;
  function stopStream() { activeStream?.getTracks().forEach(track => track.stop()); activeStream = null; }

  /* Opens the camera inside the app. The photo is taken live (no gallery
     picker) and the time + truck GPS are burned in before it is stored.
     Resolves { photoId, source, types, reason, note } or null if cancelled. */
  function capturePhoto({ title, subtitle, lines, needTypes, reasons, submitLabel, tone = "brand" }) {
    return new Promise(resolve => {
      let shot = null, source = null, done = false;
      const finish = v => { if (done) return; done = true; stopStream(); modalOnClose = null; closeModal(); resolve(v); };
      openModal(`
        <form id="camForm" class="p-5 space-y-4 max-h-[92vh] overflow-y-auto" novalidate>
          <div>
            <h2 class="font-display font-800 text-xl ${tone === "red" ? "text-red-700" : "text-brand-800"}">${esc(title)}</h2>
            <p class="text-sm text-slate-500">${esc(subtitle)}</p>
          </div>
          <div class="relative rounded-2xl overflow-hidden bg-slate-900 aspect-[4/3] grid place-items-center">
            <video id="camVideo" autoplay playsinline muted class="hidden absolute inset-0 w-full h-full object-cover"></video>
            <img id="camShot" alt="" class="hidden absolute inset-0 w-full h-full object-cover" />
            <p id="camMsg" class="text-slate-300 text-sm p-6 text-center">${tr("cam.starting")}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" id="camSnap" class="btn-outline" disabled><i data-lucide="camera" class="w-4 h-4"></i> ${tr("cam.capture")}</button>
            <button type="button" id="camRetake" class="btn-outline hidden"><i data-lucide="rotate-ccw" class="w-4 h-4"></i> ${tr("cam.retake")}</button>
          </div>
          <div id="camFallback" class="hidden rounded-xl bg-amber-50 text-amber-900 text-xs p-3 space-y-2">
            <p><b>${tr("cam.noCamTitle")}</b> ${tr("cam.noCamBody")}</p>
            <p id="camSecure" class="hidden">${tr("cam.insecure")}</p>
            <div class="flex flex-wrap gap-2">
              <label class="btn-outline cursor-pointer"><i data-lucide="upload" class="w-4 h-4"></i> ${tr("cam.upload")}<input id="camFile" type="file" accept="image/*" class="sr-only" /></label>
              <button type="button" id="camDemo" class="btn-outline"><i data-lucide="flask-conical" class="w-4 h-4"></i> ${tr("cam.demo")}</button>
            </div>
          </div>
          <p class="text-[11px] text-slate-500 flex gap-1.5"><i data-lucide="shield-check" class="w-3.5 h-3.5 shrink-0 text-brand-600"></i><span>${tr("cam.stamped", { line: esc(lines("…")[0]) })}</span></p>
          ${reasons ? `<div><label class="field-label" for="camReason">${tr("cam.reason")} <span class="text-red-600">*</span></label>
            <select id="camReason" class="field mt-1.5">${reasons.map(r => `<option value="${r}">${esc(reasonText(r))}</option>`).join("")}</select></div>` : ""}
          ${needTypes ? `<fieldset><legend class="field-label">${tr("cam.types")} <span class="text-red-600">*</span></legend><div class="mt-2">${wastePicker("camWaste")}</div></fieldset>` : ""}
          <div><label class="field-label" for="camNote">${tr("cam.note")} <span class="font-normal text-slate-400">${tr("common.optional")}</span></label>
            <input id="camNote" class="field mt-1.5" placeholder="${esc(tr("cam.notePh"))}" /></div>
          <div class="grid grid-cols-2 gap-3">
            <button type="button" data-close-modal class="h-12 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50">${tr("common.cancel")}</button>
            <button class="h-12 rounded-xl ${tone === "red" ? "bg-red-600 hover:bg-red-700" : "bg-brand-700 hover:bg-brand-800"} text-white font-bold">${esc(submitLabel)}</button>
          </div>
        </form>`);
      modalOnClose = () => finish(null);

      const video = $("#camVideo"), img = $("#camShot"), msg = $("#camMsg");
      const show = (dataUrl, src) => {
        shot = dataUrl; source = src;
        img.src = dataUrl; img.classList.remove("hidden"); video.classList.add("hidden"); msg.classList.add("hidden");
        $("#camSnap").classList.add("hidden"); $("#camRetake").classList.toggle("hidden", !activeStream);
      };
      const noCamera = () => {
        msg.textContent = tr("cam.none");
        $("#camFallback").classList.remove("hidden");
        if (!window.isSecureContext) $("#camSecure").classList.remove("hidden");
      };
      if (navigator.mediaDevices?.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
          .then(stream => {
            if (done) return stream.getTracks().forEach(x => x.stop());
            activeStream = stream; video.srcObject = stream;
            video.classList.remove("hidden"); msg.classList.add("hidden"); $("#camSnap").disabled = false;
          })
          .catch(noCamera);
      } else noCamera();

      $("#camSnap").onclick = () => {
        if (!video.videoWidth) return;
        show(stamp(fitCanvas(video, video.videoWidth, video.videoHeight), lines("LIVE IN-APP CAPTURE")), "live");
      };
      $("#camRetake").onclick = () => {
        shot = null; source = null;
        img.classList.add("hidden"); video.classList.remove("hidden");
        $("#camSnap").classList.remove("hidden"); $("#camRetake").classList.add("hidden");
      };
      $("#camFile").onchange = async e => {
        const raw = await readPhoto(e.target.files[0], PHOTO_MAX);
        const im = raw && await loadImage(raw);
        if (im) show(stamp(fitCanvas(im, im.width, im.height), lines("FILE UPLOAD — UNVERIFIED SOURCE")), "file");
      };
      $("#camDemo").onclick = () => show(demoPhoto(tone === "red" ? "full" : "ok", lines("SIMULATED PHOTO (demo)")), "demo");

      $("#camForm").onsubmit = e => {
        e.preventDefault();
        if (!shot) return toast(tr("cam.needPhoto"), "error");
        const types = needTypes ? pickedWaste("camWaste") : [];
        if (needTypes && !types.length) return toast(tr("cam.needType"), "error");
        const photoId = source === "demo" ? null : savePhoto(shot);
        if (source !== "demo" && !photoId) return;
        finish({ photoId, source, types, reason: $("#camReason")?.value, note: $("#camNote").value.trim() });
      };
    });
  }

  // ---------- Driver console ----------
  // A fixed shell (map + panels) built once; the panels refresh as the truck moves.
  let drvMap = null, drvLayers = null, drvFollow = true, guideSig = "", drvShellTruck = null;
  function buildDriverShell() {
    if ($("#drvMap")) return;
    $("#viewDriver").innerHTML = `
      <p class="section-eyebrow">${tr("drv.eyebrow")}</p>
      <h2 class="section-title" id="drvTitle"></h2>
      <div class="mt-5 flex flex-wrap items-center gap-3 text-sm" id="drvControls"></div>
      <div class="mt-5 grid lg:grid-cols-[1.15fr_1fr] gap-6 items-start">
        <div class="space-y-4">
          <div id="drvGuide" class="rounded-3xl bg-brand-950 text-white p-5 shadow-card" aria-live="polite"></div>
          <div class="relative rounded-3xl overflow-hidden ring-1 ring-brand-100 shadow-card bg-white">
            <div id="drvMap" class="h-[320px] lg:h-[420px]"></div>
            <label class="absolute bottom-3 left-3 z-[500] inline-flex items-center gap-2 rounded-full bg-white/95 shadow px-3 py-1 text-xs font-bold cursor-pointer">
              <input id="drvFollow" type="checkbox" checked class="accent-brand-700" /> ${tr("drv.follow")}
            </label>
          </div>
        </div>
        <div class="space-y-6">
          <div id="drvStatus"></div>
          <div class="rounded-3xl bg-white shadow-card ring-1 ring-brand-100 p-5">
            <h3 class="font-display font-800 text-lg text-brand-800">${tr("drv.stops")}</h3>
            <ul id="drvStops" class="mt-1 divide-y divide-slate-100"></ul>
          </div>
        </div>
      </div>`;
    $("#drvFollow").onchange = e => { drvFollow = e.target.checked; };
    drvShellTruck = null;
  }
  function ensureDriverMap() {
    if (drvMap || !$("#drvMap") || $("#viewDriver").classList.contains("hidden")) return;
    drvMap = L.map("drvMap", { zoomControl: true }).setView(MAP_CENTER, 16);
    tileLayers().streets.addTo(drvMap);
    drvLayers = { route: L.layerGroup().addTo(drvMap), stops: L.layerGroup().addTo(drvMap), truck: null };
    // the panel may still be settling its size — measure again once it has
    setTimeout(() => drvMap.invalidateSize(), 60);
    setTimeout(() => drvMap.invalidateSize(), 600);
  }
  // Redraws the selected truck's route, stops and position on the driver's map
  function drawDriverMap(full) {
    if (role !== "driver") return;
    ensureDriverMap();
    if (!drvMap) return;
    const t = truckById(driverTruckId);
    if (full || drvShellTruck !== t.id) {
      drvLayers.route.clearLayers(); drvLayers.stops.clearLayers();
      t.legs.forEach(leg => {
        const active = AREAS.some(a => a.route === leg.id && servedToday(a));
        if (active) L.polyline(leg.pts, { color: t.color, weight: 6, opacity: 0.85 }).addTo(drvLayers.route);
      });
      if (t.detour?.pts) L.polyline(t.detour.pts, { color: t.color, weight: 5, opacity: 0.95, dashArray: "2 7" }).addTo(drvLayers.route);
      [...todayStops(t), ...extras(t)].forEach(a => {
        const r = rec(a);
        const fill = r?.status === "collected" && r.truck === t.id ? "#16a34a" : r?.status === "unserved" && r.truck === t.id && !r.action ? "#dc2626" : t.color;
        L.circleMarker(a.latlng, { radius: 7, color: "#fff", weight: 2, fillColor: fill, fillOpacity: 1 }).bindTooltip(esc(a.name)).addTo(drvLayers.stops);
      });
      if (drvLayers.truck) drvLayers.truck.remove();
      drvLayers.truck = L.marker(t.pos, {
        icon: L.divIcon({ className: "", iconSize: [40, 40], iconAnchor: [20, 20], html: `<div class="truck-marker"><span class="pulse" style="background:${t.color}"></span><div class="bubble" style="background:${t.color}">${svg("truck", "w-5 h-5")}</div></div>` }),
        zIndexOffset: 1000,
      }).addTo(drvMap);
      if (drvShellTruck !== t.id) drvMap.setView(t.pos, 17);
      drvShellTruck = t.id;
    }
    drvLayers.truck.setLatLng(t.pos);
    if (drvFollow) drvMap.panTo(t.pos, { animate: true, duration: 0.25 });
  }

  // Spoken-style instruction for one route step: [distance, type, modifier, street]
  function instruction(step) {
    const [, type, mod, name] = step;
    if (type === "depart") return tr("nav.depart", { name: name || "—" });
    if (mod === "uturn") return tr("nav.uturn");
    if (type === "roundabout" || type === "rotary" || type === "roundabout turn") return tr("nav.roundabout");
    if (type === "continue" || type === "new name" || mod === "straight" || !mod) return name ? tr("nav.continue", { name }) : tr("nav.straight");
    const turn = tr("nav." + mod.replace(/ /g, "_"));
    return name ? tr("nav.turnOnto", { turn, name }) : turn;
  }
  function navIcon(step) {
    const mod = step?.[2] || "";
    if (mod === "uturn") return "undo-2";
    if (mod.includes("left")) return "corner-up-left";
    if (mod.includes("right")) return "corner-up-right";
    return "arrow-up";
  }
  // Turn-by-turn panel: next maneuver, distance, next stop
  function renderGuide() {
    if (role !== "driver" || !$("#drvGuide")) return;
    const t = truckById(driverTruckId);
    const onDetour = t.detour && !t.detour.pending && (t.state === "detour" || t.state === "atStop");
    const steps = onDetour ? t.detour.steps : t.steps;
    const pos = onDetour ? t.detour.d : t.d;
    const target = t.live ? t.target && !ended(t) && t.state !== "done" ? t.target : null : onDetour ? t.target : nextPending(t);
    // live GPS: straight-line distance from the phone; simulated: distance left along the route
    const stopLeft = !target ? null : t.live ? haversine(t.pos, target.latlng) : onDetour ? t.detour.length - t.detour.d : target.stopD - t.d;
    const ahead = (t.state === "route" || t.state === "detour") ? steps.filter(s => s[0] > pos + 3).slice(0, 4) : [];
    let head, sub = "", icon = "navigation";
    if (ended(t)) { head = tr("guide.ended"); icon = "octagon-alert"; }
    else if (t.state === "atStop" && t.current) { head = tr("guide.arrived", { name: t.current.name }); sub = tr("guide.takePhoto"); icon = "camera"; }
    else if (t.state === "planning") { head = tr("truck.planning"); icon = "loader"; }
    else if (t.state === "done") { head = tr("truck.done"); icon = "flag"; }
    else if (t.state === "none") { head = tr("truck.none"); icon = "coffee"; }
    else if (ahead.length && (stopLeft == null || ahead[0][0] - pos < stopLeft)) { head = instruction(ahead[0]); sub = tr("guide.in", { dist: fmtDist(ahead[0][0] - pos) }); icon = navIcon(ahead[0]); }
    else if (target) { head = tr("guide.stopAhead", { name: target.name }); sub = tr("guide.in", { dist: fmtDist(Math.max(0, stopLeft)) }); icon = "map-pin"; }
    else { head = tr("truck.depot"); }
    const sig = [t.id, head, sub, target?.id, Math.round((stopLeft || 0) / 50), ahead.map(s => s[0]).join()].join("|");
    if (sig === guideSig) return;
    guideSig = sig;
    $("#drvGuide").innerHTML = `
      <div class="flex items-start gap-4">
        <span class="grid place-items-center w-14 h-14 rounded-2xl bg-white/10 shrink-0"><i data-lucide="${icon}" class="w-8 h-8 text-brand-300"></i></span>
        <div class="min-w-0">
          <p class="font-display font-800 text-xl leading-tight">${esc(head)}</p>
          ${sub ? `<p class="mt-1 text-brand-200 font-semibold">${esc(sub)}</p>` : ""}
        </div>
      </div>
      ${target && !ended(t) ? `<p class="mt-4 rounded-xl bg-white/10 px-3 py-2 text-sm"><span class="text-brand-200">${tr("guide.nextStop")}</span> <b>${esc(target.name)}</b> · ${fmtDist(Math.max(0, stopLeft || 0))}</p>` : ""}
      ${ahead.length > 1 ? `<ol class="mt-3 space-y-1.5 text-sm text-white/80">${ahead.slice(1).map(s => `<li class="flex justify-between gap-3"><span class="truncate">${esc(instruction(s))}</span><span class="shrink-0 text-white/60">${fmtDist(s[0] - pos)}</span></li>`).join("")}</ol>` : ""}
      ${onDetour && t.detour.approx ? `<p class="mt-3 text-xs text-amber-300">${tr("guide.approx")}</p>` : ""}
      <p class="mt-3 text-[11px] text-white/50">${tr("guide.source")}</p>`;
    icons();
  }

  function renderDriver() {
    if (role !== "driver") return;
    buildDriverShell();
    const t = truckById(driverTruckId);
    const stops = todayStops(t), e = ended(t), load = truckLoad(t);
    const extra = AREAS.filter(a => { const r = rec(a); return a.truck !== t.id && r && ((r.status === "unserved" && r.action?.truck === t.id) || (r.status === "collected" && r.truck === t.id)); });
    const doneCount = stops.filter(a => rec(a)?.status === "collected").length;
    const canEnd = !e && (nextPending(t) || extras(t).length);
    const headline = e ? [tr("drv.h.ended"), "bg-red-600"] : t.state === "atStop" ? [tr("drv.h.proof"), "bg-accent-500"]
      : t.state === "done" ? [tr("truck.done"), "bg-brand-700"] : t.state === "none" ? [tr("truck.none"), "bg-slate-500"] : [tr("drv.h.onRoute"), "bg-brand-700"];

    $("#drvTitle").textContent = tr("drv.title", { id: t.id });
    if (drvShellTruck !== t.id || !$("#driverTruck")) {
      $("#drvControls").innerHTML = `
        <label class="font-semibold text-slate-600" for="driverTruck">${tr("drv.driving")}</label>
        <select id="driverTruck" class="field !w-auto !py-2">${TRUCKS.map(x => `<option value="${x.id}" ${x.id === t.id ? "selected" : ""}>${tr("truck.label", { id: x.id })} — ${esc(x.driver)}</option>`).join("")}</select>
        <label class="inline-flex items-center gap-2 rounded-full bg-white ring-1 ring-slate-200 px-3 py-2 text-xs font-semibold cursor-pointer">
          <input id="driverManual" type="checkbox" class="accent-brand-700" ${t.manual ? "checked" : ""} /> ${tr("drv.manual")}
        </label>
        <button data-act="device-check" class="btn-outline !h-9"><i data-lucide="smartphone" class="w-4 h-4"></i> ${tr("device.open")}</button>`;
    } else $("#driverManual").checked = t.manual;

    const row = (a, isExtra) => {
      const r = rec(a), here = t.current === a;
      let state, cls = "text-slate-400";
      if (r?.status === "collected") { state = r.truck === t.id ? tr("drv.row.collected", { time: fmtTime(new Date(r.at)) }) : tr("drv.row.collectedBy", { truck: r.truck }); cls = "text-brand-700"; }
      else if (r?.status === "unserved" && !isExtra) { state = tr("drv.row.notServed", { reason: reasonText(r.reason).toLowerCase() }); cls = "text-red-600"; }
      else if (here) { state = tr("drv.row.here"); cls = "text-accent-600"; }
      else state = isExtra ? tr("drv.row.assigned") : tr("drv.row.pending");
      const thumb = r?.status === "collected" || (r?.status === "unserved" && !isExtra);
      return `<li class="flex items-center gap-3 py-3">
        <span class="grid place-items-center w-8 h-8 rounded-full shrink-0 ${r?.status === "collected" ? "bg-brand-600 text-white" : r?.status === "unserved" && !isExtra ? "bg-red-100 text-red-600" : here ? "bg-accent-500 text-white" : "bg-slate-100 text-slate-400"}">
          ${r?.status === "collected" ? svg("check", "w-4 h-4") : r?.status === "unserved" && !isExtra ? svg("x", "w-4 h-4") : svg("trash", "w-4 h-4")}</span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-bold truncate">${esc(a.name)} ${isExtra ? chip(tr("drv.extra"), "bg-sky-100 text-sky-800") : ""}</span>
          <span class="block text-xs font-semibold ${cls}">${esc(state)}</span>
        </span>
        ${thumb ? `<button data-act="photo" data-kind="stop" data-id="${a.id}" aria-label="${esc(tr("proof.enlarge"))}"><img src="${photoFor(r)}" alt="" class="w-14 h-10 rounded-lg object-cover ring-1 ring-slate-200" /></button>` : ""}
      </li>`;
    };

    $("#drvStatus").innerHTML = `
      <div class="rounded-3xl overflow-hidden bg-white shadow-card ring-1 ring-brand-100">
        <div class="${headline[1]} text-white px-5 py-4">
          <p class="text-xs font-bold uppercase tracking-wide opacity-80">${headline[0]}</p>
          <p class="font-display font-800 text-xl leading-tight">${esc(truckStatusText(t))}</p>
        </div>
        <div class="p-5 space-y-4">
          <div>
            <div class="flex justify-between text-xs font-bold text-slate-600"><span>${tr("drv.load")}</span><span class="${load >= 100 ? "text-red-600" : ""}">${load}%${load >= 100 ? " — " + tr("drv.full") : ""}</span></div>
            <div class="meter mt-1.5 !h-3"><span style="width:${load}%;background:${loadColor(load)}"></span></div>
            <p class="mt-1.5 text-xs text-slate-500">${tr("drv.progress", { done: doneCount, total: stops.length })} · GPS ${ll(t.pos)}</p>
            <p class="mt-1.5 flex flex-wrap gap-1">${t.live ? liveBadge(t) : chip(tr(LIVE.url ? "live.noFix" : "live.simulated", { dev: esc(deviceFor(t)) }), "bg-slate-100 text-slate-600")}</p>
          </div>
          <button data-act="proof" ${t.state === "atStop" ? "" : "disabled"} class="w-full h-14 rounded-2xl bg-brand-700 hover:bg-brand-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold inline-flex items-center justify-center gap-2 transition">
            <i data-lucide="camera" class="w-5 h-5"></i> ${t.state === "atStop" ? tr("drv.takePhoto") : tr("drv.photoLocked")}
          </button>
          ${t.state === "atStop" && !t.manual ? `<p class="text-xs text-slate-500 -mt-2">${tr("drv.autopilot")}</p>` : ""}
          ${canEnd ? `<button data-act="full" class="w-full h-12 rounded-2xl border-2 border-red-200 text-red-600 hover:bg-red-50 font-bold inline-flex items-center justify-center gap-2 transition">
            <i data-lucide="octagon-alert" class="w-5 h-5"></i> ${tr("drv.endEarly")}</button>
            <p class="text-xs text-slate-500 -mt-2">${tr("drv.endEarlyHint")}</p>` : ""}
          ${e ? `<div class="flex gap-3 rounded-2xl bg-red-50 p-3">
              <button data-act="photo" data-kind="truck" data-id="${t.id}"><img src="${photoFor(e)}" alt="" class="w-24 h-16 rounded-lg object-cover" /></button>
              <div class="text-xs"><p class="font-bold text-red-700">${esc(reasonText(e.reason))}</p><p class="text-slate-600">${tr("drv.submitted", { time: fmtStamp(e.at) })}</p><div class="mt-1 flex flex-wrap gap-1">${proofBadges(e)}</div></div>
            </div>` : ""}
        </div>
      </div>`;
    $("#drvStops").innerHTML = stops.map(a => row(a, false)).join("") + extra.map(a => row(a, true)).join("") || `<li class="py-6 text-sm text-slate-500">${tr("drv.noStops")}</li>`;
    guideSig = "";
    renderGuide();
    drawDriverMap(true);
    icons();
  }

  async function driverProof() {
    const t = truckById(driverTruckId), a = t.current;
    if (!a) return;
    const res = await capturePhoto({
      title: tr("cam.proofTitle"), subtitle: a.name, needTypes: true, submitLabel: tr("cam.proofSubmit"),
      lines: src => [`Truck ${t.id} · ${a.name}`, `${stampTime(Date.now())} · GPS ${ll(t.pos)}`, src],
    });
    if (!res) return;
    if (rec(a)?.status === "collected") return toast(tr("toast.alreadyDone"), "error");
    submitProof(t, a, res);
    toast(tr("toast.pickupConfirmed", { name: a.name }));
  }
  async function driverFull() {
    const t = truckById(driverTruckId);
    const near = t.current || nextPending(t) || extras(t)[0];
    const res = await capturePhoto({
      title: tr("cam.fullTitle"), subtitle: tr("cam.fullSub"), reasons: REASON_IDS, submitLabel: tr("cam.fullSubmit"), tone: "red",
      lines: src => [`Truck ${t.id} · ${near ? (t.current ? "at " : "on the way to ") + near.name : "route ended"}`, `${stampTime(Date.now())} · GPS ${ll(t.pos)}`, src],
    });
    if (!res) return;
    const n = endRouteEarly(t, res);
    toast(tr("toast.routeEnded", { n }));
  }

  // ---------- Management console ----------
  // Tabs: Today (live) · Reports · Announcements · Summary · Settings.
  // Only "Today" refreshes by itself, so forms on the other tabs keep what you type.
  const ADMIN_TABS = [["today", "gauge"], ["reports", "inbox"], ["announcements", "megaphone"], ["summary", "bar-chart-3"], ["settings", "settings"]];
  let adminRev = -1, reportFilter = "open", summaryDays = 14;
  function renderAdmin(force) {
    if (role !== "admin") return;
    if (!force && (adminTab !== "today" || adminRev === rev)) return;
    adminRev = rev;
    const openReports = reports.filter(r => OPEN_STATUSES.includes(r.status)).length;
    const tabs = ADMIN_TABS.map(([id, icon]) => `
      <button data-act="admin-tab" data-id="${id}" class="tabbtn ${adminTab === id ? "is-on" : ""}" role="tab" aria-selected="${adminTab === id}">
        <i data-lucide="${icon}" class="w-4 h-4"></i>${tr("adm.tab." + id)}${id === "reports" && openReports ? `<span class="tabcount">${openReports}</span>` : ""}
      </button>`).join("");
    const body = { today: adminTodayHTML, reports: adminReportsHTML, announcements: adminAnnHTML, summary: adminSummaryHTML, settings: adminSettingsHTML }[adminTab]();
    $("#viewAdmin").innerHTML = `
      <p class="section-eyebrow">${tr("adm.eyebrow")}</p>
      <h2 class="section-title">${tr("adm.title")}</h2>
      <div class="mt-5 flex gap-2 overflow-x-auto no-scrollbar pb-1" role="tablist">${tabs}</div>
      <div class="mt-6">${body}</div>`;
    icons();
  }

  function reviewItems() {
    const items = [];
    TRUCKS.forEach(t => { const e = ended(t); if (e) items.push({ kind: "truck", id: t.id, r: e, at: e.at, title: `${tr("truck.label", { id: t.id })} — ${reasonText(e.reason)}`, sub: tr("adm.earlyProof"), src: photoFor(e) }); });
    AREAS.forEach(a => { const r = rec(a); if (r?.status === "collected") items.push({ kind: "stop", id: a.id, r, area: a, at: r.at, title: a.name, sub: tr("adm.collectedBy", { truck: r.truck }), src: photoFor(r) }); });
    reports.filter(r => r.photo).forEach(r => items.push({ kind: "report", id: r.id, r, area: areaById(r.areaId), at: r.createdAt, title: areaById(r.areaId)?.name, sub: tr("adm.residentReport", { type: rtypeText(r.type) }), src: r.photo }));
    return items.sort((x, y) => (!!x.r.verified - !!y.r.verified) || y.at - x.at);
  }
  const kpi = (n, label, cls) => `<div class="rounded-2xl bg-white shadow-card ring-1 ring-brand-100 p-4"><p class="font-display font-800 text-3xl ${cls}">${n}</p><p class="text-xs font-semibold text-slate-500">${label}</p></div>`;
  const actionText = r => !r.action ? "" : r.action.kind === "reschedule" ? tr("adm.act.rescheduled", { date: fmtDate(keyToDate(r.action.date)) })
    : tr(r.action.kind === "redirect" ? "adm.act.redirected" : "adm.act.assigned", { truck: r.action.truck });

  function adminTodayHTML() {
    const scheduled = AREAS.filter(servedToday);
    const collected = AREAS.filter(a => rec(a)?.status === "collected");
    const unserved = AREAS.filter(a => rec(a)?.status === "unserved");
    const needAction = unserved.filter(a => !rec(a).action);
    const items = reviewItems();
    const toVerify = items.filter(i => !i.r.verified).length;
    return `
      <p class="text-sm text-slate-500">${fmtDate(new Date())}</p>
      <div class="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
        ${kpi(`${collected.length}/${scheduled.length}`, tr("adm.kpi.collected"), "text-brand-800")}
        ${kpi(scheduled.filter(a => !rec(a)).length, tr("adm.kpi.pending"), "text-slate-700")}
        ${kpi(needAction.length, tr("adm.kpi.unserved"), needAction.length ? "text-red-600" : "text-slate-700")}
        ${kpi(toVerify, tr("adm.kpi.verify"), toVerify ? "text-accent-600" : "text-slate-700")}
      </div>

      <div class="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        ${TRUCKS.map(t => { const load = truckLoad(t), st = todayStops(t); return `
          <div class="rounded-2xl bg-white ring-1 ring-brand-100 p-4">
            <p class="flex items-center gap-2 text-sm font-bold"><span class="w-2.5 h-2.5 rounded-full" style="background:${t.color}"></span>${tr("truck.label", { id: t.id })} <span class="font-medium text-slate-400 truncate">· ${esc(t.driver)}</span></p>
            <p class="mt-1 text-xs ${ended(t) ? "text-red-600 font-semibold" : "text-slate-500"}">${ended(t) ? esc(tr("truck.endedEarly", { reason: reasonText(ended(t).reason).toLowerCase() })) : tr("adm.truckProgress", { done: st.filter(a => rec(a)?.status === "collected").length, total: st.length })}</p>
            <div class="meter mt-2"><span style="width:${load}%;background:${loadColor(load)}"></span></div>
            <p class="mt-1 text-[11px] text-slate-500">${tr("truck.load")} ${load}%</p>
          </div>`; }).join("")}
      </div>

      <div class="mt-10 flex items-center justify-between gap-3">
        <h3 class="font-display font-800 text-xl text-brand-800">${tr("adm.unserved.title")}</h3>
        ${chip(tr("adm.unserved.need", { n: needAction.length }), needAction.length ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500")}
      </div>
      <p class="text-sm text-slate-500">${tr("adm.unserved.intro")}</p>
      <ul class="mt-4 grid lg:grid-cols-2 gap-3">
        ${unserved.length ? unserved.map(a => { const r = rec(a); return `
          <li class="flex gap-3 rounded-2xl bg-white ring-1 ${r.action ? "ring-slate-200" : "ring-red-200"} p-3">
            <button data-act="photo" data-kind="stop" data-id="${a.id}" class="shrink-0" aria-label="${esc(tr("proof.enlarge"))}"><img src="${photoFor(r)}" alt="" class="w-28 h-24 rounded-xl object-cover" /></button>
            <div class="min-w-0 flex-1">
              <p class="font-bold text-sm">${esc(a.name)}</p>
              <p class="text-xs text-slate-500">${tr("truck.label", { id: r.truck })} · ${esc(reasonText(r.reason))} · ${fmtTime(new Date(r.at))}</p>
              <div class="mt-1.5 flex flex-wrap gap-1">${proofBadges(r, a)}</div>
              ${r.bounced ? `<p class="mt-1 text-[11px] font-semibold text-red-600">${tr("adm.bounced", { truck: r.bounced })}</p>` : ""}
              <div class="mt-2 flex items-center gap-2">
                ${r.action ? chip(esc(actionText(r)), "bg-brand-100 text-brand-800") : ""}
                <button data-act="decide" data-id="${a.id}" class="h-8 px-3 rounded-lg text-xs font-bold ${r.action ? "border border-slate-200 text-slate-600 hover:bg-slate-50" : "bg-red-600 hover:bg-red-700 text-white"}">${r.action ? tr("adm.change") : tr("adm.decide")}</button>
              </div>
            </div>
          </li>`; }).join("") : `<li class="lg:col-span-2 rounded-2xl bg-white ring-1 ring-slate-200 p-6 text-sm text-slate-500">${tr("adm.unserved.none")}</li>`}
      </ul>

      <div class="mt-10 flex items-center justify-between gap-3">
        <h3 class="font-display font-800 text-xl text-brand-800">${tr("adm.verify.title")}</h3>
        ${chip(tr("adm.verify.count", { n: toVerify }), toVerify ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500")}
      </div>
      <p class="text-sm text-slate-500">${tr("adm.verify.intro")}</p>
      <ul class="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        ${items.length ? items.slice(0, 30).map(i => `
          <li class="rounded-2xl bg-white ring-1 ring-slate-200 overflow-hidden flex flex-col">
            <button data-act="photo" data-kind="${i.kind}" data-id="${i.id}" aria-label="${esc(tr("proof.enlarge"))}"><img src="${i.src}" alt="" class="w-full aspect-[16/10] object-cover" /></button>
            <div class="p-3 flex-1 flex flex-col">
              <p class="font-bold text-sm truncate">${esc(i.title)}</p>
              <p class="text-xs text-slate-500">${esc(i.sub)} · ${fmtTime(new Date(i.at))}</p>
              <div class="mt-1.5 flex flex-wrap gap-1">${i.kind === "report" ? chip(tr("adm.residentUpload"), "bg-amber-100 text-amber-800") + (i.r.verified ? chip(tr("badge.verified"), "bg-sky-100 text-sky-800") : "") : proofBadges(i.r, i.area)}</div>
              <div class="mt-1.5 flex flex-wrap gap-1">${wasteChips(i.r.verified?.types || i.r.types)}</div>
              <button data-act="review" data-kind="${i.kind}" data-id="${i.id}" class="mt-3 h-9 rounded-lg text-xs font-bold ${i.r.verified ? "border border-slate-200 text-slate-600 hover:bg-slate-50" : "bg-brand-700 hover:bg-brand-800 text-white"}">${i.r.verified ? tr("adm.reviewAgain") : tr("adm.verifyPhoto")}</button>
            </div>
          </li>`).join("") : `<li class="sm:col-span-2 lg:col-span-3 rounded-2xl bg-white ring-1 ring-slate-200 p-6 text-sm text-slate-500">${tr("adm.verify.none")}</li>`}
      </ul>`;
  }

  // --- Reports: status + reply to the resident ---
  const STATUS_TONE = { received: "bg-slate-100 text-slate-600", review: "bg-amber-100 text-amber-800", scheduled: "bg-sky-100 text-sky-800", cleared: "bg-brand-100 text-brand-800", rejected: "bg-red-100 text-red-700" };
  const REPORT_STATUSES = ["received", "review", "scheduled", "cleared", "rejected"];
  function reportThreadHTML(r) {
    const entries = [{ by: "resident", at: r.createdAt, status: "received", text: null }, ...(r.thread || [])];
    return `<ol class="thread">${entries.map(e => `
      <li class="${e.by === "staff" ? "is-staff" : ""}">
        <p class="text-[11px] text-slate-500">${e.by === "staff" ? tr("rep.staff") : tr("rep.you")} · ${fmtDate(new Date(e.at))}, ${fmtTime(new Date(e.at))}${e.status ? ` · <b>${esc(statusText(e.status))}</b>` : ""}</p>
        <p class="text-sm">${e.text ? esc(txt(e.text)) : esc(tr("rep.submitted"))}</p>
      </li>`).join("")}</ol>`;
  }
  function adminReportsHTML() {
    const list = reports.filter(r => reportFilter === "all" || (reportFilter === "open") === OPEN_STATUSES.includes(r.status));
    const filters = ["open", "closed", "all"].map(f => `<button data-act="rep-filter" data-id="${f}" class="tabbtn !h-8 ${reportFilter === f ? "is-on" : ""}">${tr("adm.rep.f." + f)}</button>`).join("");
    return `
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-slate-500 max-w-xl">${tr("adm.rep.intro")}</p>
        <div class="flex gap-2">${filters}</div>
      </div>
      <ul class="mt-5 grid lg:grid-cols-2 gap-4">
        ${list.length ? list.map(r => `
          <li class="rounded-2xl bg-white ring-1 ring-slate-200 p-4" data-report="${r.id}">
            <div class="flex gap-3">
              ${r.photo ? `<button data-act="photo" data-kind="report" data-id="${r.id}" class="shrink-0"><img src="${r.photo}" alt="" class="w-24 h-24 rounded-xl object-cover" /></button>`
                : `<span class="grid place-items-center w-24 h-24 rounded-xl bg-red-50 text-red-600 shrink-0"><i data-lucide="${REPORT_TYPES.find(x => x.id === r.type)?.icon}" class="w-8 h-8"></i></span>`}
              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                  <p class="font-bold text-sm">${esc(rtypeText(r.type))} ${r.sample ? `<span class="text-[10px] font-bold text-slate-400">${tr("common.sample")}</span>` : ""}</p>
                  ${chip(esc(statusText(r.status)), STATUS_TONE[r.status])}
                </div>
                <p class="text-xs text-slate-500">${esc(areaById(r.areaId)?.name)} · ${fmtDate(new Date(r.createdAt))}, ${fmtTime(new Date(r.createdAt))}</p>
                ${r.notes ? `<p class="mt-1 text-sm text-slate-700">${esc(txt(r.notes))}</p>` : ""}
                <div class="mt-1.5 flex flex-wrap gap-1">${wasteChips(r.verified?.types || r.types)}</div>
              </div>
            </div>
            <details class="mt-3"><summary class="text-xs font-bold text-brand-700 cursor-pointer">${tr("rep.updates", { n: (r.thread || []).length })}</summary>${reportThreadHTML(r)}</details>
            <div class="mt-3 grid sm:grid-cols-[180px_1fr] gap-2">
              <select class="field !py-2" data-field="status" aria-label="${esc(tr("adm.rep.status"))}">${REPORT_STATUSES.map(s => `<option value="${s}" ${s === r.status ? "selected" : ""}>${esc(statusText(s))}</option>`).join("")}</select>
              <input class="field !py-2" data-field="reply" placeholder="${esc(tr("adm.rep.replyPh"))}" />
            </div>
            <button data-act="report-save" data-id="${r.id}" class="mt-2 h-9 px-4 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-xs font-bold">${tr("adm.rep.save")}</button>
          </li>`).join("") : `<li class="lg:col-span-2 rounded-2xl bg-white ring-1 ring-slate-200 p-6 text-sm text-slate-500">${tr("adm.rep.none")}</li>`}
      </ul>`;
  }
  function saveReportUpdate(id) {
    const r = reports.find(x => x.id === id), card = $(`[data-report="${id}"]`);
    if (!r || !card) return;
    const status = $('[data-field="status"]', card).value, text = $('[data-field="reply"]', card).value.trim();
    if (status === r.status && !text) return toast(tr("adm.rep.nothing"), "error");
    r.thread ||= [];
    r.thread.push({ by: "staff", text: text || null, status: status !== r.status ? status : null, at: Date.now() });
    r.status = status;
    store.set("reports", reports);
    drawReports(); renderReports();
    if (r.mine) notify({ icon: "message-square", color: "green", key: "n.reportUpdate", vars: { status: "@rstatus." + status, area: areaById(r.areaId)?.name || "", msg: text } });
    toast(tr("adm.rep.saved"));
    renderAdmin(true);
  }

  // --- Announcements and schedule overrides ---
  const ANN_TONE = { notice: "bg-sky-100 text-sky-800", cancel: "bg-red-100 text-red-700", extra: "bg-brand-100 text-brand-800" };
  const scopeLabel = n => n.scope === "all" ? tr("scope.all") : n.scope.startsWith("group:") ? tr("group." + n.scope.slice(6)) : areaById(n.scope.slice(5))?.name || "—";
  const dateRange = n => n.from === n.to ? fmtDate(keyToDate(n.from)) : `${fmtDay(keyToDate(n.from))} – ${fmtDay(keyToDate(n.to))}`;
  function annCard(n, admin) {
    return `<li class="rounded-2xl bg-white ring-1 ring-slate-200 p-4">
      <div class="flex flex-wrap items-center gap-2">
        ${chip(tr("ann.kind." + n.kind), ANN_TONE[n.kind])}
        <span class="text-xs font-semibold text-slate-500">${dateRange(n)} · ${esc(scopeLabel(n))}</span>
        ${n.sample ? `<span class="text-[10px] font-bold text-slate-400">${tr("common.sample")}</span>` : ""}
        ${admin ? `<button data-act="ann-delete" data-id="${n.id}" class="ml-auto text-xs font-bold text-red-600 hover:underline">${tr("common.delete")}</button>` : ""}
      </div>
      <p class="mt-2 font-bold text-slate-800">${esc(txt(n.title))}</p>
      ${n.body ? `<p class="text-sm text-slate-600">${esc(txt(n.body))}</p>` : ""}
    </li>`;
  }
  function adminAnnHTML() {
    const today = day.key;
    const current = announcements.filter(n => n.to >= today).sort((a, b) => a.from.localeCompare(b.from));
    const past = announcements.filter(n => n.to < today).sort((a, b) => b.to.localeCompare(a.to)).slice(0, 10);
    const scopes = [`<option value="all">${tr("scope.all")}</option>`,
      `<optgroup label="${esc(tr("scope.groups"))}">${SCHEDULE_GROUPS.map(g => `<option value="group:${g.id}">${esc(tr("group." + g.id))}</option>`).join("")}</optgroup>`,
      `<optgroup label="${esc(tr("scope.areas"))}">${AREAS.map(a => `<option value="area:${a.id}">${esc(a.name)}</option>`).join("")}</optgroup>`].join("");
    return `
      <div class="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
        <form id="annForm" class="rounded-3xl bg-white shadow-card ring-1 ring-brand-100 p-5 space-y-3" novalidate>
          <h3 class="font-display font-800 text-lg text-brand-800">${tr("ann.new")}</h3>
          <div><label class="field-label" for="annKind">${tr("ann.type")}</label>
            <select id="annKind" class="field mt-1.5">${["notice", "cancel", "extra"].map(k => `<option value="${k}">${tr("ann.kind." + k)}</option>`).join("")}</select>
            <p class="mt-1 text-xs text-slate-500" id="annKindHint">${tr("ann.hint.notice")}</p></div>
          <div><label class="field-label" for="annTitle">${tr("ann.titleLbl")}</label><input id="annTitle" class="field mt-1.5" maxlength="90" placeholder="${esc(tr("ann.titlePh"))}" /></div>
          <div><label class="field-label" for="annBody">${tr("ann.bodyLbl")} <span class="font-normal text-slate-400">${tr("common.optional")}</span></label><textarea id="annBody" rows="3" class="field mt-1.5"></textarea></div>
          <div class="grid grid-cols-2 gap-2">
            <div><label class="field-label" for="annFrom">${tr("ann.from")}</label><input id="annFrom" type="date" class="field mt-1.5" value="${today}" /></div>
            <div><label class="field-label" for="annTo">${tr("ann.to")}</label><input id="annTo" type="date" class="field mt-1.5" value="${today}" /></div>
          </div>
          <div><label class="field-label" for="annScope">${tr("ann.scope")}</label><select id="annScope" class="field mt-1.5">${scopes}</select></div>
          <button class="w-full h-11 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold">${tr("ann.publish")}</button>
        </form>
        <div>
          <h3 class="font-display font-800 text-lg text-brand-800">${tr("ann.current")}</h3>
          <ul class="mt-3 space-y-3">${current.length ? current.map(n => annCard(n, true)).join("") : `<li class="text-sm text-slate-500">${tr("ann.none")}</li>`}</ul>
          ${past.length ? `<details class="mt-6"><summary class="text-sm font-bold text-slate-600 cursor-pointer">${tr("ann.past")}</summary><ul class="mt-3 space-y-3 opacity-70">${past.map(n => annCard(n, true)).join("")}</ul></details>` : ""}
        </div>
      </div>`;
  }
  function publishAnnouncement() {
    const n = { id: uid(), kind: $("#annKind").value, title: $("#annTitle").value.trim(), body: $("#annBody").value.trim(), from: $("#annFrom").value, to: $("#annTo").value, scope: $("#annScope").value, createdAt: Date.now() };
    if (!n.title) return toast(tr("ann.needTitle"), "error");
    if (!n.from || !n.to || n.to < n.from) return toast(tr("ann.badDates"), "error");
    announcements.push(n);
    store.set("announcements", announcements);
    afterScheduleChange();
    if (inScope(n, areaById(myAreaId))) notify({ icon: "megaphone", color: n.kind === "cancel" ? "red" : "green", key: "n.announcement", vars: { title: n.title, dates: dateRange(n) } });
    toast(tr("ann.published"));
    renderAdmin(true);
  }
  function afterScheduleChange() {
    scheduleChanged();
    renderHero(); renderBanner(); renderSchedule(); renderHistory();
    trackerSig = "";
  }

  // --- Summary: history + today, charts, exports ---
  function collectRange(days) {
    const rows = [], fulls = [];
    for (let i = 0; i < days; i++) {
      const d = addDays(new Date(), -i), dk = dateKey(d);
      if (i === 0) {
        for (const [id, r] of Object.entries(day.stops)) rows.push({ dk, areaId: id, s: r.status === "collected" ? "c" : "u", t: r.truck, at: r.at, r: r.reason, a: r.action?.kind || null });
        for (const [id, x] of Object.entries(day.trucks)) if (x.ended) fulls.push({ dk, truck: id, reason: x.ended.reason });
      } else if (history[dk]) {
        for (const [id, r] of Object.entries(history[dk].stops)) rows.push({ dk, areaId: id, ...r });
        for (const [id, reason] of Object.entries(history[dk].ended || {})) fulls.push({ dk, truck: id, reason });
      }
    }
    return { rows, fulls };
  }
  const C_DONE = "#1f7a33", C_MISS = "#d97706";     // validated pair (with legend, gaps and value tooltips)
  function adminSummaryHTML() {
    const { rows, fulls } = collectRange(summaryDays);
    const since = dateKey(addDays(new Date(), -(summaryDays - 1)));
    const done = rows.filter(r => r.s === "c").length, miss = rows.filter(r => r.s === "u").length;
    const rate = done + miss ? Math.round(done / (done + miss) * 100) : 0;
    const reps = reports.filter(r => dateKey(new Date(r.createdAt)) >= since);
    const fb = feedback.filter(f => dateKey(new Date(f.at)) >= since);
    const avg = fb.length ? (fb.reduce((s, f) => s + f.rating, 0) / fb.length).toFixed(1) : "—";

    // daily stacked bars
    const daysList = [...Array(summaryDays)].map((_, i) => dateKey(addDays(new Date(), -(summaryDays - 1 - i))));
    const perDay = daysList.map(dk => ({ dk, c: rows.filter(r => r.dk === dk && r.s === "c").length, u: rows.filter(r => r.dk === dk && r.s === "u").length }));
    const maxDay = Math.max(1, ...perDay.map(p => p.c + p.u));
    const bars = perDay.map(p => {
      const d = keyToDate(p.dk), tip = `${fmtDate(d)} — ${tr("sum.collected")}: ${p.c} · ${tr("sum.missed")}: ${p.u}`;
      return `<div class="sbar" title="${esc(tip)}" aria-label="${esc(tip)}">
        <div class="sbar-stack" style="height:${(p.c + p.u) / maxDay * 100}%">
          ${p.u ? `<span style="flex:${p.u};background:${C_MISS}"></span>` : ""}${p.c ? `<span style="flex:${p.c};background:${C_DONE}"></span>` : ""}
        </div>
        <span class="sbar-x">${d.getDate()}</span>
      </div>`;
    }).join("");

    // missed per area
    const byArea = {};
    rows.filter(r => r.s === "u").forEach(r => { byArea[r.areaId] = (byArea[r.areaId] || 0) + 1; });
    const topAreas = Object.entries(byArea).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const maxA = Math.max(1, ...topAreas.map(x => x[1]));

    // per truck
    const truckRows = TRUCKS.map(t => {
      const c = rows.filter(r => r.t === t.id && r.s === "c").length, u = rows.filter(r => r.t === t.id && r.s === "u").length;
      return { t, c, u, full: fulls.filter(f => f.truck === t.id && f.reason === "full").length, rate: c + u ? Math.round(c / (c + u) * 100) : 0 };
    });

    // ratings
    const dist = [5, 4, 3, 2, 1].map(s => ({ s, n: fb.filter(f => f.rating === s).length }));
    const maxR = Math.max(1, ...dist.map(x => x.n));

    return `
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex gap-2">${[7, 14, 30].map(n => `<button data-act="sum-range" data-id="${n}" class="tabbtn !h-8 ${summaryDays === n ? "is-on" : ""}">${tr("sum.days", { n })}</button>`).join("")}</div>
        <div class="flex flex-wrap gap-2">
          <button data-act="csv" data-id="collections" class="btn-outline !h-9"><i data-lucide="download" class="w-4 h-4"></i> ${tr("sum.csv.collections")}</button>
          <button data-act="csv" data-id="reports" class="btn-outline !h-9"><i data-lucide="download" class="w-4 h-4"></i> ${tr("sum.csv.reports")}</button>
          <button data-act="csv" data-id="feedback" class="btn-outline !h-9"><i data-lucide="download" class="w-4 h-4"></i> ${tr("sum.csv.feedback")}</button>
          <button data-act="print" class="btn-outline !h-9"><i data-lucide="printer" class="w-4 h-4"></i> ${tr("sum.print")}</button>
        </div>
      </div>
      ${Object.values(history).some(h => h.sample) ? `<p class="mt-3 text-xs text-slate-500">${tr("sum.sampleNote")}</p>` : ""}

      <div class="mt-5 grid grid-cols-2 lg:grid-cols-5 gap-3">
        ${kpi(rate + "%", tr("sum.kpi.rate"), "text-brand-800")}
        ${kpi(miss, tr("sum.kpi.missed"), miss ? "text-accent-600" : "text-slate-700")}
        ${kpi(fulls.filter(f => f.reason === "full").length, tr("sum.kpi.full"), "text-slate-700")}
        ${kpi(`${reps.filter(r => !OPEN_STATUSES.includes(r.status)).length}/${reps.length}`, tr("sum.kpi.reports"), "text-slate-700")}
        ${kpi(avg, tr("sum.kpi.rating", { n: fb.length }), "text-slate-700")}
      </div>

      <div class="mt-6 grid lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
        <div class="rounded-3xl bg-white shadow-card ring-1 ring-brand-100 p-5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="font-display font-800 text-lg text-brand-800">${tr("sum.daily")}</h3>
            <div class="flex gap-3 text-xs font-semibold text-slate-600">
              <span class="inline-flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm" style="background:${C_DONE}"></span>${tr("sum.collected")}</span>
              <span class="inline-flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm" style="background:${C_MISS}"></span>${tr("sum.missed")}</span>
            </div>
          </div>
          <div class="sbars mt-4">${bars}</div>
          <details class="mt-3"><summary class="text-xs font-bold text-slate-500 cursor-pointer">${tr("sum.table")}</summary>
            <table class="mt-2 w-full text-xs"><thead><tr class="text-left text-slate-500"><th class="py-1">${tr("sum.date")}</th><th>${tr("sum.collected")}</th><th>${tr("sum.missed")}</th></tr></thead>
            <tbody>${perDay.slice().reverse().map(p => `<tr class="border-t border-slate-100"><td class="py-1">${fmtDate(keyToDate(p.dk))}</td><td>${p.c}</td><td>${p.u}</td></tr>`).join("")}</tbody></table></details>
        </div>

        <div class="rounded-3xl bg-white shadow-card ring-1 ring-brand-100 p-5">
          <h3 class="font-display font-800 text-lg text-brand-800">${tr("sum.byArea")}</h3>
          ${topAreas.length ? `<ul class="mt-4 space-y-2.5">${topAreas.map(([id, n]) => `
            <li><div class="flex justify-between gap-2 text-xs font-semibold text-slate-700"><span class="truncate">${esc(areaById(id)?.name || id)}</span><span>${n}</span></div>
              <div class="hbar"><span style="width:${n / maxA * 100}%;background:${C_MISS}"></span></div></li>`).join("")}</ul>`
            : `<p class="mt-3 text-sm text-slate-500">${tr("sum.noMissed")}</p>`}
        </div>
      </div>

      <div class="mt-6 grid lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
        <div class="rounded-3xl bg-white shadow-card ring-1 ring-brand-100 p-5 overflow-x-auto">
          <h3 class="font-display font-800 text-lg text-brand-800">${tr("sum.byTruck")}</h3>
          <table class="mt-3 w-full text-sm min-w-[460px]">
            <thead><tr class="text-left text-xs text-slate-500"><th class="py-2">${tr("legend.truck")}</th><th>${tr("sum.collected")}</th><th>${tr("sum.missed")}</th><th>${tr("sum.fullDays")}</th><th>${tr("sum.kpi.rate")}</th></tr></thead>
            <tbody>${truckRows.map(x => `<tr class="border-t border-slate-100">
              <td class="py-2 font-semibold"><span class="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style="background:${x.t.color}"></span>${x.t.id} <span class="text-xs font-normal text-slate-400">${esc(x.t.driver)}</span></td>
              <td>${x.c}</td><td>${x.u}</td><td>${x.full}</td><td class="font-semibold">${x.rate}%</td></tr>`).join("")}</tbody>
          </table>
        </div>

        <div class="rounded-3xl bg-white shadow-card ring-1 ring-brand-100 p-5">
          <h3 class="font-display font-800 text-lg text-brand-800">${tr("sum.feedback")}</h3>
          <ul class="mt-3 space-y-1.5">${dist.map(x => `<li class="flex items-center gap-2 text-xs font-semibold text-slate-600"><span class="w-8">${x.s} ★</span><div class="hbar flex-1 !mt-0"><span style="width:${x.n / maxR * 100}%;background:${C_DONE}"></span></div><span class="w-6 text-right">${x.n}</span></li>`).join("")}</ul>
          <ul class="mt-4 divide-y divide-slate-100 max-h-72 overflow-y-auto">${fb.length ? fb.slice().sort((a, b) => b.at - a.at).slice(0, 25).map(f => `
            <li class="py-2.5"><p class="text-xs text-slate-500"><span class="text-amber-500">${"★".repeat(f.rating)}${"☆".repeat(5 - f.rating)}</span> · ${esc(areaById(f.areaId)?.name || "")} · ${fmtDay(new Date(f.at))}${f.sample ? ` · ${tr("common.sample")}` : ""}</p>
              ${txt(f.text) ? `<p class="text-sm text-slate-700">${esc(txt(f.text))}</p>` : ""}</li>`).join("") : `<li class="py-3 text-sm text-slate-500">${tr("sum.noFeedback")}</li>`}</ul>
        </div>
      </div>`;
  }

  function downloadCSV(kind) {
    const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    let head, lines;
    if (kind === "collections") {
      const { rows } = collectRange(summaryDays);
      head = ["Date", "Area", "Route", "Truck", "Status", "Time", "Reason", "Action"];
      lines = rows.sort((a, b) => a.dk.localeCompare(b.dk)).map(r => { const a = areaById(r.areaId); return [r.dk, a?.name, a?.route, r.t, r.s === "c" ? "Collected" : "Not collected", r.at ? new Date(r.at).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }) : "", r.r ? I18N.en["reason." + r.r] || r.r : "", r.a || ""]; });
    } else if (kind === "reports") {
      head = ["Date", "Type", "Area", "Status", "Waste types", "Notes", "Latest reply"];
      lines = reports.map(r => [dateKey(new Date(r.createdAt)), I18N.en["rtype." + r.type], areaById(r.areaId)?.name, I18N.en["rstatus." + r.status], (r.verified?.types || r.types || []).map(x => I18N.en["waste." + x]).join("; "),
        typeof r.notes === "object" ? r.notes?.en : r.notes, (r.thread || []).filter(x => x.text).map(x => (typeof x.text === "object" ? x.text.en : x.text)).pop() || ""]);
    } else {
      head = ["Date", "Area", "Rating", "Comment"];
      lines = feedback.map(f => [dateKey(new Date(f.at)), areaById(f.areaId)?.name, f.rating, typeof f.text === "object" ? f.text.en : f.text]);
    }
    const csv = "﻿" + [head, ...lines].map(l => l.map(q).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `sb-wastetrack-${kind}-${day.key}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(tr("sum.downloaded"));
  }

  // Printable report — the browser's print dialog can save it as a PDF
  function printReport() {
    const { rows, fulls } = collectRange(summaryDays);
    const done = rows.filter(r => r.s === "c").length, miss = rows.filter(r => r.s === "u").length;
    const fb = feedback.filter(f => dateKey(new Date(f.at)) >= dateKey(addDays(new Date(), -(summaryDays - 1))));
    const byArea = {};
    rows.filter(r => r.s === "u").forEach(r => { byArea[r.areaId] = (byArea[r.areaId] || 0) + 1; });
    $("#printArea").innerHTML = `
      <h1>${tr("print.title")}</h1>
      <p>${tr("print.range", { from: fmtDate(addDays(new Date(), -(summaryDays - 1))), to: fmtDate(new Date()) })} · ${tr("print.generated", { time: fmtStamp(Date.now()) })}</p>
      ${Object.values(history).some(h => h.sample) ? `<p><i>${tr("sum.sampleNote")}</i></p>` : ""}
      <h2>${tr("print.overview")}</h2>
      <table><tr><th>${tr("sum.kpi.rate")}</th><td>${done + miss ? Math.round(done / (done + miss) * 100) : 0}%</td></tr>
        <tr><th>${tr("sum.collected")}</th><td>${done}</td></tr><tr><th>${tr("sum.missed")}</th><td>${miss}</td></tr>
        <tr><th>${tr("sum.kpi.full")}</th><td>${fulls.filter(f => f.reason === "full").length}</td></tr>
        <tr><th>${tr("sum.kpi.rating", { n: fb.length })}</th><td>${fb.length ? (fb.reduce((s, f) => s + f.rating, 0) / fb.length).toFixed(1) : "—"}</td></tr></table>
      <h2>${tr("sum.byTruck")}</h2>
      <table><tr><th>${tr("legend.truck")}</th><th>${tr("truck.driver")}</th><th>${tr("sum.collected")}</th><th>${tr("sum.missed")}</th><th>${tr("sum.fullDays")}</th></tr>
        ${TRUCKS.map(t => `<tr><td>${t.id}</td><td>${esc(t.driver)}</td><td>${rows.filter(r => r.t === t.id && r.s === "c").length}</td><td>${rows.filter(r => r.t === t.id && r.s === "u").length}</td><td>${fulls.filter(f => f.truck === t.id && f.reason === "full").length}</td></tr>`).join("")}</table>
      <h2>${tr("sum.byArea")}</h2>
      <table><tr><th>${tr("print.area")}</th><th>${tr("sum.missed")}</th></tr>
        ${Object.entries(byArea).sort((a, b) => b[1] - a[1]).map(([id, n]) => `<tr><td>${esc(areaById(id)?.name || id)}</td><td>${n}</td></tr>`).join("") || `<tr><td colspan="2">${tr("sum.noMissed")}</td></tr>`}</table>
      <h2>${tr("print.reports")}</h2>
      <table><tr><th>${tr("sum.date")}</th><th>${tr("print.type")}</th><th>${tr("print.area")}</th><th>${tr("truck.status")}</th></tr>
        ${reports.filter(r => dateKey(new Date(r.createdAt)) >= dateKey(addDays(new Date(), -(summaryDays - 1)))).map(r => `<tr><td>${fmtDay(new Date(r.createdAt))}</td><td>${esc(rtypeText(r.type))}</td><td>${esc(areaById(r.areaId)?.name)}</td><td>${esc(statusText(r.status))}</td></tr>`).join("")}</table>`;
    window.print();
  }

  // --- Settings: trucks, collection days, extra areas ---
  function adminSettingsHTML() {
    const routes = TRUCKS.flatMap(t => t.legs.map(l => l.id));
    const dayBoxes = (name, days) => ORDER.map(d => `<label class="daybox" title="${esc(dayName(d))}"><input type="checkbox" name="${name}" value="${d}" ${days.includes(d) ? "checked" : ""} /><span>${esc(dayName(d))}</span></label>`).join("");
    return `
      <p class="text-sm text-slate-500 max-w-2xl">${tr("set.intro")}</p>
      <div class="mt-5 rounded-3xl bg-white shadow-card ring-1 ring-brand-100 p-5 overflow-x-auto">
        <h3 class="font-display font-800 text-lg text-brand-800">${tr("set.trucks")}</h3>
        <table class="mt-3 w-full text-sm min-w-[560px]">
          <thead><tr class="text-left text-xs text-slate-500"><th class="py-2">${tr("legend.truck")}</th><th>${tr("set.routes")}</th><th>${tr("truck.driver")}</th><th>${tr("set.window")}</th></tr></thead>
          <tbody>${TRUCKS.map(t => `<tr class="border-t border-slate-100">
            <td class="py-2 font-semibold"><span class="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style="background:${t.color}"></span>${t.id} <span class="text-xs text-slate-400">${t.type}</span></td>
            <td class="text-xs text-slate-500">${t.routes}</td>
            <td><input class="field !py-1.5" data-truck-driver="${t.id}" value="${esc(t.driver)}" /></td>
            <td><input class="field !py-1.5" data-truck-window="${t.id}" value="${esc(t.window)}" /></td></tr>`).join("")}</tbody>
        </table>
      </div>

      <div class="mt-6 rounded-3xl bg-white shadow-card ring-1 ring-brand-100 p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="font-display font-800 text-lg text-brand-800">${tr("set.areas")}</h3>
          <input id="setSearch" type="search" class="field !w-64 !py-2" placeholder="${esc(tr("sched.searchPh"))}" />
        </div>
        <div class="mt-3 overflow-x-auto">
          <table class="w-full text-sm min-w-[720px]">
            <thead><tr class="text-left text-xs text-slate-500"><th class="py-2">${tr("sched.area")}</th><th>${tr("sched.truckRoute")}</th><th>${tr("set.days")}</th><th></th></tr></thead>
            <tbody id="setAreas">${AREAS.map(a => `<tr class="border-t border-slate-100" data-name="${esc(a.name.toLowerCase())}">
              <td class="py-2 font-semibold">${esc(a.name)} ${a.custom ? chip(tr("set.added"), "bg-sky-100 text-sky-800") : ""}</td>
              <td class="text-xs text-slate-500 whitespace-nowrap">${a.truck} · ${a.route}</td>
              <td><div class="flex gap-1" data-area-days="${a.id}">${dayBoxes("d-" + a.id, a.days)}</div></td>
              <td class="text-right">${a.custom ? `<button data-act="area-remove" data-id="${a.id}" class="text-xs font-bold text-red-600 hover:underline">${tr("common.delete")}</button>` : ""}</td></tr>`).join("")}</tbody>
          </table>
        </div>
      </div>

      <div class="mt-6 rounded-3xl bg-white shadow-card ring-1 ring-brand-100 p-5">
        <h3 class="font-display font-800 text-lg text-brand-800">${tr("set.addArea")}</h3>
        <p class="text-xs text-slate-500">${tr("set.addHint")}</p>
        <div class="mt-3 grid md:grid-cols-3 gap-3">
          <div><label class="field-label" for="newAreaName">${tr("set.name")}</label><input id="newAreaName" class="field mt-1.5" placeholder="${esc(tr("set.namePh"))}" /></div>
          <div><label class="field-label" for="newAreaNear">${tr("set.near")}</label><select id="newAreaNear" class="field mt-1.5">${routes.map(r => `<optgroup label="${r}">${AREAS.filter(a => a.route === r && !a.custom).map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</optgroup>`).join("")}</select></div>
          <div><span class="field-label">${tr("set.days")}</span><div class="mt-2 flex gap-1" id="newAreaDays">${dayBoxes("newday", [])}</div></div>
        </div>
        <button data-act="area-add" class="mt-3 btn-outline"><i data-lucide="plus" class="w-4 h-4"></i> ${tr("set.addBtn")}</button>
      </div>

      <div class="mt-6 rounded-3xl bg-white shadow-card ring-1 ring-brand-100 p-5" id="liveSettings">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="font-display font-800 text-lg text-brand-800 flex items-center gap-2"><i data-lucide="satellite-dish" class="w-5 h-5"></i> ${tr("live.title")}</h3>
          <span id="liveStatus">${liveStatusChip()}</span>
        </div>
        <p class="mt-1 text-sm text-slate-500 max-w-3xl">${tr("live.intro")}</p>
        <label class="field-label mt-4 block" for="liveUrl">${tr("live.url")}</label>
        <input id="liveUrl" class="field mt-1.5" value="${esc(LIVE.url)}" placeholder="https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app" spellcheck="false" autocomplete="off" />
        <p class="mt-1 text-xs text-slate-500">${tr("live.urlHint")}</p>
        <div class="mt-4 overflow-x-auto">
          <table class="w-full text-sm min-w-[620px]">
            <thead><tr class="text-left text-xs text-slate-500"><th class="py-2">${tr("legend.truck")}</th><th>${tr("live.device")}</th><th>${tr("live.lastSeen")}</th><th></th></tr></thead>
            <tbody>${TRUCKS.map(t => `<tr class="border-t border-slate-100">
              <td class="py-2 font-semibold"><span class="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style="background:${t.color}"></span>${t.id}</td>
              <td><input class="field !py-1.5 !w-44 font-mono text-xs" data-live-dev="${t.id}" value="${esc(deviceFor(t))}" spellcheck="false" /></td>
              <td class="text-xs" data-live-seen="${t.id}">${liveSeenText(t)}</td>
              <td class="text-right">${LIVE.url ? `<button data-act="live-test" data-id="${t.id}" class="text-xs font-bold text-brand-700 hover:underline">${tr("live.test")}</button>` : ""}</td></tr>`).join("")}</tbody>
          </table>
        </div>
      </div>

      <div class="mt-6 flex flex-wrap gap-3">
        <button data-act="settings-save" class="h-11 px-6 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold">${tr("set.save")}</button>
        <button data-act="settings-reset" class="h-11 px-6 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold">${tr("set.reset")}</button>
      </div>`;
  }
  function liveStatusChip() {
    const s = !LIVE.url ? "off" : LIVE.status;
    const tone = { off: "bg-slate-100 text-slate-600", connecting: "bg-amber-100 text-amber-800", ok: "bg-brand-100 text-brand-800", error: "bg-red-100 text-red-700", denied: "bg-red-100 text-red-700" }[s];
    return chip(tr("live.status." + s), tone);
  }
  function liveSeenText(t) {
    const f = liveFix(t);
    if (!LIVE.url) return `<span class="text-slate-400">—</span>`;
    if (!f) return `<span class="text-slate-400">${tr("live.never")}</span>`;
    return `<span class="${f.stale ? "text-red-600" : "text-brand-700"} font-semibold">${timeAgo(f.seen)}</span> <span class="text-slate-400">· ${ll(f.pos)}${f.test ? " · " + tr("live.testTag") : ""}</span>`;
  }
  // keep the Settings status fresh without re-rendering the form
  function refreshLiveSettings() {
    if (!$("#liveSettings")) return;
    $("#liveStatus").innerHTML = liveStatusChip();
    TRUCKS.forEach(t => { const el = $(`[data-live-seen="${t.id}"]`); if (el) el.innerHTML = liveSeenText(t); });
  }
  function readSettings() {
    const next = { trucks: {}, areas: {}, added: (config.added || []).map(c => ({ ...c })) };
    if ($("#liveUrl")) {
      next.live = { url: $("#liveUrl").value.trim(), devices: {} };
      TRUCKS.forEach(t => { next.live.devices[t.id] = $(`[data-live-dev="${t.id}"]`).value.trim(); });
    } else if (config.live) next.live = config.live;
    TRUCKS.forEach(t => next.trucks[t.id] = { driver: $(`[data-truck-driver="${t.id}"]`).value.trim() || t.driver, window: $(`[data-truck-window="${t.id}"]`).value.trim() || t.window });
    AREAS.forEach(a => {
      const days = $$(`input[name="d-${a.id}"]:checked`).map(i => +i.value);
      if (a.custom) { const c = next.added.find(x => x.id === a.id); if (c) c.days = days; }
      else if (!sameDays(days, a.baseDays)) next.areas[a.id] = { days };
    });
    return next;
  }
  function saveSettings(next) {
    store.set("config", next);
    sessionStorage.setItem("sb.scroll", "0");
    location.reload();
  }

  function findItem(kind, id) {
    if (kind === "stop") { const a = areaById(id), r = rec(a); return r && { kind, r, area: a, src: photoFor(r), title: a.name }; }
    if (kind === "prev") { const a = areaById(id), r = rec(a)?.recovered; return r && { kind, r, area: a, src: photoFor(r), title: tr("adm.earlierToday", { name: a.name }) }; }
    if (kind === "truck") { const t = truckById(id), r = ended(t); return r && { kind, r, src: photoFor(r), title: `${tr("truck.label", { id: t.id })} — ${reasonText(r.reason)}` }; }
    const r = reports.find(x => x.id === id);
    return r && { kind: "report", r, area: areaById(r.areaId), src: r.photo, title: tr("adm.residentReport", { type: areaById(r.areaId)?.name || "" }) };
  }

  function openPhoto(kind, id) {
    const i = findItem(kind, id);
    if (!i || !i.src) return;
    const r = i.r;
    openModal(`
      <img src="${i.src}" alt="${esc(tr("proof.alt"))}" class="w-full" />
      <div class="p-5">
        <p class="font-display font-800 text-lg text-brand-800">${esc(i.title)}</p>
        ${kind === "report"
          ? `<p class="text-xs text-slate-500">${fmtStamp(r.createdAt)} · ${ll(r.latlng)}</p>${r.notes ? `<p class="mt-2 text-sm">${esc(txt(r.notes))}</p>` : ""}`
          : `<p class="text-xs text-slate-500">${fmtStamp(r.at)} · GPS ${ll(r.latlng)}</p>
             ${r.reason ? `<p class="mt-2 text-sm"><b>${tr("cam.reason")}:</b> ${esc(reasonText(r.reason))}</p>` : ""}
             ${r.note ? `<p class="mt-1 text-sm"><b>${tr("photo.driverNote")}:</b> ${esc(r.note)}</p>` : ""}
             <div class="mt-2 flex flex-wrap gap-1">${proofBadges(r, i.area)}</div>`}
        <div class="mt-2 flex flex-wrap gap-1">${wasteChips(r.verified?.types || r.types)}</div>
        <button data-close-modal class="mt-4 w-full h-11 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50">${tr("common.close")}</button>
      </div>`);
  }

  function openReview(kind, id) {
    const i = findItem(kind, id);
    if (!i) return;
    const r = i.r, typed = kind !== "truck";
    openModal(`
      <img src="${i.src}" alt="" class="w-full max-h-[45vh] object-cover" />
      <form id="reviewForm" class="p-5 space-y-4">
        <div>
          <p class="font-display font-800 text-lg text-brand-800">${esc(i.title)}</p>
          <p class="text-xs text-slate-500">${fmtStamp(r.at || r.createdAt)} · ${ll(r.latlng)}</p>
          ${kind !== "report" ? `<div class="mt-2 flex flex-wrap gap-1">${proofBadges(r, i.area)}</div>` : ""}
        </div>
        ${typed ? `<fieldset><legend class="field-label">${tr("rev.typeLegend")}</legend>
            <p class="text-xs text-slate-500">${tr(kind === "report" ? "rev.taggedResident" : "rev.taggedDriver")}</p>
            <div class="mt-2">${wastePicker("revWaste", r.verified?.types || r.types || [])}</div></fieldset>`
          : `<p class="text-sm text-slate-600">${tr("rev.fullQ", { reason: reasonText(r.reason).toLowerCase() })}</p>`}
        <div class="grid grid-cols-2 gap-3">
          <button type="button" data-flag class="h-11 rounded-xl border-2 border-red-200 text-red-600 hover:bg-red-50 font-bold">${tr("rev.flag")}</button>
          <button class="h-11 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold">${tr("rev.confirm")}</button>
        </div>
      </form>`);
    const save = ok => {
      const types = typed ? pickedWaste("revWaste") : undefined;
      if (ok && typed && !types.length) return toast(tr("rev.needType"), "error");
      r.verified = { ok, types: typed ? types : undefined, at: Date.now() };
      if (kind === "truck") AREAS.forEach(a => { const x = rec(a); if (x?.status === "unserved" && x.truck === id && x.at === r.at) x.verified = r.verified; });
      if (kind === "report") { store.set("reports", reports); renderReports(); }
      changed(); closeModal();
      toast(ok ? tr("rev.verified") : tr("rev.flagged"), ok ? "ok" : "error");
      renderAdmin(true);
    };
    $("#reviewForm").onsubmit = e => { e.preventDefault(); save(true); };
    $("[data-flag]").onclick = () => save(false);
  }

  function openDecide(areaId) {
    const a = areaById(areaId), r = rec(a);
    if (!r || r.status !== "unserved") return;
    const others = TRUCKS.filter(t => t.id !== r.truck && !ended(t));
    const idle = others.filter(t => !nextPending(t));
    const onRoute = others.filter(t => nextPending(t));
    const opts = list => list.map(t => `<option value="${t.id}">${tr("truck.label", { id: t.id })} — ${tr("truck.load").toLowerCase()} ${truckLoad(t)}%, ${esc(truckStatusText(t).toLowerCase())}</option>`).join("");
    const nextDay = nextCollection(a, new Date(), true);
    const tomorrow = addDays(new Date(), 1);
    openModal(`
      <form id="decideForm" class="p-5 space-y-3">
        <div>
          <h2 class="font-display font-800 text-xl text-brand-800">${tr("dec.title")}</h2>
          <p class="text-sm text-slate-500">${esc(a.name)} · ${tr("truck.label", { id: r.truck })} · ${esc(reasonText(r.reason))}</p>
        </div>
        <label class="opt-card ${idle.length ? "" : "is-disabled"}">
          <input type="radio" name="kind" value="assign" ${idle.length ? "checked" : "disabled"} />
          <span class="flex-1"><b>${tr("dec.assign")}</b><span class="block text-xs text-slate-500">${idle.length ? tr("dec.assignHint") : tr("dec.assignNone")}</span>
            <select name="assignTruck" class="field mt-2 !py-2" ${idle.length ? "" : "disabled"}>${opts(idle)}</select></span>
        </label>
        <label class="opt-card ${onRoute.length ? "" : "is-disabled"}">
          <input type="radio" name="kind" value="redirect" ${onRoute.length ? (idle.length ? "" : "checked") : "disabled"} />
          <span class="flex-1"><b>${tr("dec.redirect")}</b><span class="block text-xs text-slate-500">${onRoute.length ? tr("dec.redirectHint") : tr("dec.redirectNone")}</span>
            <select name="redirectTruck" class="field mt-2 !py-2" ${onRoute.length ? "" : "disabled"}>${opts(onRoute)}</select></span>
        </label>
        <label class="opt-card">
          <input type="radio" name="kind" value="reschedule" ${others.length ? "" : "checked"} />
          <span class="flex-1"><b>${tr("dec.reschedule")}</b><span class="block text-xs text-slate-500">${nextDay ? tr("dec.nextRegular", { date: fmtDate(nextDay.date) }) : ""}</span>
            <input type="date" name="date" class="field mt-2 !py-2" min="${dateKey(tomorrow)}" value="${dateKey(nextDay ? nextDay.date : tomorrow)}" /></span>
        </label>
        <div class="grid grid-cols-2 gap-3 pt-1">
          <button type="button" data-close-modal class="h-11 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50">${tr("common.cancel")}</button>
          <button class="h-11 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold">${tr("dec.save")}</button>
        </div>
      </form>`);
    $("#decideForm").onsubmit = e => {
      e.preventDefault();
      const f = new FormData(e.target), kind = f.get("kind");
      if (!kind) return toast(tr("dec.choose"), "error");
      carry = carry.filter(c => !(c.areaId === a.id)); // replace any earlier reschedule
      if (kind === "reschedule") {
        const date = f.get("date");
        if (!date || date <= day.key) return toast(tr("dec.future"), "error");
        r.action = { kind, date, at: Date.now() };
        carry.push({ areaId: a.id, date });
      } else {
        r.action = { kind, truck: f.get(kind + "Truck"), at: Date.now() };
      }
      delete r.bounced;
      store.set("carry", carry);
      servedCache = new Map();
      changed(); closeModal();
      toast(tr("dec.saved"));
      renderAdmin(true);
    };
  }

  // ---------- Delegated actions ----------
  document.addEventListener("click", e => {
    const fly = e.target.closest("[data-fly]");
    if (fly) {
      const t = truckById(fly.dataset.fly);
      map.flyTo(t.marker.getLatLng(), 17, { duration: 0.8 });
      t.marker.openPopup();
      return;
    }
    const link = e.target.closest('a[href^="#"]');
    if (link && role !== "resident") setRole("resident");
    const lang = e.target.closest("[data-lang]");
    if (lang) return setLang(lang.dataset.lang);
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const { act, kind, id } = b.dataset;
    if (act === "photo") openPhoto(kind, id);
    else if (act === "review") openReview(kind, id);
    else if (act === "decide") openDecide(id);
    else if (act === "proof") driverProof();
    else if (act === "full") driverFull();
    else if (act === "device-check") openDeviceCheck();
    else if (act === "live-test") sendTestPosition(truckById(id));
    else if (act === "admin-tab") { adminTab = id; store.set("adminTab", id); renderAdmin(true); }
    else if (act === "rep-filter") { reportFilter = id; renderAdmin(true); }
    else if (act === "report-save") saveReportUpdate(id);
    else if (act === "ann-delete") {
      if (!confirm(tr("ann.confirmDelete"))) return;
      announcements = announcements.filter(n => n.id !== id);
      store.set("announcements", announcements);
      afterScheduleChange(); renderAdmin(true);
    }
    else if (act === "ann-dismiss") { dismissed.push(id); store.set("dismissedAnn", dismissed); renderBanner(); }
    else if (act === "sum-range") { summaryDays = +id; renderAdmin(true); }
    else if (act === "csv") downloadCSV(id);
    else if (act === "print") printReport();
    else if (act === "settings-save") saveSettings(readSettings());
    else if (act === "settings-reset") { if (confirm(tr("set.confirmReset"))) { localStorage.removeItem("sb.config"); location.reload(); } }
    else if (act === "area-add") {
      const name = $("#newAreaName").value.trim(), days = $$('input[name="newday"]:checked').map(i => +i.value);
      if (!name) return toast(tr("set.needName"), "error");
      if (!days.length) return toast(tr("set.needDays"), "error");
      const next = readSettings();
      next.added.push({ id: "c" + uid(), name, near: $("#newAreaNear").value, days });
      saveSettings(next);
    }
    else if (act === "area-remove") {
      const next = readSettings();
      next.added = next.added.filter(c => c.id !== id);
      saveSettings(next);
    }
    else if (act === "reset-demo") {
      ["day", "photos", "carry", "manualTruck", "manualSet"].forEach(k => localStorage.removeItem("sb." + k));
      location.reload();
    }
  });
  document.addEventListener("change", e => {
    if (e.target.id === "driverTruck") {
      driverTruckId = e.target.value;
      store.set("driverTruck", driverTruckId);
      if (manualTruck !== null) setManual(driverTruckId);
      renderDriver();
    }
    if (e.target.id === "driverManual") { setManual(e.target.checked ? driverTruckId : null); renderDriver(); }
    if (e.target.id === "annKind") $("#annKindHint").textContent = tr("ann.hint." + e.target.value);
  });
  document.addEventListener("input", e => {
    if (e.target.id === "setSearch") {
      const q = e.target.value.trim().toLowerCase();
      $$("#setAreas tr").forEach(tr_ => tr_.classList.toggle("hidden", !!q && !tr_.dataset.name.includes(q)));
    }
  });
  document.addEventListener("submit", e => {
    if (e.target.id === "annForm") { e.preventDefault(); publishAnnouncement(); }
  });

  // ---------- Simulation loop ----------
  function checkMyArea() {
    const a = areaById(myAreaId), s = areaStatus(a);
    const act = s.r?.action;
    const sig = s.kind + "|" + (act ? act.kind + (act.truck || act.date) : "");
    if (lastSig !== null && sig !== lastSig) {
      if (s.kind === "arrived") notify({ icon: "truck", color: "orange", key: "n.arrived", vars: { truck: s.t.id, area: a.name } });
      else if (s.kind === "collected") onCollected(a, s);
      else if (s.kind === "unserved" && !lastSig.startsWith("unserved")) notify({ icon: "alert-triangle", color: "red", key: "n.notCollected", vars: { truck: s.r.truck, area: a.name, reason: "@reason." + s.r.reason } });
      else if (s.kind === "unserved" && act?.kind === "reschedule") notify({ icon: "calendar-check", color: "green", key: "n.catchupDate", vars: { area: a.name, date: "#d:" + act.date } });
      else if (s.kind === "unserved" && act) notify({ icon: "calendar-check", color: "green", key: "n.catchupTruck", vars: { area: a.name, truck: act.truck } });
    }
    lastSig = sig;
    if (s.kind === "onway" && s.eta <= ETA_ALERT_MIN && !etaAlerted) {
      etaAlerted = true;
      notify({ icon: "truck", color: "orange", key: "n.eta", vars: { truck: s.t.id, n: s.eta, area: a.name } });
    }
  }
  let lastTick = performance.now();
  function tick() {
    // Use real elapsed time so trucks keep pace when the tab is in the background
    const now = performance.now();
    const dt = Math.min(2, (now - lastTick) / 1000);
    lastTick = now;
    TRUCKS.forEach(t => { stepTruck(t, dt); t.marker.setLatLng(t.pos); });
    if (dirty) {
      dirty = false;
      drawStops(); renderFleet(); renderDriver(); renderAdmin(); renderProofCard();
    }
    checkMyArea();
    renderTracker();
    renderGuide();
    drawDriverMap(false);
  }
  setInterval(tick, TICK_MS);

  // ---------- Pickup confirmation (Shopee-style "Did you receive it?") ----------
  function onCollected(area, s) {
    notify({ icon: "check-circle-2", color: "green", key: "n.collected", vars: { area: area.name, truck: s.t.id }, action: "confirm" });
    if (role === "resident" && !shownConfirmThisSession && $("#modal").classList.contains("hidden")) {
      shownConfirmThisSession = true;
      openConfirm();
    }
  }

  function openConfirm() {
    const area = areaById(myAreaId), r = rec(area);
    if (r?.status !== "collected") return toast(tr("conf.none"), "error");
    const truck = truckById(r.truck), when = new Date(r.at);
    openModal(`
      <div class="max-h-[92vh] overflow-y-auto">
      <div class="p-6 pb-4 text-center">
        <div class="mx-auto grid place-items-center w-16 h-16 rounded-full bg-brand-700 text-white">${svg("check", "w-8 h-8")}</div>
        <h2 class="mt-3 font-display font-800 text-2xl text-brand-800">${tr("conf.title")}</h2>
        <p class="text-sm text-slate-500">${tr("conf.sub")}</p>
      </div>
      <div class="mx-6 rounded-2xl overflow-hidden ring-1 ring-slate-200">
        <img src="${photoFor(r)}" alt="${esc(tr("proof.alt"))}" class="w-full aspect-[16/10] object-cover" />
        <div class="p-2 flex flex-wrap gap-1">${proofBadges(r, area)} ${wasteChips(r.types)}</div>
      </div>
      <dl class="mx-6 mt-3 rounded-2xl bg-slate-50 divide-y divide-slate-200 text-sm">
        <div class="flex justify-between p-3"><dt class="text-slate-500">${tr("conf.when")}</dt><dd class="font-semibold">${fmtDate(when)}, ${fmtTime(when)}</dd></div>
        <div class="flex justify-between p-3"><dt class="text-slate-500">${tr("truck.driver")}</dt><dd class="font-semibold">${esc(truck.driver)} · ${tr("truck.label", { id: truck.id })}</dd></div>
        <div class="flex justify-between gap-4 p-3"><dt class="text-slate-500">${tr("conf.where")}</dt><dd class="font-semibold text-right">${esc(area.name)}</dd></div>
      </dl>
      <div class="p-6">
        <p class="text-center font-bold text-slate-700">${tr("conf.q")}</p>
        <div class="mt-4 grid grid-cols-2 gap-3">
          <button data-confirm-yes class="h-12 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold">${tr("conf.yes")}</button>
          <button data-confirm-no class="h-12 rounded-xl border-2 border-red-200 text-red-600 hover:bg-red-50 font-bold">${tr("conf.no")}</button>
        </div>
      </div></div>`);
    $("[data-confirm-yes]").onclick = () => {
      closeModal();
      toast(tr("conf.thanks"));
      notify({ icon: "star", color: "amber", key: "n.feedback" });
      $("#community").scrollIntoView({ behavior: "smooth" });
    };
    $("[data-confirm-no]").onclick = () => openMissed();
  }

  // ---------- Missed collection modal ----------
  const MISSED_REASONS = ["notPassed", "passedNoPickup", "partial", "early", "other"];
  function openMissed() {
    const a = areaById(myAreaId);
    missedPhoto = null;
    openModal(`
      <div class="bg-red-50 p-6 text-center">
        <div class="mx-auto grid place-items-center w-14 h-14 rounded-full bg-red-600 text-white font-display font-900 text-2xl">!</div>
        <h2 class="mt-3 font-display font-800 text-xl text-red-700">${tr("miss.title")}</h2>
        <p class="text-sm text-slate-600">${tr("miss.sub")}</p>
      </div>
      <form id="missedForm" class="p-6 space-y-4">
        <div>
          <label class="field-label" for="mDate">${tr("miss.date")}</label>
          <input id="mDate" type="date" class="field mt-1.5" value="${dateKey()}" required />
        </div>
        <div>
          <label class="field-label" for="mReason">${tr("cam.reason")}</label>
          <select id="mReason" class="field mt-1.5" required>
            <option value="">${tr("miss.select")}</option>
            ${MISSED_REASONS.map(k => `<option value="${k}">${tr("miss.r." + k)}</option>`).join("")}
          </select>
        </div>
        <div>
          <label class="field-label" for="mNotes">${tr("miss.details")} <span class="font-normal text-slate-400">${tr("common.optional")}</span></label>
          <textarea id="mNotes" rows="2" class="field mt-1.5" placeholder="${esc(tr("miss.detailsPh"))}"></textarea>
        </div>
        <label class="flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 p-3 cursor-pointer hover:border-red-300">
          <img id="mPreview" class="hidden w-14 h-14 rounded-lg object-cover" alt="" />
          <span class="text-sm text-slate-500" id="mPhotoText">${tr("miss.photo")}</span>
          <input id="mPhoto" type="file" accept="image/*" class="sr-only" />
        </label>
        <p class="text-xs text-slate-500">${tr("miss.areaLine", { area: esc(a.name), truck: a.truck })}</p>
        <div class="grid grid-cols-2 gap-3">
          <button type="button" data-close-modal class="h-12 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50">${tr("common.cancel")}</button>
          <button class="h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold">${tr("rep.submit")}</button>
        </div>
      </form>`);
    $("#mPhoto").onchange = async e => {
      missedPhoto = await readPhoto(e.target.files[0], PHOTO_MAX);
      if (missedPhoto) { $("#mPreview").src = missedPhoto; $("#mPreview").classList.remove("hidden"); $("#mPhotoText").textContent = tr("miss.attached"); }
    };
    $("#missedForm").onsubmit = e => {
      e.preventDefault();
      const reason = $("#mReason").value;
      if (!reason) { $("#mReason").focus(); toast(tr("miss.needReason"), "error"); return; }
      const extra = $("#mNotes").value.trim();
      const notes = { en: `${I18N.en["miss.r." + reason]}${extra ? " — " + extra : ""} (${$("#mDate").value})`, tl: `${I18N.tl["miss.r." + reason]}${extra ? " — " + extra : ""} (${$("#mDate").value})` };
      addReport({ type: "missed", areaId: a.id, latlng: a.latlng, notes, photo: missedPhoto, types: [] });
      closeModal();
    };
  }
  $$("[data-open-missed]").forEach(b => b.addEventListener("click", openMissed));

  // ---------- Modal plumbing ----------
  function openModal(html, wide) {
    if (modalOnClose) { const fn = modalOnClose; modalOnClose = null; fn(); }
    $("#modalBody").innerHTML = html;
    $("#modalBody").classList.toggle("max-w-md", !wide);
    $("#modalBody").classList.toggle("max-w-lg", !!wide);
    $("#modal").classList.remove("hidden");
    $("#modal").classList.add("flex");
    icons();
  }
  function closeModal() {
    $("#modal").classList.add("hidden");
    $("#modal").classList.remove("flex");
    if (modalOnClose) { const fn = modalOnClose; modalOnClose = null; fn(); }
  }
  $("#modal").addEventListener("click", e => { if (e.target.closest("[data-close-modal]")) closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { closeModal(); closeDrawer(); } });

  // ---------- Report form ----------
  $("#reportTypes").innerHTML = REPORT_TYPES.map((t, i) => `
    <label class="type-chip relative">
      <input type="radio" name="rtype" value="${t.id}" ${i === 0 ? "checked" : ""} />
      <i data-lucide="${t.icon}" class="w-4 h-4 shrink-0"></i>${esc(rtypeText(t.id))}
    </label>`).join("");
  const photoPlaceholderHTML = () => `<i data-lucide="image-plus" class="w-8 h-8 text-brand-600"></i><span>${tr("rep.choosePhoto")}</span>`;

  function togglePick(on) {
    pickMode = on;
    $("#pickOnMap").classList.toggle("is-active", on);
    $("#pickHint").classList.toggle("hidden", !on);
    document.body.classList.toggle("map-picking", on);
    if (on) $("#track").scrollIntoView({ behavior: "smooth" });
  }
  function setPicked(latlng, label = tr("rep.pinned")) {
    pickedLatLng = latlng;
    if (pickMarker) pickMarker.remove();
    pickMarker = L.marker(latlng, {
      icon: L.divIcon({ className: "", iconSize: [30, 30], iconAnchor: [15, 30], html: `<div class="report-marker" style="background:#f28c1b">${svg("trash")}</div>` }),
    }).addTo(map);
    $("#coordsText").innerHTML = `<span class="text-brand-700 font-semibold">✓ ${esc(label)}</span> · ${ll(latlng)}`;
  }
  $("#pickOnMap").addEventListener("click", () => togglePick(!pickMode));
  $("#useGps").addEventListener("click", () => {
    if (!navigator.geolocation) return toast(tr("rep.noGps"), "error");
    $("#coordsText").textContent = tr("rep.locating");
    navigator.geolocation.getCurrentPosition(
      p => { setPicked([p.coords.latitude, p.coords.longitude], tr("rep.usingLoc")); map.flyTo([p.coords.latitude, p.coords.longitude], 17); },
      () => { $("#coordsText").textContent = tr("rep.locFail"); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
  $("#photoInput").addEventListener("change", async e => {
    reportPhotoRaw = await readPhoto(e.target.files[0], PHOTO_MAX);
    if (!reportPhotoRaw) return;
    $("#photoPreview").src = reportPhotoRaw;
    $("#photoPreview").classList.remove("hidden");
    $("#photoPlaceholder").innerHTML = `<span class="text-xs text-slate-500">${tr("rep.changePhoto")}</span>`;
  });

  $("#reportForm").addEventListener("submit", async e => {
    e.preventDefault();
    const form = e.target;
    const type = $('input[name="rtype"]:checked')?.value;
    const area = areaById($("#reportArea").value);
    const types = [];          // households don't classify; barangay staff tag the type when verifying the photo
    if (!reportPhotoRaw) { $("#photoDrop").scrollIntoView({ behavior: "smooth", block: "center" }); return toast(tr("rep.needPhoto"), "error"); }
    const jitter = () => (Math.random() - 0.5) * 0.0006;
    const latlng = pickedLatLng || [area.latlng[0] + jitter(), area.latlng[1] + jitter()];
    const img = await loadImage(reportPhotoRaw);
    const photo = stamp(fitCanvas(img, img.width, img.height), [`Household report · ${area.name}`, `${stampTime(Date.now())} · ${ll(latlng)}`, "HOUSEHOLD UPLOAD"]);
    addReport({ type, areaId: area.id, latlng, notes: $("#reportNotes").value.trim(), photo, types });
    // reset
    form.reset();
    $("#reportArea").value = myAreaId;
    reportPhotoRaw = null; pickedLatLng = null;
    if (pickMarker) { pickMarker.remove(); pickMarker = null; }
    $("#photoPreview").classList.add("hidden");
    $("#photoPlaceholder").innerHTML = photoPlaceholderHTML();
    $("#coordsText").textContent = tr("rep.noPin");
    icons();
  });

  function addReport(data) {
    const r = { id: uid(), createdAt: Date.now(), status: "received", verified: null, thread: [], mine: true, ...data };
    reports.unshift(r);
    if (!store.set("reports", reports)) { r.photo = null; store.set("reports", reports); }
    drawReports();
    renderReports();
    rev++; dirty = true;
    notify({ icon: "alert-triangle", color: "red", key: r.type === "missed" ? "n.missedSent" : "n.reportSent", vars: { area: areaById(r.areaId).name } });
    toast(tr("rep.thanks"));
  }

  // Resident's own reports, with the barangay's status updates and replies
  function renderReports() {
    const mine = reports.filter(r => r.mine);
    const open = mine.filter(r => OPEN_STATUSES.includes(r.status));
    $("#reportCount").textContent = tr("rep.openCount", { n: open.length });
    $("#statReports").textContent = reports.filter(r => OPEN_STATUSES.includes(r.status)).length;
    $("#reportList").innerHTML = mine.length ? mine.slice(0, 8).map(r => {
      const type = REPORT_TYPES.find(x => x.id === r.type);
      const lastReply = (r.thread || []).filter(x => x.by === "staff" && x.text).pop();
      return `<li class="rounded-2xl bg-slate-50 ring-1 ring-slate-100 p-3">
        <div class="flex gap-3">
          ${r.photo
            ? `<button data-act="photo" data-kind="report" data-id="${r.id}" class="shrink-0" aria-label="${esc(tr("proof.enlarge"))}"><img src="${r.photo}" alt="" class="w-20 h-20 rounded-xl object-cover" /></button>`
            : `<span class="grid place-items-center w-20 h-20 rounded-xl bg-red-100 text-red-600 shrink-0"><i data-lucide="${type?.icon}" class="w-7 h-7"></i></span>`}
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-2">
              <p class="font-bold text-sm text-slate-800">${esc(rtypeText(r.type))} ${r.sample ? `<span class="text-[10px] font-bold text-slate-400">${tr("common.sample")}</span>` : ""}</p>
              ${chip(esc(statusText(r.status)), STATUS_TONE[r.status])}
            </div>
            <p class="text-xs text-slate-500 truncate">${esc(areaById(r.areaId)?.name)} · ${timeAgo(r.createdAt)}</p>
            ${r.notes ? `<p class="text-xs text-slate-600 mt-1 line-clamp-2">${esc(txt(r.notes))}</p>` : ""}
            <div class="mt-1.5 flex flex-wrap gap-1">${wasteChips(r.verified?.types || r.types)}${r.verified ? chip(tr("rep.typeVerified"), "bg-sky-100 text-sky-800") : ""}</div>
          </div>
        </div>
        ${lastReply ? `<p class="mt-2 rounded-xl bg-white ring-1 ring-brand-100 px-3 py-2 text-xs"><b class="text-brand-700">${tr("rep.staff")}:</b> ${esc(txt(lastReply.text))}</p>` : ""}
        <div class="mt-2 flex items-center gap-4 text-xs font-bold">
          <button data-show-report="${r.id}" class="text-brand-700 hover:underline">${tr("rep.viewMap")}</button>
          <details class="flex-1"><summary class="text-slate-500 cursor-pointer">${tr("rep.updates", { n: (r.thread || []).length })}</summary>${reportThreadHTML(r)}</details>
        </div>
      </li>`;
    }).join("") : `<li class="text-sm text-slate-500">${tr("rep.none")}</li>`;
    icons();
  }
  $("#reportList").addEventListener("click", e => {
    const show = e.target.closest("[data-show-report]");
    if (show) {
      const r = reports.find(x => x.id === show.dataset.showReport);
      $("#track").scrollIntoView({ behavior: "smooth" });
      setTimeout(() => map.flyTo(r.latlng, 18, { duration: 0.8 }), 400);
    }
  });

  // ---------- Announcements for residents ----------
  // Cancellations first, then extra collections, then notices; soonest first within each
  const ANN_ORDER = { cancel: 0, extra: 1, notice: 2 };
  const relevantAnns = a => announcements.filter(n => n.to >= day.key && inScope(n, a))
    .sort((x, y) => (ANN_ORDER[x.kind] - ANN_ORDER[y.kind]) || x.from.localeCompare(y.from));
  function renderBanner() {
    const list = relevantAnns(areaById(myAreaId)).filter(n => !dismissed.includes(n.id)).slice(0, 2);
    const icon = { notice: "info", cancel: "calendar-x", extra: "calendar-plus" };
    $("#annBanner").innerHTML = list.map(n => `
      <div class="ann ann-${n.kind}">
        <div class="mx-auto max-w-7xl px-4 py-2.5 flex items-start gap-3">
          <i data-lucide="${icon[n.kind]}" class="w-5 h-5 shrink-0 mt-0.5"></i>
          <p class="flex-1 text-sm"><b>${esc(txt(n.title))}</b> <span class="opacity-80">· ${dateRange(n)}</span>${n.sample ? ` <span class="text-[10px] font-bold opacity-60">${tr("common.sample")}</span>` : ""}
            ${n.body ? `<span class="block text-xs opacity-90">${esc(txt(n.body))}</span>` : ""}</p>
          <button data-act="ann-dismiss" data-id="${n.id}" class="shrink-0 grid place-items-center w-7 h-7 rounded-lg hover:bg-black/10" aria-label="${esc(tr("common.dismiss"))}"><i data-lucide="x" class="w-4 h-4"></i></button>
        </div>
      </div>`).join("");
    // full list in the schedule section
    const changes = announcements.filter(n => n.to >= day.key).sort((x, y) => x.from.localeCompare(y.from));
    $("#schedChanges").innerHTML = changes.length ? `
      <h3 class="font-display font-800 text-lg text-brand-800">${tr("sched.changes")}</h3>
      <ul class="mt-3 grid md:grid-cols-2 gap-3">${changes.map(n => annCard(n, false)).join("")}</ul>` : "";
    icons();
  }

  // ---------- Pickup history (last 14 days) ----------
  function renderHistory() {
    const a = areaById(myAreaId);
    const out = [];
    for (let i = 0; i < 14; i++) {
      const d = addDays(new Date(), -i), dk = dateKey(d);
      const o = overrideFor(a, dk);
      let entry = null;
      if (i === 0) { const r = rec(a); if (r) entry = { s: r.status === "collected" ? "c" : "u", t: r.truck, at: r.at, r: r.reason, a: r.action?.kind }; }
      else entry = history[dk]?.stops?.[a.id] || null;
      if (entry) out.push({ d, ...entry });
      else if (o?.kind === "cancel" && a.days.includes(d.getDay())) out.push({ d, s: "x", title: o.title });
      else if (i === 0 && servedToday(a)) out.push({ d, s: "p" });
    }
    const sched = out.filter(x => x.s === "c" || x.s === "u");
    $("#historySummary").textContent = sched.length ? tr("hist.summary", { done: sched.filter(x => x.s === "c").length, total: sched.length }) : "";
    $("#historyList").innerHTML = out.length ? out.map(x => {
      const icon = { c: ["check", "bg-brand-600 text-white"], u: ["x", "bg-red-100 text-red-600"], x: ["calendar-x", "bg-amber-100 text-amber-700"], p: ["clock", "bg-slate-100 text-slate-500"] }[x.s];
      const line = x.s === "c" ? tr("hist.collected", { time: fmtTime(new Date(x.at)), truck: x.t })
        : x.s === "u" ? tr("hist.notCollected", { reason: reasonText(x.r).toLowerCase() }) + (x.a ? " · " + tr("hist.act." + x.a) : "")
        : x.s === "x" ? tr("hist.cancelled", { title: txt(x.title) }) : tr("hist.pending");
      return `<li class="flex items-center gap-3 py-2.5">
        <span class="grid place-items-center w-8 h-8 rounded-full shrink-0 ${icon[1]}"><i data-lucide="${icon[0]}" class="w-4 h-4"></i></span>
        <span class="w-24 shrink-0 text-xs font-bold text-slate-600">${fmtDate(x.d)}</span>
        <span class="text-sm text-slate-700">${esc(line)}</span>
      </li>`;
    }).join("") : `<li class="py-4 text-sm text-slate-500">${tr("hist.none")}</li>`;
    icons();
  }

  // ---------- Schedule ----------
  let activeGroup = "all";
  function renderGroupTabs() {
    const groups = [{ id: "all" }, ...SCHEDULE_GROUPS, ...(AREAS.some(a => a.group === "custom") ? [{ id: "custom" }] : [])];
    $("#groupTabs").innerHTML = groups.map(g =>
      `<button data-group="${g.id}" class="shrink-0 h-9 px-4 rounded-full text-xs font-bold ring-1 transition">${esc(g.id === "all" ? tr("sched.all") : tr("group." + g.id))}</button>`).join("");
  }
  renderGroupTabs();
  $("#groupTabs").addEventListener("click", e => {
    const b = e.target.closest("[data-group]");
    if (!b) return;
    activeGroup = b.dataset.group;
    renderSchedule();
  });
  $("#scheduleSearch").addEventListener("input", renderSchedule);

  function renderSchedule() {
    const today = new Date().getDay();
    $$("#groupTabs [data-group]").forEach(b => {
      const on = b.dataset.group === activeGroup;
      b.className = "shrink-0 h-9 px-4 rounded-full text-xs font-bold ring-1 transition " +
        (on ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-slate-600 ring-slate-200 hover:ring-brand-400");
    });
    $("#scheduleHead").innerHTML = `<th class="px-4 py-3 font-bold">${tr("sched.area")}</th><th class="px-3 py-3 font-bold">${tr("sched.truckRoute")}</th>` +
      ORDER.map(d => `<th class="px-2 py-3 text-center font-bold ${d === today ? "bg-accent-500" : ""}">${esc(dayName(d))}${d === today ? `<span class="block text-[9px] font-bold opacity-90">${tr("sched.today")}</span>` : ""}</th>`).join("");

    const q = $("#scheduleSearch").value.trim().toLowerCase();
    const rows = AREAS.filter(a => (activeGroup === "all" || a.group === activeGroup) && (!q || a.name.toLowerCase().includes(q)));
    $("#scheduleBody").innerHTML = rows.length ? rows.map(a => {
      const t = truckById(a.truck);
      const mine = a.id === myAreaId;
      return `<tr class="hover:bg-brand-50/60 cursor-pointer ${mine ? "bg-brand-50" : ""}" data-area-row="${a.id}" title="${esc(tr("sched.setMine"))}">
        <td class="px-4 py-3 font-semibold">${mine ? `<span class="pill bg-brand-700 text-white mr-2">${tr("sched.myArea")}</span>` : ""}${esc(a.name)}</td>
        <td class="px-3 py-3"><span class="inline-flex items-center gap-1.5 text-xs font-bold"><span class="w-2 h-2 rounded-full" style="background:${t.color}"></span>${t.id}</span><span class="block text-[10px] text-slate-400 whitespace-nowrap">${a.route}</span></td>
        ${ORDER.map(d => `<td class="px-2 py-3 text-center ${d === today ? "bg-accent-500/5" : ""}">${a.days.includes(d)
          ? `<span class="inline-grid place-items-center w-7 h-7 rounded-full bg-brand-600 text-white">${svg("check", "w-4 h-4")}</span>`
          : '<span class="text-slate-300">—</span>'}</td>`).join("")}
      </tr>`;
    }).join("") : `<tr><td colspan="9" class="px-4 py-10 text-center text-slate-500">${esc(tr("sched.noMatch", { q }))}</td></tr>`;
  }
  $("#scheduleBody").addEventListener("click", e => {
    const row = e.target.closest("[data-area-row]");
    if (row) { setMyArea(row.dataset.areaRow); toast(tr("sched.saved")); }
  });

  // ---------- Designated area photo ----------
  let pendingAreaPhoto = null;
  function loadAreaPhoto() {
    const p = areaPhotos[myAreaId];
    pendingAreaPhoto = p?.photo || null;
    $("#areaPhoto").src = p?.photo || "";
    $("#areaPhoto").classList.toggle("hidden", !p?.photo);
    $("#areaPhotoEmpty").classList.toggle("hidden", !!p?.photo);
    $("#areaPhotoNotes").value = p?.notes || "";
  }
  $("#areaPhotoInput").addEventListener("change", async e => {
    pendingAreaPhoto = await readPhoto(e.target.files[0], PHOTO_MAX);
    if (!pendingAreaPhoto) return;
    $("#areaPhoto").src = pendingAreaPhoto;
    $("#areaPhoto").classList.remove("hidden");
    $("#areaPhotoEmpty").classList.add("hidden");
  });
  $("#saveAreaPhoto").addEventListener("click", () => {
    if (!pendingAreaPhoto) return toast(tr("spot.needPhoto"), "error");
    areaPhotos[myAreaId] = { photo: pendingAreaPhoto, notes: $("#areaPhotoNotes").value.trim(), savedAt: Date.now() };
    if (store.set("areaPhotos", areaPhotos)) toast(tr("spot.saved"));
  });

  // ---------- Feedback ----------
  $("#stars").innerHTML = [1, 2, 3, 4, 5].map(n =>
    `<button type="button" class="star-btn" role="radio" aria-checked="false" aria-label="${esc(tr("fb.stars", { n }))}" data-star="${n}">${svg("star")}</button>`).join("");
  function paintStars(n) { $$("#stars .star-btn").forEach(b => { const on = +b.dataset.star <= n; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(+b.dataset.star === rating)); }); }
  $("#stars").addEventListener("click", e => { const b = e.target.closest("[data-star]"); if (b) { rating = +b.dataset.star; paintStars(rating); } });
  $("#stars").addEventListener("mouseover", e => { const b = e.target.closest("[data-star]"); if (b) paintStars(+b.dataset.star); });
  $("#stars").addEventListener("mouseleave", () => paintStars(rating));
  function renderAvg() {
    if (!feedback.length) { $("#avgRating").textContent = tr("fb.noRatings"); return; }
    const avg = feedback.reduce((s, f) => s + f.rating, 0) / feedback.length;
    $("#avgRating").textContent = tr("fb.avg", { avg: avg.toFixed(1), n: feedback.length });
  }
  $("#submitFeedback").addEventListener("click", () => {
    if (!rating) return toast(tr("fb.needRating"), "error");
    feedback.push({ rating, text: $("#feedbackText").value.trim(), areaId: myAreaId, at: Date.now() });
    store.set("feedback", feedback);
    rating = 0; paintStars(0); $("#feedbackText").value = "";
    renderAvg();
    toast(tr("fb.thanks"));
  });

  // ---------- Notifications ----------
  // Stored as a text key + values, so they show in whichever language is chosen.
  const TONES = { green: "bg-brand-600", orange: "bg-accent-500", red: "bg-red-600", amber: "bg-amber-400", slate: "bg-slate-500" };
  function resolveVars(vars = {}) {
    const out = {};
    for (const [k, v] of Object.entries(vars)) {
      out[k] = typeof v === "string" && v.startsWith("@") ? tr(v.slice(1))
        : typeof v === "string" && v.startsWith("#d:") ? fmtDate(keyToDate(v.slice(3)))
        : typeof v === "object" && v ? txt(v) : v;
    }
    return out;
  }
  const notifText = n => n.key
    ? { title: tr(n.key + ".t", resolveVars(n.vars)), body: tr(n.key + ".b", resolveVars(n.vars)) }
    : { title: n.title, body: n.body };
  function notify({ icon, color = "green", key, vars, action }) {
    const n = { id: uid(), icon, color, key, vars, action, at: Date.now(), read: false };
    notifs.unshift(n);
    notifs = notifs.slice(0, 40);
    store.set("notifs", notifs);
    renderNotifs();
    const { title, body } = notifText(n);
    if (role === "resident") toast(title);
    if ("Notification" in window && Notification.permission === "granted") {
      try { new Notification(title, { body, icon: "assets/img/favicon.png" }); } catch { /* some browsers need a service worker */ }
    }
  }
  function renderNotifs() {
    const unread = notifs.filter(n => !n.read).length;
    $("#bellCount").textContent = unread > 9 ? "9+" : unread;
    $("#bellCount").classList.toggle("hidden", !unread);
    $("#notifList").innerHTML = notifs.length ? notifs.map(n => {
      const { title, body } = notifText(n);
      return `
      <li class="flex gap-3 p-4 ${n.read ? "" : "bg-brand-50/60"}">
        <span class="grid place-items-center w-10 h-10 rounded-full text-white shrink-0 ${TONES[n.color] || TONES.green}"><i data-lucide="${n.icon}" class="w-5 h-5"></i></span>
        <div class="min-w-0 flex-1">
          <div class="flex justify-between gap-2"><p class="font-bold text-sm">${esc(title)}</p><span class="text-[11px] text-slate-400 shrink-0">${timeAgo(n.at)}</span></div>
          <p class="text-xs text-slate-600">${esc(body)}</p>
          ${n.action === "confirm" ? `<button data-notif-confirm class="mt-1.5 text-xs font-bold text-brand-700 hover:underline">${tr("notif.confirm")}</button>` : ""}
        </div></li>`;
    }).join("")
      : `<li class="p-8 text-center text-sm text-slate-500">${tr("notif.none")}</li>`;
    icons();
  }
  function openDrawer() { $("#drawer").classList.remove("hidden"); renderNotifs(); }
  function closeDrawer() {
    if ($("#drawer").classList.contains("hidden")) return;
    $("#drawer").classList.add("hidden");
    notifs.forEach(n => (n.read = true));
    store.set("notifs", notifs);
    renderNotifs();
  }
  $("#bellBtn").addEventListener("click", openDrawer);
  $("#drawer").addEventListener("click", e => {
    if (e.target.closest("[data-close-drawer]")) closeDrawer();
    if (e.target.closest("[data-notif-confirm]")) { closeDrawer(); openConfirm(); }
  });
  $("#clearNotifs").addEventListener("click", () => { notifs.forEach(n => (n.read = true)); store.set("notifs", notifs); renderNotifs(); });
  $("#enablePush").addEventListener("click", async () => {
    if (!("Notification" in window)) return toast(tr("notif.unsupported"), "error");
    const p = await Notification.requestPermission();
    toast(p === "granted" ? tr("notif.enabled") : tr("notif.denied"), p === "granted" ? "ok" : "error");
  });

  // ---------- Device check (for testing on a real phone) ----------
  // Tests the pieces a real deployment depends on: camera, GPS, alerts, speed.
  const dc = {};
  function openDeviceCheck() {
    const row = (id, icon) => `
      <li class="rounded-2xl ring-1 ring-slate-200 p-3" id="dc-${id}">
        <div class="flex items-center gap-3">
          <span class="grid place-items-center w-9 h-9 rounded-xl bg-brand-50 text-brand-700 shrink-0"><i data-lucide="${icon}" class="w-5 h-5"></i></span>
          <div class="flex-1 min-w-0"><p class="font-bold text-sm">${tr("device." + id)}</p><p class="text-xs text-slate-500" data-out>${esc(dc[id]?.text || tr("device.notRun"))}</p></div>
          ${id !== "secure" ? `<button data-dc="${id}" class="btn-outline !h-8 !px-3 text-xs">${tr("device.test")}</button>` : ""}
        </div>
        <div data-extra></div>
      </li>`;
    openModal(`
      <div class="p-5 max-h-[92vh] overflow-y-auto">
        <h2 class="font-display font-800 text-xl text-brand-800">${tr("device.title")}</h2>
        <p class="text-sm text-slate-500">${tr("device.intro")}</p>
        <ul class="mt-4 space-y-2">${row("secure", "lock")}${row("camera", "camera")}${row("gps", "locate")}${row("notify", "bell")}${row("speed", "gauge")}</ul>
        <div class="mt-4 grid grid-cols-2 gap-3">
          <button data-dc="copy" class="h-11 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50">${tr("device.copy")}</button>
          <button data-close-modal class="h-11 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold">${tr("common.close")}</button>
        </div>
      </div>`, true);
    modalOnClose = () => stopStream();
    const secureOk = window.isSecureContext;
    setDc("secure", secureOk ? "ok" : "warn", tr(secureOk ? "device.secureOk" : "device.secureNo", { origin: location.origin }) + " · " + tr(navigator.onLine ? "device.online" : "device.offline"));
    $("#modalBody").onclick = e => { const b = e.target.closest("[data-dc]"); if (b) runDc(b.dataset.dc); };
  }
  function setDc(id, state, text) {
    dc[id] = { state, text };
    const el = $("#dc-" + id);
    if (!el) return;
    $("[data-out]", el).textContent = text;
    $("[data-out]", el).className = "text-xs " + (state === "ok" ? "text-brand-700 font-semibold" : state === "fail" ? "text-red-600 font-semibold" : state === "warn" ? "text-amber-700 font-semibold" : "text-slate-500");
  }
  async function runDc(id) {
    if (id === "copy") {
      const lines = ["SB WasteTrack device check", new Date().toString(), navigator.userAgent, ...["secure", "camera", "gps", "notify", "speed"].map(k => `${k}: ${dc[k]?.state || "not run"} — ${dc[k]?.text || ""}`)].join("\n");
      try { await navigator.clipboard.writeText(lines); toast(tr("device.copied")); }
      catch { prompt(tr("device.copyManual"), lines); }
      return;
    }
    setDc(id, "run", tr("device.running"));
    if (id === "camera") {
      if (!navigator.mediaDevices?.getUserMedia) return setDc(id, "fail", tr("device.camNone"));
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        stopStream(); activeStream = stream;
        const s = stream.getVideoTracks()[0].getSettings();
        const extra = $("#dc-camera [data-extra]");
        extra.innerHTML = `<video autoplay playsinline muted class="mt-2 w-full max-h-48 rounded-xl bg-black object-cover"></video>`;
        $("video", extra).srcObject = stream;
        setDc(id, "ok", tr("device.camOk", { w: s.width || "?", h: s.height || "?", facing: s.facingMode || "—" }));
        setTimeout(() => { if (activeStream === stream) { stopStream(); extra.innerHTML = ""; } }, 6000);
      } catch (err) { setDc(id, "fail", tr("device.camFail", { err: err.name || err.message })); }
    }
    if (id === "gps") {
      if (!navigator.geolocation) return setDc(id, "fail", tr("device.gpsNone"));
      const t0 = performance.now();
      navigator.geolocation.getCurrentPosition(
        p => {
          const secs = ((performance.now() - t0) / 1000).toFixed(1), acc = Math.round(p.coords.accuracy);
          const far = haversine([p.coords.latitude, p.coords.longitude], MAP_CENTER);
          setDc(id, acc <= 30 ? "ok" : "warn", tr("device.gpsOk", { acc, secs, pos: ll([p.coords.latitude, p.coords.longitude]), dist: fmtDist(far) }));
        },
        err => setDc(id, "fail", tr("device.gpsFail", { err: err.message || err.code })),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
    }
    if (id === "notify") {
      if (!("Notification" in window)) return setDc(id, "fail", tr("notif.unsupported"));
      const p = await Notification.requestPermission();
      if (p !== "granted") return setDc(id, "fail", tr("device.notifyDenied", { p }));
      try { new Notification("SB WasteTrack", { body: tr("device.notifyBody"), icon: "assets/img/favicon.png" }); setDc(id, "ok", tr("device.notifyOk")); }
      catch { setDc(id, "warn", tr("device.notifySw")); }
    }
    if (id === "speed") {
      const nav = performance.getEntriesByType("navigation")[0];
      const load = nav ? Math.round(nav.loadEventEnd || nav.domComplete) : 0;
      const bytes = (nav?.transferSize || 0) + performance.getEntriesByType("resource").reduce((s, r) => s + (r.transferSize || 0), 0);
      let frames = 0;
      const start = performance.now();
      // frame rate over 2 s (browsers pause frames in a background tab, hence the time limit)
      await new Promise(res => { const f = () => { frames++; performance.now() - start < 2000 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); setTimeout(res, 2600); });
      const fps = document.hidden || frames < 2 ? "?" : Math.round(frames / ((performance.now() - start) / 1000));
      const mem = navigator.deviceMemory ? navigator.deviceMemory + " GB" : "?";
      const net = navigator.connection?.effectiveType || "?";
      const state = fps === "?" ? "warn" : fps >= 45 && load < 4000 ? "ok" : fps >= 25 ? "warn" : "fail";
      setDc(id, state, tr("device.speedOk", { load: (load / 1000).toFixed(1), kb: Math.round(bytes / 1024), fps, cores: navigator.hardwareConcurrency || "?", mem, net }));
    }
  }

  // ---------- Toasts ----------
  function toast(msg, kind = "ok") {
    const el = document.createElement("div");
    el.className = "toast rounded-xl px-4 py-2.5 text-sm font-semibold shadow-lg text-white " + (kind === "error" ? "bg-red-600" : "bg-brand-900");
    el.textContent = msg;
    $("#toasts").appendChild(el);
    setTimeout(() => { el.style.transition = "opacity .3s"; el.style.opacity = "0"; setTimeout(() => el.remove(), 300); }, 3200);
  }

  // ---------- Language ----------
  function setLang(next) {
    if (next === LANG) return;
    localStorage.setItem("sb.lang", JSON.stringify(next));
    sessionStorage.setItem("sb.scroll", String(window.scrollY));
    location.reload();
  }
  $$("#langSwitch [data-lang]").forEach(b => { const on = b.dataset.lang === LANG; b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", String(on)); });

  // ---------- Clock ----------
  function tickClock() {
    const d = new Date();
    $("#clock").textContent = `${fmtDate(d)} · ${d.toLocaleTimeString(LOCALE, { hour: "numeric", minute: "2-digit", second: "2-digit" })}`;
    if (dateKey(d) !== day.key) location.reload();   // new day → archive and start fresh
  }
  setInterval(tickClock, 1000);

  // ---------- Init ----------
  applyI18n();
  $("#photoPlaceholder").innerHTML = photoPlaceholderHTML();
  $("#year").textContent = new Date().getFullYear();
  $("#statAreas").textContent = AREAS.length;
  $("#statTrucks").textContent = TRUCKS.length;
  if (!notifs.length) {
    notifs = [{ id: uid(), icon: "calendar-check", color: "green", key: "n.welcome", vars: {}, at: Date.now(), read: false }];
    store.set("notifs", notifs);
  }
  tickClock();
  setMyArea(myAreaId);
  drawReports();
  renderReports();
  renderFleet();
  renderAvg();
  renderNotifs();
  setRole(role);
  connectLive();
  // live badges show "x s ago" — refresh them a few times a minute
  setInterval(() => { if (LIVE.url) { dirty = true; refreshLiveSettings(); } }, 5000);
  fitRoutes();
  window.addEventListener("load", fitRoutes);   // again once fonts/images have settled the layout
  const savedScroll = sessionStorage.getItem("sb.scroll");
  if (savedScroll !== null) { sessionStorage.removeItem("sb.scroll"); requestAnimationFrame(() => window.scrollTo(0, +savedScroll)); }
  icons();
})();
