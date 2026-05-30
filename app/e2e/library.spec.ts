import { expect, test } from '@playwright/test';

test.describe('Library view', () => {
  test('renders all pieces with Verovio thumbnails', async ({ page }) => {
    await page.goto('/');
    // Wait for at least one Verovio thumbnail to engrave — proves the WASM
    // toolkit loaded.
    await page.waitForSelector('.score-thumb svg', { timeout: 30_000 });

    await expect(page.locator('.piece-row')).toHaveCount(7);
    // Each row has a thumbnail (Verovio emits a wrapper svg with a nested page
    // svg per piece — count rows, not raw svgs).
    const thumbsWithSvg = await page
      .locator('.score-thumb')
      .evaluateAll((els) => els.filter((el) => !!el.querySelector('svg')).length);
    expect(thumbsWithSvg).toBe(7);

    // Hero + the three instrument groups (composition pieces live on the
    // sketchbook so the library only shows Piano / Guitar / Voice groups).
    await expect(page.getByRole('heading', { level: 1 })).toContainText('sounding out');
    const groupNames = await page.locator('.lib-group-head .name').allTextContents();
    expect(groupNames).toEqual(['Piano', 'Classical Guitar', 'Voice']);
  });

  test('filter chips narrow the visible groups', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.piece-row');

    const initial = await page.locator('.piece-row').count();
    await page.getByRole('button', { name: 'Voice', exact: true }).click();
    const filtered = await page.locator('.piece-row').count();

    expect(filtered).toBeLessThan(initial);
    await expect(page.locator('.lib-group-head .name')).toHaveText(['Voice']);

    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(page.locator('.piece-row')).toHaveCount(initial);
  });
});
