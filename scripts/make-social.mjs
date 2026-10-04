import { Buffer } from "node:buffer";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const require = createRequire(import.meta.url);
const nigeria = require("@svg-maps/nigeria");
const map = nigeria.default ?? nigeria;
const font = readFileSync(
  "node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2",
).toString("base64");
const icon = readFileSync("public/icon.svg", "utf8");

const states = map.locations.map((l) => `<path d="${l.path}"/>`).join("");

const card = `<!doctype html><html><head><style>
@font-face{font-family:Geist;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#06402a;font-family:Geist,sans-serif;color:#f4faf6;position:relative;overflow:hidden}
.glow{position:absolute;right:-120px;top:-60px;width:760px;height:760px;border-radius:50%;background:radial-gradient(circle,#0f7a4d 0%,#06402a 70%)}
.map{position:absolute;right:50px;top:110px;width:470px;height:420px}
.map svg{width:100%;height:100%;fill:#0b5d3b;stroke:#f5c542;stroke-width:1.2;stroke-linejoin:round}
.brand{position:absolute;left:80px;top:80px;display:flex;align-items:center;gap:20px;font-size:40px;font-weight:700;letter-spacing:-0.02em}
.brand svg{width:64px;height:64px}
h1{position:absolute;left:80px;top:280px;font-size:62px;line-height:1.02;font-weight:800;letter-spacing:-0.035em}
h1 span{color:#f5c542}
.sub{position:absolute;left:80px;top:430px;font-size:28px;color:#b9d6c5;line-height:1.35;width:560px}
.foot{position:absolute;left:80px;bottom:56px;font-size:22px;color:#8fb8a1}
</style></head><body>
<div class="glow"></div>
<div class="map"><svg viewBox="${map.viewBox}">${states}</svg></div>
<div class="brand">${icon}<span>Wahala House</span></div>
<h1>Run the country.<br><span>Feel the trade-offs.</span></h1>
<p class="sub">A satirical governance sandbox for the 36 states and the FCT.</p>
<p class="foot">Free. Plays in your browser. Works offline.</p>
</body></html>`;

const browser = await chromium.launch();

const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await og.setContent(card);
await og.waitForFunction("document.fonts.status === 'loaded'");
writeFileSync("public/og.png", await og.screenshot());

const icoSizes = [16, 32, 48];
const pngs = [];
for (const size of icoSizes) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
  });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${icon}`,
  );
  pngs.push(await page.screenshot({ omitBackground: true }));
  await page.close();
}
await browser.close();

const header = Buffer.alloc(6);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(pngs.length, 4);
let offset = 6 + 16 * pngs.length;
const entries = pngs.map((png, i) => {
  const e = Buffer.alloc(16);
  const size = icoSizes[i];
  e.writeUInt8(size, 0);
  e.writeUInt8(size, 1);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(png.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += png.length;
  return e;
});
writeFileSync(
  "public/favicon.ico",
  Buffer.concat([header, ...entries, ...pngs]),
);
