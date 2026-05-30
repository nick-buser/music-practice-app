import { expect, test } from '@playwright/test';

test.describe('Piece detail', () => {
  test('engraves the full score and paints a heatmap on every section', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.piece-row');
    await page.locator('.piece-row').first().click();

    // The piece-view's big score finishes engraving.
    await page.waitForSelector('.score-big svg g.measure', { timeout: 30_000 });

    const measures = await page.locator('.score-big svg g.measure').count();
    expect(measures).toBeGreaterThan(10); // Chopin Nocturne extended to 34 bars.

    // The 5 Chopin sections all paint heat rects.
    await expect(page.locator('.cue-row')).toHaveCount(5);
    const heatRectCount = await page.locator('.score-big svg rect.heat-rect').count();
    expect(heatRectCount).toBeGreaterThanOrEqual(34);
  });

  test('clicking a section pins it and shows a selection strip', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.piece-row');
    await page.locator('.piece-row').first().click();
    await page.waitForSelector('.score-big svg g.measure', { timeout: 30_000 });

    // Click the "Cadenza" section (4th row), mm. 25–28.
    await page.locator('.cue-row').nth(3).click();

    // Pinned card updates and a selection overlay paints onto the score.
    await expect(page.locator('.pinned-section-card .title')).toHaveText('Cadenza');
    await expect(page.locator('.sel-strip')).toContainText('mm. 25–28');
    const overlays = await page.locator('.score-big svg .sounding-selection-overlay').count();
    expect(overlays).toBe(4);
  });
});
