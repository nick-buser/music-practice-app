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

  test('Chords tab opens to 12 major triads with Triads / 7ths / 9ths category rows', async ({ page }) => {
    await page.goto('/');
    await page.locator('.side .nav a', { hasText: 'Drills' }).click();
    await page.getByRole('button', { name: /^Chords$/i }).click();
    await page.waitForSelector('.scale-card .engraving svg', { timeout: 30_000 });

    await expect(page.locator('.scale-card')).toHaveCount(12);
    await expect(page.getByRole('button', { name: /^Major$/i })).toHaveAttribute('aria-pressed', 'true');

    const catLabels = await page.locator('.chord-type-row .cat-label').allTextContents();
    expect(catLabels).toEqual(['Triads', '7ths', '9ths', '11ths', '13ths', 'Altered']);

    await expect(page.locator('.scale-card').first().locator('.name .s')).toContainText(/major triad/i);
  });

  test('Chords sub-toggle: Maj7 / Dom7 / Min7 each swap to 12 cards', async ({ page }) => {
    await page.goto('/');
    await page.locator('.side .nav a', { hasText: 'Drills' }).click();
    await page.getByRole('button', { name: /^Chords$/i }).click();

    await page.getByRole('button', { name: /^Maj7$/i }).click();
    await expect(page.getByRole('button', { name: /^Maj7$/i })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.scale-card')).toHaveCount(12);
    await expect(page.locator('.scale-card').first().locator('.name .s')).toContainText(/major 7/i);

    await page.getByRole('button', { name: /^Dom7$/i }).click();
    await expect(page.locator('.scale-card')).toHaveCount(12);
    await expect(page.locator('.scale-card').first().locator('.name .s')).toContainText(/dominant 7/i);

    await page.getByRole('button', { name: /^Min7$/i }).click();
    await expect(page.locator('.scale-card')).toHaveCount(12);
    await expect(page.locator('.scale-card').first().locator('.name .s')).toContainText(/minor 7/i);
  });

  test('Chords sub-toggle: Maj9 / Dom9 / Min9 each swap to 12 cards', async ({ page }) => {
    await page.goto('/');
    await page.locator('.side .nav a', { hasText: 'Drills' }).click();
    await page.getByRole('button', { name: /^Chords$/i }).click();

    await page.getByRole('button', { name: /^Maj9$/i }).click();
    await expect(page.getByRole('button', { name: /^Maj9$/i })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.scale-card')).toHaveCount(12);
    await expect(page.locator('.scale-card').first().locator('.name .s')).toContainText(/major 9/i);

    await page.getByRole('button', { name: /^Dom9$/i }).click();
    await expect(page.locator('.scale-card')).toHaveCount(12);
    await expect(page.locator('.scale-card').first().locator('.name .s')).toContainText(/dominant 9/i);

    await page.getByRole('button', { name: /^Min9$/i }).click();
    await expect(page.locator('.scale-card')).toHaveCount(12);
    await expect(page.locator('.scale-card').first().locator('.name .s')).toContainText(/minor 9/i);
  });

  test('Chords sub-toggle: Maj11 / Dom11 / Min11 each swap to 12 cards', async ({ page }) => {
    await page.goto('/');
    await page.locator('.side .nav a', { hasText: 'Drills' }).click();
    await page.getByRole('button', { name: /^Chords$/i }).click();

    await page.getByRole('button', { name: /^Maj11$/i }).click();
    await expect(page.getByRole('button', { name: /^Maj11$/i })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.scale-card')).toHaveCount(12);
    await expect(page.locator('.scale-card').first().locator('.name .s')).toContainText(/major 11/i);

    await page.getByRole('button', { name: /^Dom11$/i }).click();
    await expect(page.locator('.scale-card')).toHaveCount(12);
    await expect(page.locator('.scale-card').first().locator('.name .s')).toContainText(/dominant 11/i);

    await page.getByRole('button', { name: /^Min11$/i }).click();
    await expect(page.locator('.scale-card')).toHaveCount(12);
    await expect(page.locator('.scale-card').first().locator('.name .s')).toContainText(/minor 11/i);
  });

  test('Chords sub-toggle: 7♭5 / 7♯5 / 7♭9 / 7♯9 / 7♯11 / 13♭9 each swap to 12 cards', async ({ page }) => {
    await page.goto('/');
    await page.locator('.side .nav a', { hasText: 'Drills' }).click();
    await page.getByRole('button', { name: /^Chords$/i }).click();

    for (const [label, subtitleMatch] of [
      ['7♭5',  /altered dominant.*♭5/i],
      ['7♯5',  /altered dominant.*♯5/i],
      ['7♭9',  /altered dominant.*♭9/i],
      ['7♯9',  /altered dominant.*♯9/i],
      ['7♯11', /lydian dominant.*♯11/i],
      ['13♭9', /dominant 13 ♭9/i],
    ] as const) {
      await page.getByRole('button', { name: label }).click();
      await expect(page.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.scale-card')).toHaveCount(12);
      await expect(page.locator('.scale-card').first().locator('.name .s')).toContainText(subtitleMatch);
    }
  });

  test('Chords sub-toggle: Maj13 / Dom13 / Min13 each swap to 12 cards', async ({ page }) => {
    await page.goto('/');
    await page.locator('.side .nav a', { hasText: 'Drills' }).click();
    await page.getByRole('button', { name: /^Chords$/i }).click();

    await page.getByRole('button', { name: /^Maj13$/i }).click();
    await expect(page.getByRole('button', { name: /^Maj13$/i })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.scale-card')).toHaveCount(12);
    await expect(page.locator('.scale-card').first().locator('.name .s')).toContainText(/major 13/i);

    await page.getByRole('button', { name: /^Dom13$/i }).click();
    await expect(page.locator('.scale-card')).toHaveCount(12);
    await expect(page.locator('.scale-card').first().locator('.name .s')).toContainText(/dominant 13/i);

    await page.getByRole('button', { name: /^Min13$/i }).click();
    await expect(page.locator('.scale-card')).toHaveCount(12);
    await expect(page.locator('.scale-card').first().locator('.name .s')).toContainText(/minor 13/i);
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

  test('Run it on a Cmaj7 card opens a session with the 7th-chord byline', async ({ page }) => {
    await page.goto('/');
    await page.locator('.side .nav a', { hasText: 'Drills' }).click();
    await page.getByRole('button', { name: /^Chords$/i }).click();
    await page.getByRole('button', { name: /^Maj7$/i }).click();
    await page.waitForSelector('.scale-card');

    await page.locator('.scale-card').first().getByRole('button', { name: /Run it/i }).click();
    await page.waitForSelector('.session-score svg', { timeout: 30_000 });

    await expect(page.locator('.session-piece h2')).toContainText('Cmaj7');
    await expect(page.locator('.session-piece h2 em')).toContainText('major 7 chord');
  });

  test('Run it on a Dm9 card opens a session with the 9th-chord byline', async ({ page }) => {
    await page.goto('/');
    await page.locator('.side .nav a', { hasText: 'Drills' }).click();
    await page.getByRole('button', { name: /^Chords$/i }).click();
    await page.getByRole('button', { name: /^Min9$/i }).click();
    await page.waitForSelector('.scale-card');

    const dm9 = page.locator('.scale-card', { hasText: 'Dm9' });
    await dm9.getByRole('button', { name: /Run it/i }).click();
    await page.waitForSelector('.session-score svg', { timeout: 30_000 });

    await expect(page.locator('.session-piece h2')).toContainText('Dm9');
    await expect(page.locator('.session-piece h2 em')).toContainText('minor 9 chord');
  });

  test('Run it on a Gm11 card opens a session with the 11th-chord byline', async ({ page }) => {
    await page.goto('/');
    await page.locator('.side .nav a', { hasText: 'Drills' }).click();
    await page.getByRole('button', { name: /^Chords$/i }).click();
    await page.getByRole('button', { name: /^Min11$/i }).click();
    await page.waitForSelector('.scale-card');

    const gm11 = page.locator('.scale-card', { hasText: 'Gm11' });
    await gm11.getByRole('button', { name: /Run it/i }).click();
    await page.waitForSelector('.session-score svg', { timeout: 30_000 });

    await expect(page.locator('.session-piece h2')).toContainText('Gm11');
    await expect(page.locator('.session-piece h2 em')).toContainText('minor 11 chord');
  });

  test('Run it on an Fmaj13 card opens a session with the 13th-chord byline', async ({ page }) => {
    await page.goto('/');
    await page.locator('.side .nav a', { hasText: 'Drills' }).click();
    await page.getByRole('button', { name: /^Chords$/i }).click();
    await page.getByRole('button', { name: /^Maj13$/i }).click();
    await page.waitForSelector('.scale-card');

    const fmaj13 = page.locator('.scale-card', { hasText: 'Fmaj13' });
    await fmaj13.getByRole('button', { name: /Run it/i }).click();
    await page.waitForSelector('.session-score svg', { timeout: 30_000 });

    await expect(page.locator('.session-piece h2')).toContainText('Fmaj13');
    await expect(page.locator('.session-piece h2 em')).toContainText('major 13 chord');
  });

  test('Run it on an E7♯9 card opens a session with the altered-dominant byline', async ({ page }) => {
    await page.goto('/');
    await page.locator('.side .nav a', { hasText: 'Drills' }).click();
    await page.getByRole('button', { name: /^Chords$/i }).click();
    await page.getByRole('button', { name: '7♯9' }).click();
    await page.waitForSelector('.scale-card');

    const e7s9 = page.locator('.scale-card', { hasText: 'E7♯9' });
    await e7s9.getByRole('button', { name: /Run it/i }).click();
    await page.waitForSelector('.session-score svg', { timeout: 30_000 });

    await expect(page.locator('.session-piece h2')).toContainText('E7♯9');
    await expect(page.locator('.session-piece h2 em')).toContainText('altered dom');
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
