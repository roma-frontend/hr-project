import { expect, test } from './fixtures';
import { gotoAndSettle, login, selectOrganizationForSuperadmin } from './fixtures';

/**
 * Command palette (⌘K / navbar search) must render horizontally centered.
 *
 * Regression pin: the palette's entry animation bakes `translate(-50%, …)`
 * into its keyframes (spark-command-in/out), which *overrides* the
 * `-translate-x-1/2` utility while running. Any regression that drops the
 * translate from the keyframes — or the utility from the class — leaves the
 * panel's left edge at the viewport center, i.e. visibly shifted right.
 */
test.describe('command palette position', () => {
  test.skip(!process.env.E2E_USER_EMAIL, 'No test credentials configured');
  test.setTimeout(90_000);

  test('palette is centered in the viewport', async ({ page }) => {
    await login(page);
    await page.waitForURL(/dashboard|leaves|tasks/, { timeout: 30_000 });
    await selectOrganizationForSuperadmin(page);
    await gotoAndSettle(page, '/dashboard');

    // Open via ⌘K. When the logged-in user is a superadmin, Ctrl+K toggles
    // QuickActionsPalette instead — its panel lacks .command-panel, and the
    // main palette must not be forced open beneath another overlay.
    await page.keyboard.press('ControlOrMeta+k');
    const isMainPalette = await page
      .locator('.command-panel')
      .waitFor({ state: 'visible', timeout: 4_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!isMainPalette, '⌘K is bound to superadmin QuickActionsPalette for this user');

    const panel = page.locator('.command-panel');

    // Wait for the entry animation to finish (transform settles).
    await page.waitForTimeout(400);

    const box = await panel.boundingBox();
    expect(box).toBeTruthy();
    const viewport = page.viewportSize()!;
    const centerOffset = Math.abs(box!.x + box!.width / 2 - viewport.width / 2);
    // Allow a couple of px of rounding; a half-shifted panel is off by ~20% vw.
    expect(centerOffset).toBeLessThan(8);
  });
});
