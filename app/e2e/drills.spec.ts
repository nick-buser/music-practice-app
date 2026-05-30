import { expect, test } from '@playwright/test';

test.describe('Drills view', () => {
  test('engraves all 12 major scales and the daily routine', async ({ page }) => {
    await page.goto('/');
    await page.locator('.side .nav a', { hasText: 'Drills' }).click();

    await expect(page.locator('.scale-card')).toHaveCount(12);

    await page.waitForSelector('.scale-card .engraving svg', { timeout: 30_000 });
    const cardsWithSvg = await page
      .locator('.scale-card')
      .evaluateAll((els) => els.filter((el) => !!el.querySelector('.engraving svg')).length);
    expect(cardsWithSvg).toBe(12);

    expect(await page.locator('.routine-item').count()).toBeGreaterThanOrEqual(5);
  });

  test('Scales tab sub-toggles between Major / Natural / Harmonic / Melodic', async ({ page }) => {
    await page.goto('/');
    await page.locator('.side .nav a', { hasText: 'Drills' }).click();
    await page.waitForSelector('.scale-card .engraving svg', { timeout: 30_000 });

    await expect(page.getByRole('button', { name: /^Major$/i })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: /Harmonic minor/i }).click();
    await expect(page.getByRole('button', { name: /Harmonic minor/i })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.scale-card')).toHaveCount(12);

    await page.getByRole('button', { name: /Melodic minor/i }).click();
    await expect(page.getByRole('button', { name: /Melodic minor/i })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.scale-card')).toHaveCount(12);
  });

  test('Arpeggios tab swaps 12 major arpeggios for 12 minor arpeggios', async ({ page }) => {
    await page.goto('/');
    await page.locator('.side .nav a', { hasText: 'Drills' }).click();
    await page.getByRole('button', { name: /^Arpeggios$/i }).click();
    await page.waitForSelector('.scale-card .engraving svg', { timeout: 30_000 });

    await expect(page.locator('.scale-card')).toHaveCount(12);
    await expect(page.getByRole('button', { name: /Major arpeggios/i })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: /Minor arpeggios/i }).click();
    await expect(page.getByRole('button', { name: /Minor arpeggios/i })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.scale-card')).toHaveCount(12);
  });

  test('Chords tab shows 12 major triads, sub-toggle swaps to minor triads', async ({ page }) => {
    await page.goto('/');
    await page.locator('.side .nav a', { hasText: 'Drills' }).click();
    await page.getByRole('button', { name: /^Chords$/i }).click();
    await page.waitForSelector('.scale-card .engraving svg', { timeout: 30_000 });

    await expect(page.locator('.scale-card')).toHaveCount(12);
    await expect(page.getByRole('button', { name: /Major chords/i })).toHaveAttribute('aria-pressed', 'true');

    // Card subtitle calls it a triad block, not a scale.
    await expect(page.locator('.scale-card').first().locator('.name .s')).toContainText(/major triad/i);

    await page.getByRole('button', { name: /Minor chords/i }).click();
    await expect(page.getByRole('button', { name: /Minor chords/i })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.scale-card')).toHaveCount(12);
    await expect(page.locator('.scale-card').first().locator('.name .s')).toContainText(/minor triad/i);
  });
});

test.describe('Drill-aware session', () => {
  test('Run it on a scale card opens a session keyed to that scale', async ({ page }) => {
    await page.goto('/');
    await page.locator('.side .nav a', { hasText: 'Drills' }).click();
    await page.waitForSelector('.scale-card');

    await page.locator('.scale-card').first().getByRole('button', { name: /Run it/i }).click();

    await page.waitForSelector('.session-score svg', { timeout: 30_000 });
    await expect(page.locator('.session-piece h2')).toContainText('C major');
    await expect(page.locator('.session-piece h2 em')).toContainText('major scale');
    await expect(page.locator('.session-score-block .open-full')).toHaveCount(0);
    await expect(page.locator('.metro .pip')).toHaveCount(4);
    await expect(page.getByRole('button', { name: /End warmup/i })).toBeVisible();
  });

  test('Run it on a chord card opens a session with chord-block engraving', async ({ page }) => {
    await page.goto('/');
    await page.locator('.side .nav a', { hasText: 'Drills' }).click();
    await page.getByRole('button', { name: /^Chords$/i }).click();
    await page.waitForSelector('.scale-card');

    await page.locator('.scale-card').first().getByRole('button', { name: /Run it/i }).click();
    await page.waitForSelector('.session-score svg', { timeout: 30_000 });

    await expect(page.locator('.session-piece h2')).toContainText('C major chord');
    await expect(page.locator('.session-piece h2 em')).toContainText('major chord');
    await expect(page.getByRole('button', { name: /End warmup/i })).toBeVisible();
  });

  test('End warmup returns to the Drills view, not the Library', async ({ page }) => {
    await page.goto('/');
    await page.locator('.side .nav a', { hasText: 'Drills' }).click();
    await page.waitForSelector('.scale-card');
    await page.locator('.scale-card').first().getByRole('button', { name: /Run it/i }).click();
    await page.waitForSelector('.session-score svg', { timeout: 30_000 });

    await page.getByRole('button', { name: /End warmup/i }).click();
    await expect(page.locator('.scale-card').first()).toBeVisible();
  });
});
