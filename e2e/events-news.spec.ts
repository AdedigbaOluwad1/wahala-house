import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Start your term' }).click();
});

test('the budget dialog opens on the advisers briefing', async ({ page }) => {
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Your advisers weigh in. They will not agree.')).toBeVisible();
  await expect(dialog.getByText('Finance Adviser')).toBeVisible();
  await expect(dialog.getByText('Security Adviser')).toBeVisible();
});

test('a severity 3 event forces a decision, then shows in the news in both tones', async ({ page }) => {
  await page.getByRole('button', { name: 'Keep last budget' }).click();
  await page.evaluate(() => {
    interface Hook {
      engine: { fireEvent(g: unknown, ev: unknown, stateId: string): unknown; getEvent(id: string): unknown };
      store: { getState(): { game: unknown }; setState(f: (s: { rev: number }) => { rev: number }): void };
    }
    const { engine, store } = (window as unknown as { __wahala: Hook }).__wahala;
    const g = store.getState().game;
    engine.fireEvent(g, engine.getEvent('insurgent_attack'), 'borno');
    store.setState((s) => ({ rev: s.rev + 1 }));
  });
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Attack in Borno')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog.getByText('Attack in Borno')).toBeVisible();
  await dialog.getByRole('button', { name: /Send reinforcements/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open news log' })).toContainText('Borno');

  await page.getByRole('button', { name: 'Open news log' }).click();
  const sheet = page.getByRole('dialog');
  const before = await sheet.getByRole('listitem').first().innerText();
  await sheet.getByRole('switch').click();
  const after = await sheet.getByRole('listitem').first().innerText();
  expect(after).not.toBe(before);
});
