import { expect, test } from '@playwright/test';

test.describe('Technique view', () => {
  test('engraves all 12 major scales and the daily routine', async ({ page }) => {
    await page.goto('/');
    await page.locator('.side .nav a', { hasText: 'Technique' }).click();

    await expect(page.locator('.scale-card')).toHaveCount(12);

    // Every card's Verovio engraving lands.
    await page.waitForSelector('.scale-card .engraving svg', { timeout: 30_000 });
    const cardsWithSvg = await page
      .locator('.scale-card')
      .evaluateAll((els) => els.filter((el) => !!el.querySelector('.engraving svg')).length);
    expect(cardsWithSvg).toBe(12);

    // Daily routine rail has entries.
    expect(await page.locator('.routine-item').count()).toBeGreaterThanOrEqual(3);

    // Minor / Arpeggios tabs aren't ready yet.
    await expect(page.getByRole('button', { name: /Minor scales/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: /Arpeggios/i })).toBeDisabled();
  });
});
