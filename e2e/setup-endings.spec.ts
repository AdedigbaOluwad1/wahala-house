import { expect, test } from '@playwright/test';

interface Hook {
  engine: Record<string, (...args: never[]) => unknown>;
  store: { getState(): { game: { status: unknown } }; setState(f: (s: { rev: number }) => { rev: number }): void };
}

test('the setup screen configures a survival game with a seed', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'New game' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Term length' })).toBeVisible();
  await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Survival' }).click();
  await expect(page.getByRole('group', { name: 'Term length' })).toHaveCount(0);
  await page.getByRole('group', { name: 'Difficulty' }).getByRole('button', { name: 'Brutal' }).click();
  await page.getByLabel('Seed (optional)').fill('abc');
  await page.getByRole('button', { name: 'Start your term' }).click();
  await expect(page.getByRole('dialog').getByText(/budget$/i).first()).toBeVisible();
});

test('being removed leads to the legacy report with a score and a share card', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Start your term' }).click();
  await page.getByRole('button', { name: 'Keep last budget' }).click();
  await page.evaluate(() => {
    const { store } = (window as unknown as { __wahala: Hook }).__wahala;
    const g = store.getState().game as { status: unknown; tick: number };
    g.status = { kind: 'removed', reason: 'coup', tick: g.tick };
    store.setState((s) => ({ rev: s.rev + 1 }));
  });
  await expect(page.getByRole('heading', { name: 'Removed in a coup' })).toBeVisible();
  await expect(page.getByText('How the country changed')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download image' }).click();
  expect((await download).suggestedFilename()).toBe('wahala-house.png');
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.getByRole('heading', { name: 'New game' })).toBeVisible();
});

test('reaching the end of a term runs an election and shows the result', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Start your term' }).click();
  await page.getByRole('button', { name: 'Keep last budget' }).click();
  await page.evaluate(() => {
    const { store } = (window as unknown as { __wahala: Hook }).__wahala;
    const g = store.getState().game as { tick: number; termEndTick: number; states: { mood: number; governorLoyalty: number }[]; national: Record<string, number> };
    for (const s of g.states) { s.mood = 80; s.governorLoyalty = 80; }
    Object.assign(g.national, { approval: 80, stability: 80, opposition: 20 });
    g.tick = g.termEndTick - 1;
    store.getState().advance();
  });
  const dialog = page.getByRole('dialog').filter({ hasText: 'Election day' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/You (missed the spread in the first round, but )?won the (election|runoff)\./)).toBeVisible();
  await dialog.getByRole('button', { name: 'Begin term 2' }).click();
  await expect(page.getByText('Election day')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toBeVisible();
});
