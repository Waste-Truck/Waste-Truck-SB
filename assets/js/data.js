/* ------------------------------------------------------------------
   Barangay San Bartolome — Garbage Collection data

   Sources (all in this project folder):
   • Collection days  — "Brgy SB Garbage Collection Schedule - Sheet1.pdf"
   • Routes, trucks, streets — the District 5 route sheets photographed in
     "/schedules and area" (transcribed in tools/route-sheets.mjs)
   • Truck paths on the map — assets/js/routes.generated.js, built by
     tools/build-routes.mjs from those route sheets + OpenStreetMap streets

   Driver names and time windows are PLACEHOLDERS — the sheets don't list
   them. Edit them here.
------------------------------------------------------------------- */

// Day index follows JS Date.getDay(): 0 = Sun ... 6 = Sat
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SCHEDULE_GROUPS = [
  { id: "mwf",    label: "MON • WED • FRI", days: [1, 3, 5] },
  { id: "tth",    label: "TUE • THU",       days: [2, 4] },
  { id: "mwsat",  label: "MON • WED • SAT", days: [1, 3, 6] },
  { id: "tthsat", label: "TUE • THU • SAT", days: [2, 4, 6] },
  { id: "monsat", label: "MON – SAT",       days: [1, 2, 3, 4, 5, 6] },
  { id: "tuesat", label: "TUE – SAT",       days: [2, 3, 4, 5, 6] },
  { id: "daily",  label: "EVERYDAY",        days: [0, 1, 2, 3, 4, 5, 6] },
];

// The 8 trucks on the route sheets (Body No. and Type of Unit).
// Their routes and paths come from ROUTE_GEO (routes.generated.js).
const TRUCKS = [
  { id: "208", driver: "Juan Dela Cruz",   color: "#f28c1b", window: "6:00 AM – 10:00 AM" },
  { id: "135", driver: "Pedro Santos",     color: "#0ea5e9", window: "6:00 AM – 10:00 AM" },
  { id: "237", driver: "Jose Mendoza",     color: "#14b8a6", window: "6:00 AM – 10:00 AM" },
  { id: "137", driver: "Antonio Bautista", color: "#8b5cf6", window: "1:00 PM – 5:00 PM" },
  { id: "109", driver: "Ricardo Villanueva", color: "#ec4899", window: "1:00 PM – 5:00 PM" },
  { id: "166", driver: "Mario Reyes",      color: "#4f46e5", window: "1:00 PM – 5:00 PM" },
  { id: "118", driver: "Eduardo Aquino",   color: "#65a30d", window: "1:00 PM – 5:00 PM" },
  { id: "213", driver: "Ramon Garcia",     color: "#e11d48", window: "1:00 PM – 5:00 PM" },
].map(t => ({ ...t, type: ROUTE_GEO.trucks[t.id].type, routes: ROUTE_GEO.trucks[t.id].routes.map(r => r.id).join(" / ") }));

