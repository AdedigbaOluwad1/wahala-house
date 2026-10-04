import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const svg = readFileSync("public/icon.svg", "utf8");
const maskableSvg = svg
  .replace(
    '<rect width="64" height="64" rx="12" fill="#0b5d3b"/>',
    '<rect width="64" height="64" fill="#0b5d3b"/>',
  )
  .replace(/<path/g, '<path transform="translate(8 8) scale(0.75)"');

const targets = [
  ["public/icon-192.png", 192, svg],
  ["public/icon-512.png", 512, svg],
  ["public/icon-maskable-512.png", 512, maskableSvg],
  ["public/apple-touch-icon.png", 180, maskableSvg],
];

const browser = await chromium.launch();
for (const [file, size, source] of targets) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
  });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${source}`,
  );
  writeFileSync(file, await page.screenshot({ omitBackground: true }));
  await page.close();
}
await browser.close();
