// Renders the iOS PWA startup images (apple-touch-startup-image) from the
// boot splash styles in index.html, so the image iOS shows before the page
// paints matches the splash's first frame exactly.
//
// Usage: node scripts/generate-ios-splash.mjs
// Prints the <link> tags to paste into index.html when the device list changes.

import { mkdir, readFile } from 'node:fs/promises';
import { webkit } from '@playwright/test';

const OUTPUT_DIR = new URL('../public/splash/', import.meta.url);

// Portrait CSS viewport and pixel ratio of every iPhone screen size.
const DEVICES = [
  { width: 440, height: 956, ratio: 3 }, // 16 Pro Max, 17 Pro Max
  { width: 420, height: 912, ratio: 3 }, // Air
  { width: 402, height: 874, ratio: 3 }, // 16 Pro, 17, 17 Pro
  { width: 430, height: 932, ratio: 3 }, // 14 Pro Max, 15 Plus/Pro Max, 16 Plus
  { width: 393, height: 852, ratio: 3 }, // 14 Pro, 15, 15 Pro, 16
  { width: 428, height: 926, ratio: 3 }, // 12/13 Pro Max, 14 Plus
  { width: 390, height: 844, ratio: 3 }, // 12, 13, 14, 16e
  { width: 375, height: 812, ratio: 3 }, // X, XS, 11 Pro, 12/13 mini
  { width: 414, height: 896, ratio: 3 }, // XS Max, 11 Pro Max
  { width: 414, height: 896, ratio: 2 }, // XR, 11
  { width: 414, height: 736, ratio: 3 }, // 6/7/8 Plus
  { width: 375, height: 667, ratio: 2 }, // 6/7/8, SE 2nd/3rd gen
  { width: 320, height: 568, ratio: 2 }, // SE 1st gen
];

const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const style = indexHtml.match(
  /<style id="boot-splash-style">([\s\S]*?)<\/style>/,
)?.[1];
if (!style) {
  throw new Error('Boot splash styles not found in index.html');
}

const page = `<!doctype html>
<html>
  <head>
    <style>${style}</style>
    <style>
      body { margin: 0; }
      .boot-wordmark { animation: none !important; }
    </style>
  </head>
  <body>
    <div id="initial-splash"><div class="boot-wordmark">BSPLIC&nbsp;2.0</div></div>
  </body>
</html>`;

await mkdir(OUTPUT_DIR, { recursive: true });
const browser = await webkit.launch();
const links = [];

try {
  for (const device of DEVICES) {
    const pixelWidth = device.width * device.ratio;
    const pixelHeight = device.height * device.ratio;
    const fileName = `apple-splash-${pixelWidth}x${pixelHeight}.png`;
    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      deviceScaleFactor: device.ratio,
    });
    const tab = await context.newPage();
    await tab.setContent(page);
    await tab.screenshot({ path: new URL(fileName, OUTPUT_DIR).pathname });
    await context.close();

    links.push(
      `<link rel="apple-touch-startup-image" href="/splash/${fileName}" media="(device-width: ${device.width}px) and (device-height: ${device.height}px) and (-webkit-device-pixel-ratio: ${device.ratio}) and (orientation: portrait)" />`,
    );
  }
} finally {
  await browser.close();
}

console.log(links.join('\n'));
