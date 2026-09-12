import { expect, test } from './fixtures';
import { gotoAndSettle, login, selectOrganizationForSuperadmin } from './fixtures';

/**
 * /payroll — the banner's "Посмотреть всё" button scrolls to the payroll
 * calendar and the current-month card flashes with the kanban-style
 * ring+wash highlight (inline box-shadow from highlightRowStyle).
 *
 * Regression pin: an earlier implementation pulsed the whole section wrapper
 * whose background was covered by the cards — technically animated, visually
 * invisible. The highlight must land on the month card itself.
 */
test.describe('payroll banner view-all', () => {
  test.skip(!process.env.E2E_USER_EMAIL, 'No test credentials configured');
  test.setTimeout(90_000);

  test('clicking view-all flashes the current month card', async ({ page }) => {
    await login(page);
    await page.waitForURL(/dashboard|leaves|tasks|payroll/, { timeout: 30_000 });
    await selectOrganizationForSuperadmin(page);
    await gotoAndSettle(page, '/payroll');

    const viewAll = page.getByRole('button', { name: /view all|посмотреть всё/i });
    await expect(viewAll).toBeVisible({ timeout: 15_000 });
    await viewAll.click();

    // The current-month card exists and the scroll started.
    const card = page.locator('#payroll-current-month');
    await expect(card).toBeVisible({ timeout: 10_000 });

    // The kanban-style highlight is an inline box-shadow on the card itself.
    // It blinks on/off (600ms rhythm), so poll for ANY pulse-phase sighting.
    await expect
      .poll(async () => card.evaluate((el) => el.style.getPropertyValue('box-shadow') !== ''), {
        timeout: 8_000,
        intervals: [500, 200],
      })
      .toBe(true);

    // …and it clears again after the ~3.6s highlight window. React leaves an
    // empty style="" attribute behind, so check for empty rather than null.
    await expect
      .poll(async () => card.evaluate((el) => (el.getAttribute('style') ?? '') === ''), {
        timeout: 10_000,
        intervals: [1000, 500],
      })
      .toBe(true);
  });
});