// [ area name, collection days, route no., section on the route sheet ]
// The first block is the barangay schedule PDF; each area is tied to the
// route-sheet section that covers it. `true` marks areas that appear on the
// route sheets but not by name on the schedule PDF.
const AREAS = [
  // MON • WED • FRI
  ["Kathleen Place 4 (all streets)", "mwf", "BC-05-53", "Kathleen Place IV"],
  ["Carreon Village", "mwf", "BC-05-58", "Carreon Village"],
  ["Baluarte", "mwf", "BC-05-58", "Gawad Kalinga/Baluarte"],
  ["San Bartolome de Novaliches Parish", "mwf", "BC-05-58", "San Bartolome de Novaliches Parish"],
  ["RT Residence", "mwf", "BC-05-58", "R.T. Gonzales"],
  ["Greenheights Subdivision", "mwf", "BC-05-58", "Green Heights Subdivision"],
  ["San Pedro Subdivision 7 (all streets)", "mwf", "BC-05-55", "San Pedro VII"],
  ["St. Francis Village (all streets)", "mwf", "BC-05-55", "St. Francis Village"],
  ["Rolling Meadows I (all streets)", "mwf", "BC-05-55", "Rolling Meadows I"],
  ["Sweet Meadows", "mwf", "BC-05-56", "Sweet Meadows"],
  // TUE • THU
  ["Rockville I Subdivision (all streets)", "tth", "BC-05-59", "Rockville I"],
  ["Rockville II Subdivision (all streets)", "tth", "BC-05-59", "Rockville II"],
  ["Rolling Meadow I (all streets)", "tth", "BC-05-55", "Rolling Meadows I"],
  ["Rolling Meadow II (all streets)", "tth", "BC-05-56", "Rolling Meadows II"],
  ["Rolling Meadow III (all streets)", "tth", "BC-05-56", "Rolling Meadows III"],
  ["Green Acres Subdivision (all streets)", "tth", "BC-05-64", "Green Acres Subdivision"],
  ["Maries Village (all streets)", "tth", "BC-05-64", "Maries Subdivision"],
  ["Severino Compound", "tth", "BC-05-64", "Severino Compound"],
  ["Lapuz Compound", "tth", "BC-05-64", "Lapuz Compound"],
  ["Visayas Compound", "tth", "BC-05-64", "Visayas Compound"],
  // MON • WED • SAT
  ["P. Dela Cruz Street to Acme Road", "mwsat", "BC-05-61", "175 P. Dela Cruz / Acme Road"],
  ["Ramos Compound", "mwsat", "BC-05-61", "Ramos Compound"],
  ["De Guzman Compound", "mwsat", "BC-05-61", "De Guzman Compound"],
  ["A. Ramirez Street", "mwsat", "BC-05-61", "A. Ramirez"],
  ["IA - Jan Town Homes", "mwsat", "BC-05-61", "Ianjan Compound"],
  ["P. Dela Cruz to Maries Gate", "mwsat", "BC-05-61", "P. Dela Cruz (Acme Road to Maries Gate)"],
  ["New Jersey Village", "mwsat", "BC-05-61", "Gawad Kalinga/New Jersey"],
  ["Valentin Compound", "mwsat", "BC-05-61", "Valentin Compound"],
  ["Dona Faustina Subdivision (all streets)", "mwsat", "BC-05-63", "Doña Faustina Subdivision"],
  ["California Village", "mwsat", "BC-05-65", "California Village"],
  ["Sambahayang California", "mwsat", "BC-05-65", "Sambahayanang California"],
  ["California Dream Homes", "mwsat", "BC-05-65", "California Dreamhomes"],
  // TUE • THU • SAT
  ["Princess Homes (all streets)", "tthsat", "BC-05-54", "Princess Homes"],
  ["Nomar I Subdivision (all streets)", "tthsat", "BC-05-54", "Nomar Homes I"],
  ["Nomar II Subdivision (all streets)", "tthsat", "BC-05-54", "Nomar Homes II"],
  // MON – SAT
  ["P. Dela Cruz Street to Philips North Subd.", "monsat", "BC-05-60", "P. Dela Cruz (Odelco to North Point Park)"],
  ["Odelco Subdivision (all streets)", "monsat", "BC-05-60", "Odelco Subdivision"],
  ["Odelco Elementary School", "monsat", "BC-05-60", "Odelco Elementary School"],
  ["ACP Homes", "monsat", "BC-05-60", "ACF Subdivision"],
  // TUE – SAT
  ["Atlas Road", "tuesat", "BC-05-62", "Atlas Road"],
  ["Margarita Compound", "tuesat", "BC-05-62", "Margarita Compound"],
  ["Sikatuna Country Homes", "tuesat", "BC-05-62", "Sikatuna Country Homes"],
  ["Bana Compound", "tuesat", "BC-05-62", "Bana Compound"],
  ["Godwill Homes 1 (all streets)", "tuesat", "BC-05-66", "Good Will Homes I"],
  // EVERYDAY (includes San Bartolome Elementary School)
  ["Rainbow Homes I Subdivision (all streets)", "daily", "BC-05-57", "Rainbow Homes I"],
  ["Rainbow Homes II Subdivision (all streets)", "daily", "BC-05-57", "Rainbow Homes II"],
  ["Rainbow Homes III Subdivision (all streets)", "daily", "BC-05-57", "Rainbow Homes II"],
  ["Metrogreen Village (all streets)", "daily", "BC-05-57", "Metro Green Village"],

  // On the route sheets only — given the same days as the rest of their route
  ["Samabako", "tth", "BC-05-56", "Samabako", true],
  ["Pascualers", "tth", "BC-05-56", "Pascualers", true],
  ["Carreon / Aguirre Compound", "mwf", "BC-05-58", "Carreon/Aguirre Compound", true],
  ["SB Residence", "mwf", "BC-05-58", "SB Residence", true],
  ["Banal Compound", "mwf", "BC-05-58", "Banal Compound", true],
  ["P. Dela Cruz Street (Quirino Hi-way to Odelco)", "tth", "BC-05-59", "P. Dela Cruz (Quirino Hi-way to Odelco)", true],
  ["Holy Cross Road", "tth", "BC-05-59", "Holy Cross Road", true],
  ["Philips North Point Park", "monsat", "BC-05-60", "Philips North Point Park", true],
  ["Good Haven", "tuesat", "BC-05-62", "Good Haven", true],
  ["Gawad Kalinga (Doña Faustina)", "mwsat", "BC-05-63", "Gawad Kalinga", true],
  ["California Ville Townhouse", "mwsat", "BC-05-65", "California Ville Townhouse", true],
].map(([name, group, route, section, sheetOnly], i) => ({
  id: "a" + i,
  name, group, route, section,
  sheetOnly: !!sheetOnly,
  truck: Object.keys(ROUTE_GEO.trucks).find(id => ROUTE_GEO.trucks[id].routes.some(r => r.id === route)),
  days: SCHEDULE_GROUPS.find(g => g.id === group).days,
}));

const REPORT_TYPES = [
  { id: "piling",  label: "Garbage piling up",   icon: "trash-2" },
  { id: "missed",  label: "Missed collection",   icon: "calendar-x" },
  { id: "dumping", label: "Illegal dumping",     icon: "alert-octagon" },
  { id: "spill",   label: "Spill / leak on road", icon: "droplets" },
];

// Waste classifications used for photo verification
const WASTE_TYPES = [
  { id: "bio",      label: "Biodegradable", hint: "Nabubulok",           color: "#43ad4c" },
  { id: "recycle",  label: "Recyclable",    hint: "Plastic, paper, metal", color: "#0ea5e9" },
  { id: "residual", label: "Residual",      hint: "Di-nabubulok",        color: "#64748b" },
  { id: "special",  label: "Special / hazardous", hint: "Batteries, bulbs, chemicals", color: "#dc2626" },
  { id: "bulky",    label: "Bulky",         hint: "Furniture, appliances", color: "#a855f7" },
];

// Reasons a driver can give for not serving the remaining areas.
// (The website translates these by id — see REASON_IDS in app.js and i18n.js.)
const UNSERVED_REASONS = [
  "Truck at full capacity",
  "Road blocked / truck cannot pass",
  "Vehicle breakdown",
];

const MAP_CENTER = [14.7065, 121.0330]; // Brgy. San Bartolome, Novaliches, QC
