import { expect, test } from '@playwright/test';

test.describe('Session view', () => {
  test('renders metronome, timer, and a Verovio score; cursor advances over time', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.piece-row');
    await page.locator('.piece-row').first().click();
    await page.waitForSelector('.specimen-head');
    // "Begin session" → session view.
    await page.locator('.header-actions .btn-primary').click();

    await page.waitForSelector('.session-score svg g.note', { timeout: 30_000 });

    // 12/8 Chopin → 4 dotted-quarter pulses per bar.
    await expect(page.locator('.metro .pip')).toHaveCount(4);
    await expect(page.locator('.metro .bpm')).toContainText('60');

    // Sample the playback cursor a few times — it must light up different notes
    // as the score-time clock advances.
    const samples: string[] = [];
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(400);
      const lit = await page.locator('.session-score svg g.note.note-playing').evaluateAll(
        (els) => els.map((e) => e.id).join(','),
      );
      samples.push(lit);
    }
    const distinct = new Set(samples.filter((s) => s.length > 0));
    expect(distinct.size).toBeGreaterThan(1);
  });

  test('BPM +/− adjusts the tempo and pause freezes the clock', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.piece-row');
    await page.locator('.piece-row').first().click();
    await page.waitForSelector('.specimen-head');
    await page.locator('.header-actions .btn-primary').click();
    await page.waitForSelector('.session-score svg', { timeout: 30_000 });

    await expect(page.locator('.metro .bpm')).toContainText('60');
    await page.locator('.metro .tempo-ctl button', { hasText: '+' }).click();
    await page.locator('.metro .tempo-ctl button', { hasText: '+' }).click();
    await expect(page.locator('.metro .bpm')).toContainText('68');

    await page.locator('.play-btn').click();
    await expect(page.locator('.session-timer .clock')).toHaveClass(/paused/);
  });
});
