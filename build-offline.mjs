// Builds WasteTrack-offline.html: a single file with every CSS, JS, font
// and image inlined, so it opens without internet.
// Usage: node build-offline.mjs   (needs internet once, to download libraries)
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const get = async (url, type = "text") => {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return type === "buffer" ? Buffer.from(await res.arrayBuffer()) : res.text();
};
const safeScript = s => s.replace(/<\/script/gi, "<\\/script");

// 1. Compile Tailwind (only the classes the site uses)
const tmp = await mkdtemp(join(tmpdir(), "wastetrack-"));
await writeFile(join(tmp, "in.css"), "@tailwind base;@tailwind components;@tailwind utilities;");
execSync(`npx -y tailwindcss@3 -c tailwind.config.cjs -i "${join(tmp, "in.css")}" -o "${join(tmp, "tw.css")}" --minify`, { stdio: "inherit" });
const tailwindCss = await readFile(join(tmp, "tw.css"), "utf8");

// 2. Fonts (latin subset only), embedded as base64
const fontCss = await get("https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap");
const faces = fontCss.split("/*").filter(b => b.startsWith(" latin */")).map(b => "/*" + b);
let fontsInline = "";
for (const face of faces) {
  const url = face.match(/url\((https:[^)]+)\)/)[1];
  const b64 = (await get(url, "buffer")).toString("base64");
  fontsInline += face.replace(url, `data:font/woff2;base64,${b64}`);
}

// 3. Libraries
let leafletCss = await get("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
for (const img of new Set(leafletCss.match(/images\/[\w.-]+\.png/g))) {
  const b64 = (await get("https://unpkg.com/leaflet@1.9.4/dist/" + img, "buffer")).toString("base64");
  leafletCss = leafletCss.replaceAll(img, `data:image/png;base64,${b64}`);
}
const leafletJs = await get("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js");
const lucideJs = await get("https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js");

// 4. Local files
let html = await readFile("index.html", "utf8");
const styles = await readFile("assets/css/styles.css", "utf8");
const i18nJs = await readFile("assets/js/i18n.js", "utf8");
const routesJs = await readFile("assets/js/routes.generated.js", "utf8");
const dataJs = await readFile("assets/js/data.js", "utf8");
const appJs = await readFile("assets/js/app.js", "utf8");
const logo = "data:image/png;base64," + (await readFile("assets/img/brgy-logo.png")).toString("base64");
const favicon = "data:image/png;base64," + (await readFile("assets/img/favicon.png")).toString("base64");
const hero = "data:image/webp;base64," + (await readFile("assets/img/hero-san-bartolome.webp")).toString("base64");

// 5. Stitch together
html = html
  .replace(/\s*<link rel="preconnect"[^>]*>/g, "")
  .replace(/\s*<link href="https:\/\/fonts\.googleapis[^>]*>/, "")
  .replace(/\s*<link rel="stylesheet" href="https:\/\/unpkg[^>]*>/, "")
  .replace(/\s*<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>\s*<script>[\s\S]*?<\/script>/, "")
  .replace(/<link rel="stylesheet" href="assets\/css\/styles\.css" \/>/,
    () => `<style>${fontsInline}\n${leafletCss}\n${tailwindCss}\n${styles}</style>`)
  .replace(/\s*<script src="https:\/\/unpkg\.com\/leaflet[^>]*><\/script>/, "")
  .replace(/\s*<script src="https:\/\/unpkg\.com\/lucide[^>]*><\/script>/, "")
  .replace(/<script src="assets\/js\/i18n\.js"><\/script>\s*<script src="assets\/js\/routes\.generated\.js"><\/script>\s*<script src="assets\/js\/data\.js"><\/script>\s*<script src="assets\/js\/app\.js"><\/script>/,
    () => [leafletJs, lucideJs, i18nJs, routesJs, dataJs, appJs].map(s => `<script>${safeScript(s)}</script>`).join("\n"))
  .replaceAll("assets/img/brgy-logo.png", logo)
  .replaceAll("assets/img/favicon.png", favicon)
  .replaceAll("assets/img/hero-san-bartolome.webp", hero);

// Anything still loaded from outside the file? (Plain links to other sites are fine.)
const leftovers = html.match(/(<(img|script|link)[^>]*(src|href)="(https?:|assets\/)[^"]*")/g);
if (leftovers) console.warn("Warning: some external resources remain:", leftovers);
await writeFile("WasteTrack-offline.html", html);
console.log(`Built WasteTrack-offline.html (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
