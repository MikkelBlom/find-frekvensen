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

async function configure(page, opts) {
  await page.evaluate((o) => {
    const f = window.__frekvens;
    if (o.preset) f.setPreset(o.preset);
    if (o.theme) f.setTheme(o.theme);
    if (o.messageMode) f.setMessageMode(o.messageMode);
    if (o.picture) f.setPicture(o.picture);
    if (typeof o.fields === "number") f.setFields(o.fields);
    if (typeof o.devices === "number") f.addDevices(o.devices, o.mode || "sweep");
  }, opts);
}

async function waitAssigned(page, n) {
  await page
    .waitForFunction(
      (count) => {
        const s = window.__frekvens.store.get();
        return s.snapshots.filter((x) => x.serial).length >= count;
      },
      n,
      { timeout: 8000 },
    )
    .catch(() => {});
}

// ---- Scenarios -------------------------------------------------------------
const scenarios = [
  {
    name: "a-waiting",
    fourK: true,
    async run(page) {
      await configure(page, { preset: "green", theme: "animals", fields: 6 });
      await sleep(page, 400);
    },
  },
  {
    name: "b-noise",
    async run(page) {
      // Green has no decoys and clustered central stations, so a needle at the
      // edge is genuinely cold → clean "no signal" static reference.
      await configure(page, { preset: "green", theme: "numbers", fields: 6, devices: 6, mode: "idle" });
      await waitAssigned(page, 6);
      await page.evaluate(() => {
        const f = window.__frekvens;
        for (let i = 0; i < 6; i++) f.setPos(i, 8);
      });
      await sleep(page, 500);
    },
  },
  {
    name: "c-warmth",
    fourK: true,
    async run(page) {
      await configure(page, { preset: "yellow", theme: "space", fields: 6, devices: 6, mode: "solve" });
      await waitAssigned(page, 6);
      await sleep(page, 400);
      await page.evaluate(() => {
        const f = window.__frekvens;
        for (let i = 0; i < 6; i++) f.warmField(i, 62);
      });
      await sleep(page, 450);
    },
  },
  {
    name: "d-lock",
    async run(page) {
      await configure(page, { preset: "green", theme: "numbers", fields: 6, devices: 6, mode: "solve" });
      await waitAssigned(page, 6);
      await sleep(page, 400);
      await page.evaluate(() => {
        const f = window.__frekvens;
        for (let i = 0; i < 6; i++) f.lockOn(i);
      });
      await sleep(page, 340); // mid lock-ring fill
    },
  },
  {
    name: "e-reveal-progress",
    async run(page) {
      await configure(page, { preset: "yellow", theme: "animals", fields: 6, devices: 6, mode: "manual" });
      await waitAssigned(page, 6);
      await page.evaluate(() => {
        const f = window.__frekvens;
        // Varying progress across fields for a lively board.
        [0, 1, 2, 3, 1, 2].forEach((k, i) => f.revealCount(i, k));
      });
      await sleep(page, 500);
    },
  },
  {
    name: "f-complete",
    fourK: true,
    async run(page) {
      await configure(page, { preset: "green", theme: "animals", fields: 6, devices: 6, mode: "manual" });
      await waitAssigned(page, 6);
      await page.evaluate(() => {
        const f = window.__frekvens;
        for (let i = 0; i < 6; i++) f.revealAllStations(i);
      });
      await sleep(page, 550); // catch confetti mid-air
    },
  },
  {
    name: "g-layout-4",
    async run(page) {
      await configure(page, { preset: "green", theme: "space", fields: 4, devices: 4, mode: "solve" });
      await waitAssigned(page, 4);
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
      await configure(page, { preset: "yellow", theme: "numbers", fields: 8, devices: 8, mode: "manual" });
      await waitAssigned(page, 8);
      await page.evaluate(() => {
        const f = window.__frekvens;
        [3, 1, 4, 0, 2, 4, 1, 3].forEach((k, i) => f.revealCount(i, k));
      });
      await sleep(page, 500);
    },
  },
  {
    name: "i-image-complete",
    async run(page) {
      await configure(page, {
        preset: "yellow",
        theme: "pioneers",
        messageMode: "image",
        picture: "satellite",
        fields: 6,
        devices: 6,
        mode: "manual",
      });
      await waitAssigned(page, 6);
      await page.evaluate(() => {
        const f = window.__frekvens;
        for (let i = 0; i < 6; i++) f.revealAllStations(i);
      });
      await sleep(page, 550);
    },
  },
  {
    name: "j-red-hop",
    async run(page) {
      await configure(page, { preset: "red", theme: "space", fields: 6, devices: 6, mode: "solve" });
      await waitAssigned(page, 6);
      await sleep(page, 900);
    },
  },
  {
    name: "k-debug-open",
    async run(page) {
      await configure(page, { preset: "red", theme: "numbers", fields: 6, devices: 6, mode: "sweep" });
      await waitAssigned(page, 6);
      await page.evaluate(() => window.__frekvens.showDebug(true));
      await sleep(page, 500);
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
