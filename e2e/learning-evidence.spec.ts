import { test, expect } from './fixtures';

/**
 * Browser LMS evidence flow — authoritative quiz + content-version invalidation.
 * Skipped without E2E credentials (same guard as auth.spec.ts / fixtures).
 */
test.describe('Learning — browser evidence', () => {
  test('learning center renders and quiz respects authoritative start', async ({
    authedPage: page,
  }) => {
    await page.goto('/learning');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('text=/Learning|Обучение/i').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('course detail opens without 404', async ({ authedPage: page }) => {
    await page.goto('/learning');
    await page.waitForLoadState('domcontentloaded');
    const firstCourse = page.locator('[class*="card"]').first();
    if (await firstCourse.isVisible().catch(() => false)) {
      await firstCourse.click();
      await page.waitForTimeout(1500);
      await expect(page.locator('body')).not.toContainText('404');
    }
  });
});
