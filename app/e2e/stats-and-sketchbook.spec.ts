import { expect, test } from '@playwright/test';

test.describe('Stats view', () => {
  test('renders all three D3 charts and the recent-sessions log', async ({ page }) => {
    await page.goto('/');
    await page.locator('.side .nav a', { hasText: 'Stats' }).click();

    await page.waitForSelector('.year-heatmap rect', { timeout: 10_000 });
    await page.waitForSelector('.week-stacked svg', { timeout: 10_000 });

    // Year heatmap: 53 weeks × 7 days, plus a few filled cells (deterministic mock).
    const heatRects = await page.locator('.year-heatmap rect').count();
    expect(heatRects).toBe(53 * 7);
    const filledHeat = await page
      .locator('.year-heatmap rect')
      .evaluateAll((els) =>
        els.filter((e) => {
          const f = e.getAttribute('fill');
          return f !== null && f !== 'transparent';
        }).length,
      );
    expect(filledHeat).toBeGreaterThan(300);

    // Time-by-piece bars (HTML), Week stacked chart (SVG), Recent sessions list.
    expect(await page.locator('.bars .row').count()).toBe(7);
    expect(await page.locator('.week-stacked .seg').count()).toBeGreaterThan(10);
    expect(await page.locator('.recent-row').count()).toBe(8);

    // Today's column is highlighted.
    await expect(page.locator('.week-stacked .day.today .day-date')).toHaveText('29');
  });
});

test.describe('Sketchbook view', () => {
  test('switches tabs and renders the Verovio harmony engraving', async ({ page }) => {
    await page.goto('/');
    await page.locator('.side .nav a', { hasText: 'Sketchbook' }).click();
    await page.waitForSelector('.sketch-grid');

    // Lyric tab is the default; it parses [section] markers.
    expect(await page.locator('.lyric-block .marker').count()).toBeGreaterThan(2);

    // Harmony tab → 5 chord symbols + a Verovio-engraved staff.
    await page.locator('.sketch-detail .tabs button', { hasText: 'Harmony' }).click();
    await expect(page.locator('.chord-row .chord')).toHaveCount(5);
    await page.waitForSelector('.harmony-score svg', { timeout: 30_000 });
    expect(await page.locator('.harmony-score svg g.note, .harmony-score svg g.chord').count())
      .toBeGreaterThan(0);

    // Switch sketches → "Blue Light" has no harmony, so we get the empty state.
    await page.locator('.sketch-list .sketch-item').nth(1).click();
    await expect(page.locator('.sketch-detail .tabs button.active')).toHaveText(/Lyric/);
    await page.locator('.sketch-detail .tabs button', { hasText: 'Harmony' }).click();
    await expect(page.locator('.harmony-empty')).toBeVisible();
  });
});
