import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface Hook {
  engine: { fireEvent(g: unknown, ev: unknown, stateId?: string): unknown; getEvent(id: string): unknown };
  store: { getState(): { game: unknown }; setState(f: (s: { rev: number }) => { rev: number }): void };
}

test.use({ reducedMotion: 'reduce' });

async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  expect(summary, label).toEqual([]);
}

async function startGame(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Start your term' }).click();
}

test('title and setup screens have no accessibility violations', async ({ page }) => {
  await page.goto('/');
  await scan(page, 'title');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await scan(page, 'setup');
});

test('the game screen and its dialogs have no accessibility violations', async ({ page }) => {
  await startGame(page);
  await expect(page.getByRole('dialog')).toBeVisible();
  await scan(page, 'budget briefing');
  await page.getByRole('tab', { name: 'Sectors' }).click();
  await scan(page, 'budget sectors');
  await page.getByRole('button', { name: 'Keep last budget' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await scan(page, 'game map');

  await page.locator('[data-region="kano"]').dispatchEvent('click');
  await scan(page, 'state panel');

  await page.getByRole('button', { name: /^Policies/ }).click();
  await scan(page, 'policy list');
  await page.getByRole('button', { name: /Anti-corruption drive/ }).click();
  await scan(page, 'policy detail');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Open news log' }).click();
  await scan(page, 'news log');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await scan(page, 'menu');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await scan(page, 'settings');
});

test('event dialogs and map markers have no accessibility violations', async ({ page }) => {
  await startGame(page);
  await page.getByRole('button', { name: 'Keep last budget' }).click();
  await page.evaluate(() => {
    const { engine, store } = (window as unknown as { __wahala: Hook }).__wahala;
    const g = store.getState().game;
    engine.fireEvent(g, engine.getEvent('flood_warning'), 'bayelsa');
    store.setState((s) => ({ rev: s.rev + 1 }));
  });
  await scan(page, 'map with marker');
  await page.getByRole('button', { name: /Flood warning/ }).first().click();
  await scan(page, 'event dialog');
});

test('the legacy report has no accessibility violations', async ({ page }) => {
  await startGame(page);
  await page.getByRole('button', { name: 'Keep last budget' }).click();
  await page.evaluate(() => {
    const { store } = (window as unknown as { __wahala: Hook }).__wahala;
    const g = store.getState().game as { status: unknown; tick: number };
    g.status = { kind: 'removed', reason: 'impeachment', tick: g.tick };
    store.setState((s) => ({ rev: s.rev + 1 }));
  });
  await expect(page.getByRole('heading', { name: 'Impeached by the Assembly' })).toBeVisible();
  await scan(page, 'legacy');
});
