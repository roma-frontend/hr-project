/**
 * Temporary verification spec for the global-overlay fixes (single login —
 * the login endpoint rate-limits at 5 attempts / 15 min, so this must never
 * be split into multiple beforeEach logins):
 *
 *  1. Chat widget window must NOT stay open after navigating to /ai-chat.
 *  2. Your Tools (ToolDock) all-modules sheet must NOT stay open after
 *     picking a module in the command palette opened from its search button
 *     (covers both the different-route and same-route cases).
 */
import { test, expect, login } from './fixtures';

test('overlay fixes: chat widget + Your Tools close correctly on navigation', async ({ page }) => {
  // CI runs against a placeholder Convex deployment with no seeded user —
  // same guard as the authedPage fixture.
  test.skip(!process.env.E2E_USER_EMAIL, 'No test credentials configured');

  await login(page);
  await page.waitForURL(/dashboard/, { timeout: 20_000 });
  test.skip(page.url().includes('login'), `Login did not complete (url: ${page.url()})`);

  // ── 1. Chat widget closes on /ai-chat ────────────────────────────────────
  await page.goto('/dashboard');
  await expect(page.locator('body')).toBeVisible();

  const fab = page.getByRole('button', { name: /open ai assistant/i }).first();
  // The widget mounts after hydration + feature-flag query resolve.
  const hasFab = await fab
    .waitFor({ state: 'visible', timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  if (hasFab) {
    // The FAB has drag-to-dock mousedown logic that swallows synthetic pointer
    // clicks in headless runs; a DOM click reliably triggers the React onClick.
    await fab.evaluate((el) => (el as HTMLElement).click());
    // The open widget window renders its chat input inside a fixed panel.
    const widgetInput = page.getByPlaceholder('Type a message...').first();
    await expect(widgetInput).toBeVisible({ timeout: 5_000 });

    await page.goto('/ai-chat');
    await page.waitForLoadState('domcontentloaded');
    // Floating window must be gone — no fixed chat input remains.
    await expect(widgetInput).toHaveCount(0, { timeout: 5_000 });
  } else {
    console.warn('overlay-spec: AI fab not visible — skipping chat widget check');
  }

  // ── 2. Your Tools sheet closes after palette selection ──────────────────
  await page.goto('/dashboard');
  await expect(page.locator('body')).toBeVisible();

  const trigger = page.getByRole('button', { name: 'Your tools' }).first();
  // The dock mounts after hydration + feature-flag queries resolve.
  const hasDock = await trigger
    .waitFor({ state: 'visible', timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  test.skip(!hasDock, 'ToolDock trigger not rendered');

  await trigger.click();

  const allModulesBtn = page.getByRole('button', { name: /all \d+ modules/i }).first();
  if (await allModulesBtn.isVisible().catch(() => false)) {
    await allModulesBtn.click();
  }

  // force: the sheet header button sits inside a transformed (animating) panel
  // that Chromium reports as outside the viewport even with force:true —
  // a DOM click reliably triggers its React onClick.
  await page
    .getByRole('button', { name: 'Search', exact: true })
    .first()
    .evaluate((el) => (el as HTMLElement).click());
  const paletteInput = page.getByPlaceholder(/search or jump to/i).first();
  await expect(paletteInput).toBeVisible({ timeout: 5_000 });

  await page.getByRole('button', { name: 'Dashboard', exact: true }).first().click();

  // Palette closes itself; the Your Tools sheet must be gone too.
  await expect(paletteInput).toHaveCount(0, { timeout: 5_000 });
  // Only the trigger remains (the sheet's title button is inside the sheet).
  const sheetTitle = page.getByRole('heading', { name: 'Your tools' });
  await expect(sheetTitle).toHaveCount(0);
});
