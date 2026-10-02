import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start' }).click();
});

test('renders 37 clickable regions and selects one', async ({ page }) => {
  const regions = page.locator('[data-region]');
  await expect(regions).toHaveCount(37);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.locator('[data-region="kano"]').dispatchEvent('click');
  await expect(page.getByRole('heading', { name: 'Kano' })).toBeVisible();
});

test('metric switch recolours the map', async ({ page }) => {
  const region = page.locator('[data-region="borno"]');
  const before = await region.getAttribute('fill');
  await page.getByLabel('Map colours show').selectOption('security');
  await expect.poll(() => region.getAttribute('fill')).not.toBe(before);
});

test('time advances after the quarter prompt', async ({ page }) => {
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('group', { name: 'Game speed' }).getByRole('button', { name: 'Fast' }).click();
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByText(/Week [2-9]/)).toBeVisible({ timeout: 10000 });
});

test('no horizontal scroll', async ({ page }) => {
  await page.getByRole('button', { name: 'Continue' }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
