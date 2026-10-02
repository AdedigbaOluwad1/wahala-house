import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start' }).click();
});

test('budget dialog adjusts a share and keeps the total at 100%', async ({ page }) => {
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/budget$/i).first()).toBeVisible();
  await dialog.getByRole('tab', { name: 'Sectors' }).click();
  const first = dialog.getByRole('slider').first();
  await first.focus();
  for (let i = 0; i < 10; i++) await first.press('ArrowRight');
  const shares = await dialog.locator('div.tabular-nums.text-lg').allTextContents();
  const total = shares.reduce((a, t) => a + parseInt(t, 10), 0);
  expect(Math.abs(total - 100)).toBeLessThanOrEqual(7);
  await dialog.getByRole('button', { name: 'Confirm budget' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('can enact a free policy from the menu', async ({ page }) => {
  await page.getByRole('button', { name: 'Keep last budget' }).click();
  await page.getByRole('button', { name: /^Policies/ }).click();
  await page.getByRole('button', { name: /Civil service pay rise/ }).click();
  await expect(page.getByText('What your advisers say')).toBeVisible();
  await page.getByRole('button', { name: 'Enact policy' }).click();
  await expect(page.getByText('Civil service pay rise is now law.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /^Policies/ })).toContainText('1');
});

test('a policy needing the Assembly shows vote odds', async ({ page }) => {
  await page.getByRole('button', { name: 'Keep last budget' }).click();
  await page.getByRole('button', { name: /^Policies/ }).click();
  await page.getByRole('button', { name: /Anti-corruption drive/ }).click();
  await expect(page.getByText(/% chance to pass/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Put it to a vote' })).toBeVisible();
});
