import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

interface Hook {
  store: {
    getState(): {
      game: unknown;
      advance(): void;
      saveTo(slot: string): Promise<void>;
    };
  };
}

async function startGame(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "Start your term" }).click();
  await page.getByRole("button", { name: "Keep last budget" }).click();
}

const snapshot = (page: Page) =>
  page.evaluate(() =>
    JSON.stringify(
      (window as unknown as { __wahala: Hook }).__wahala.store.getState().game,
    ),
  );

test("reloading resumes the exact game from the autosave", async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => {
    const { store } = (window as unknown as { __wahala: Hook }).__wahala;
    for (let i = 0; i < 9; i++) store.getState().advance();
  });
  const before = await snapshot(page);
  await page.evaluate(() =>
    (window as unknown as { __wahala: Hook }).__wahala.store
      .getState()
      .saveTo("auto"),
  );
  await page.reload();
  await page.getByRole("button", { name: /^Continue/ }).click();
  await expect(page.locator("[data-region]")).toHaveCount(37);
  await page.waitForFunction(() =>
    Boolean((window as unknown as { __wahala?: unknown }).__wahala),
  );
  expect(await snapshot(page)).toBe(before);
});

test("leaving the page autosaves without a manual save", async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => {
    const { store } = (window as unknown as { __wahala: Hook }).__wahala;
    for (let i = 0; i < 4; i++) store.getState().advance();
  });
  const before = await snapshot(page);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(300);
  await page.reload();
  await page.getByRole("button", { name: /^Continue/ }).click();
  await expect(page.locator("[data-region]")).toHaveCount(37);
  await page.waitForFunction(() =>
    Boolean((window as unknown as { __wahala?: unknown }).__wahala),
  );
  expect(await snapshot(page)).toBe(before);
});

test("manual save slots and save files round-trip", async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => {
    const { store } = (window as unknown as { __wahala: Hook }).__wahala;
    for (let i = 0; i < 5; i++) store.getState().advance();
  });
  const before = await snapshot(page);

  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Save game" }).click();
  await page
    .getByRole("listitem")
    .filter({ hasText: "Slot 1" })
    .getByRole("button", { name: "Save" })
    .click();
  await expect(page.getByText("Saved to Slot 1.")).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export save file" }).click();
  const file = await download.then(async (d) => {
    const path = await d.path();
    return { path, name: d.suggestedFilename() };
  });
  expect(file.name).toMatch(/^wahala-house-save-week-\d+\.json$/);
  const text = readFileSync(file.path!, "utf8");
  expect(JSON.parse(text).format).toBe("wahala-house-save");

  await page.evaluate(() => {
    const { store } = (window as unknown as { __wahala: Hook }).__wahala;
    for (let i = 0; i < 5; i++) store.getState().advance();
  });
  expect(await snapshot(page)).not.toBe(before);

  await page.getByLabel("Import save file").setInputFiles({
    name: "save.json",
    mimeType: "application/json",
    buffer: Buffer.from(text),
  });
  await expect(page.getByText("Save file imported.")).toBeVisible();
  expect(await snapshot(page)).toBe(before);
});

test("a bad save file is rejected with a clear message", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await page.getByLabel("Import save file").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"hello":1}'),
  });
  await expect(
    page.getByText("That file is not a Wahala House save."),
  ).toBeVisible();
});

test("the app works offline after the first load", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Wahala House" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "Start your term" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep last budget" }).click();
  await expect(page.locator("[data-region]")).toHaveCount(37);
  await context.setOffline(false);
});

test("the map and menus can be used with the keyboard alone", async ({
  page,
}) => {
  await startGame(page);
  await page.locator('[data-region="kano"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Kano" })).toBeVisible();
  await page.getByRole("button", { name: /^Policies/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
