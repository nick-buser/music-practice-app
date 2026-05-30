import { expect, test } from '@playwright/test';

test.describe('Technique view', () => {
  test('engraves all 12 major scales and the daily routine', async ({ page }) => {
    await page.goto('/');
    await page.locator('.side .nav a', { hasText: 'Technique' }).click();

    await expect(page.locator('.scale-card')).toHaveCount(12);

    await page.waitForSelector('.scale-card .engraving svg', { timeout: 30_000 });
    const cardsWithSvg = await page
      .locator('.scale-card')
      .evaluateAll((els) => els.filter((el) => !!el.querySelector('.engraving svg')).length);
    expect(cardsWithSvg).toBe(12);

    expect(await page.locator('.routine-item').count()).toBeGreaterThanOrEqual(3);
  });

  test('Minor scales tab shows 12 cards with a Natural / Harmonic / Melodic sub-toggle', async ({ page }) => {
    await page.goto('/');
    await page.locator('.side .nav a', { hasText: 'Technique' }).click();
    await page.getByRole('button', { name: /^Minor scales$/i }).click();
    await page.waitForSelector('.scale-card .engraving svg', { timeout: 30_000 });

    await expect(page.locator('.scale-card')).toHaveCount(12);
    await expect(page.getByRole('button', { name: /Natural minor/i })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: /Harmonic minor/i }).click();
    await expect(page.getByRole('button', { name: /Harmonic minor/i })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.scale-card')).toHaveCount(12);
  });

  test('Arpeggios tab swaps 12 major arpeggios for 12 minor arpeggios', async ({ page }) => {
    await page.goto('/');
    await page.locator('.side .nav a', { hasText: 'Technique' }).click();
    await page.getByRole('button', { name: /^Arpeggios$/i }).click();
    await page.waitForSelector('.scale-card .engraving svg', { timeout: 30_000 });

    await expect(page.locator('.scale-card')).toHaveCount(12);
    await expect(page.getByRole('button', { name: /Major arpeggios/i })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: /Minor arpeggios/i }).click();
    await expect(page.getByRole('button', { name: /Minor arpeggios/i })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.scale-card')).toHaveCount(12);
  });
});

test.describe('Scale-aware session', () => {
  test('Run it on a scale card opens a session keyed to that scale', async ({ page }) => {
    await page.goto('/');
    await page.locator('.side .nav a', { hasText: 'Technique' }).click();
    await page.waitForSelector('.scale-card');

    // First card is C major. "Run it →" → session.
    await page.locator('.scale-card').first().getByRole('button', { name: /Run it/i }).click();

    await page.waitForSelector('.session-score svg', { timeout: 30_000 });
    // Session header shows scale-flavoured copy and the scale name.
    await expect(page.locator('.session-piece h2')).toContainText('C major');
    await expect(page.locator('.session-piece h2 em')).toContainText('major scale');
    // Scale subjects don't have an "open full score" link.
    await expect(page.locator('.session-score-block .open-full')).toHaveCount(0);
    // 4/4 → 4 metronome pips.
    await expect(page.locator('.metro .pip')).toHaveCount(4);
    // End-warmup button is labelled "End warmup" for scale subjects.
    await expect(page.getByRole('button', { name: /End warmup/i })).toBeVisible();
  });

  test('End warmup returns to the Technique view, not the Library', async ({ page }) => {
    await page.goto('/');
    await page.locator('.side .nav a', { hasText: 'Technique' }).click();
    await page.waitForSelector('.scale-card');
    await page.locator('.scale-card').first().getByRole('button', { name: /Run it/i }).click();
    await page.waitForSelector('.session-score svg', { timeout: 30_000 });

    await page.getByRole('button', { name: /End warmup/i }).click();
    await expect(page.locator('.scale-card').first()).toBeVisible();
  });
});
