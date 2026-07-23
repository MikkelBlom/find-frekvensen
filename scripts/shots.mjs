// Screenshot harness (spec §7.1). Drives the app in simulator mode into each
// key UI state and saves PNGs to /screenshots, at 1080p and (for a subset) 4K.
//
// Requires a running server: start `npm run dev` (or `npm run start` after a
// build) first, or set BASE_URL. Then: `npm run shots`.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = path.resolve("screenshots");

const VIEWPORTS = {
  hd: { w: 1920, h: 1080, suffix: "" },
  uhd: { w: 3840, h: 2160, suffix: "@4k" },
};

const sleep = (page, ms) => page.waitForTimeout(ms);

async function boot(page) {
  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__frekvens, { timeout: 10000 });
  await page.evaluate(() => window.__frekvens.showDebug(false));
}

// theme/fields/devices setup shared by scenarios
async function setup(page, o) {
  await page.evaluate((opts) => {
    const f = window.__frekvens;
    f.setThemeMode(opts.themeMode || "light");
    if (opts.theme) f.setTheme(opts.theme);
    if (opts.messageMode) f.setMessageMode(opts.messageMode);
    if (opts.picture) f.setPicture(opts.picture);
    if (typeof opts.fields === "number") f.setFields(opts.fields);
    if (typeof opts.devices === "number") f.addDevices(opts.devices, opts.mode || "sweep");
  }, o);
}

async function waitAssigned(page, n) {
  await page
    .waitForFunction(
      (count) => window.__frekvens.store.get().snapshots.filter((x) => x.serial).length >= count,
      n,
      { timeout: 8000 },
    )
    .catch(() => {});
}

// Put every active field on a ladder rung (0=green,1=yellow,2=red).
async function setLevel(page, level) {
  await page.evaluate((l) => window.__frekvens.setAllLevel(l), level);
}

const scenarios = [
  {
    name: "a-waiting",
    fourK: true,
    async run(page) {
      await setup(page, { theme: "animals", fields: 6 });
      await sleep(page, 400);
    },
  },
  {
    name: "b-noise",
    async run(page) {
      await setup(page, { theme: "numbers", fields: 6, devices: 6, mode: "idle" });
      await waitAssigned(page, 6);
      await setLevel(page, 0); // green has no decoys → genuinely cold at the edge
      await sleep(page, 250);
      await page.evaluate(() => {
        for (let i = 0; i < 6; i++) window.__frekvens.setPos(i, 8);
      });
      await sleep(page, 450);
    },
  },
  {
    name: "c-warmth",
    fourK: true,
    async run(page) {
      await setup(page, { theme: "space", fields: 6, devices: 6, mode: "solve" });
      await waitAssigned(page, 6);
      await setLevel(page, 1);
      await sleep(page, 400);
      await page.evaluate(() => {
        for (let i = 0; i < 6; i++) window.__frekvens.warmField(i, 62);
      });
      await sleep(page, 450);
    },
  },
  {
    name: "d-lock",
    async run(page) {
      await setup(page, { theme: "numbers", fields: 6, devices: 6, mode: "solve" });
      await waitAssigned(page, 6);
      await setLevel(page, 0);
      await sleep(page, 400);
      await page.evaluate(() => {
        for (let i = 0; i < 6; i++) window.__frekvens.lockOn(i);
      });
      await sleep(page, 340);
    },
  },
  {
    name: "e-reveal-progress",
    async run(page) {
      await setup(page, { theme: "animals", fields: 6, devices: 6, mode: "manual" });
      await waitAssigned(page, 6);
      await setLevel(page, 1);
      await sleep(page, 250);
      await page.evaluate(() => {
        [0, 1, 2, 3, 1, 2].forEach((k, i) => window.__frekvens.revealCount(i, k));
      });
      await sleep(page, 500);
    },
  },
  {
    name: "f-complete",
    fourK: true,
    async run(page) {
      await setup(page, { theme: "animals", fields: 6, devices: 6, mode: "manual" });
      await waitAssigned(page, 6);
      await setLevel(page, 0);
      await sleep(page, 250);
      await page.evaluate(() => {
        for (let i = 0; i < 6; i++) window.__frekvens.revealAllStations(i);
      });
      await sleep(page, 550);
    },
  },
  {
    name: "g-layout-4",
    async run(page) {
      await setup(page, { theme: "space", fields: 4, devices: 4, mode: "solve" });
      await waitAssigned(page, 4);
      await setLevel(page, 0);
      await sleep(page, 700);
      await page.evaluate(() => {
        for (let i = 0; i < 4; i++) window.__frekvens.warmField(i, 55);
      });
      await sleep(page, 400);
    },
  },
  {
    name: "h-layout-8",
    fourK: true,
    async run(page) {
      await setup(page, { theme: "numbers", fields: 8, devices: 8, mode: "manual" });
      await waitAssigned(page, 8);
      await setLevel(page, 1);
      await sleep(page, 250);
      await page.evaluate(() => {
        [3, 1, 4, 0, 2, 4, 1, 3].forEach((k, i) => window.__frekvens.revealCount(i, k));
      });
      await sleep(page, 500);
    },
  },
  {
    name: "i-image-complete",
    async run(page) {
      await setup(page, {
        theme: "pioneers",
        messageMode: "image",
        picture: "satellite",
        fields: 6,
        devices: 6,
        mode: "manual",
      });
      await waitAssigned(page, 6);
      await setLevel(page, 1);
      await sleep(page, 250);
      await page.evaluate(() => {
        for (let i = 0; i < 6; i++) window.__frekvens.revealAllStations(i);
      });
      await sleep(page, 550);
    },
  },
  {
    name: "j-red-hop",
    async run(page) {
      await setup(page, { theme: "space", fields: 6, devices: 6, mode: "solve" });
      await waitAssigned(page, 6);
      await setLevel(page, 2);
      await sleep(page, 900);
    },
  },
  {
    name: "k-debug-open",
    async run(page) {
      await setup(page, { theme: "numbers", fields: 6, devices: 6, mode: "sweep" });
      await waitAssigned(page, 6);
      await setLevel(page, 2);
      await page.evaluate(() => window.__frekvens.showDebug(true));
      await sleep(page, 500);
    },
  },
  {
    name: "l-dark-mode",
    fourK: true,
    async run(page) {
      await setup(page, { themeMode: "dark", theme: "animals", fields: 6, devices: 6, mode: "solve" });
      await waitAssigned(page, 6);
      await setLevel(page, 1);
      await sleep(page, 400);
      await page.evaluate(() => {
        for (let i = 0; i < 6; i++) window.__frekvens.warmField(i, 62);
      });
      await sleep(page, 450);
    },
  },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  let count = 0;

  for (const key of Object.keys(VIEWPORTS)) {
    const vp = VIEWPORTS[key];
    const context = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      deviceScaleFactor: 1,
    });
    // Settings now persist to localStorage — clear it on every navigation so
    // each scenario starts from clean defaults (no leakage between scenarios).
    await context.addInitScript(() => {
      try {
        localStorage.clear();
      } catch {
        /* ignore */
      }
    });
    const page = await context.newPage();

    for (const sc of scenarios) {
      if (key === "uhd" && !sc.fourK) continue;
      await boot(page);
      await sc.run(page);
      const file = path.join(OUT, `${sc.name}${vp.suffix}.png`);
      await page.screenshot({ path: file });
      count++;
      console.log(`  ✓ ${path.basename(file)}`);
    }
    await context.close();
  }

  await browser.close();
  console.log(`\nDone — ${count} screenshots in ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
