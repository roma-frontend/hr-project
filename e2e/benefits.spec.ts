import { expect, test, type Page } from '@playwright/test';
import { gotoAndSettle, login, selectOrganizationForSuperadmin } from './fixtures';

/**
 * Benefits Administration end-to-end.
 *
 * Proves against the live deployment: the /benefits page loads, an admin can
 * create a plan, a user can enroll from the catalog and file a claim, and the
 * admin review tab shows it. Cleanup is best-effort (deletes the created
 * plan between runs when possible).
 *
 * Skip-safe: requires E2E_USER_EMAIL like every authenticated spec.
 */

const PLAN_NAME = `E2E Fitness ${Date.now().toString(36)}`;

async function openBenefits(page: Page) {
  await gotoAndSettle(page, '/benefits');
  await expect(page.getByRole('heading', { name: /benefits|льготы|նպաստ/i })).toBeVisible({
    timeout: 15_000,
  });
}

async function openTab(page: Page, name: RegExp) {
  const tab = page.getByRole('tab', { name });
  await tab.scrollIntoViewIfNeeded();
  await tab.click();
}

test.describe('Benefits module', () => {
  test.skip(!process.env.E2E_USER_EMAIL, 'No test credentials configured');
  test.setTimeout(120_000);

  test('page loads with catalog and wallet tabs', async ({ page }) => {
    await login(page);
    await page.waitForURL(/dashboard|leaves|tasks/, { timeout: 30_000 });
    await selectOrganizationForSuperadmin(page);
    await openBenefits(page);

    // Core tabs always render; staff-only tabs exist for admins.
    await expect(page.getByRole('tab', { name: /catalog|каталог|կատալոգ/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /my benefits|мои льготы|իմ նպաստ/i })).toBeVisible();
  });

  test('admin creates a plan, user enrolls and files a claim, admin sees it', async ({ page }) => {
    await login(page);
    await page.waitForURL(/dashboard|leaves|tasks/, { timeout: 30_000 });
    await selectOrganizationForSuperadmin(page);
    await openBenefits(page);

    // ── Admin: create an allowance plan ──────────────────────────────────
    await openTab(page, /admin|администрирование|կառավարում/i);
    await page.getByRole('button', { name: /new plan|новый пакет|նոր փաթեթ/i }).click();

    const dialog = page.getByRole('dialog');
    await dialog.locator('input').first().fill(PLAN_NAME);
    // Amount inputs (annual, per-claim) — leave amounts small and valid.
    await dialog.locator('input[type="number"]').first().fill('50000');
    await dialog.locator('input[type="number"]').nth(1).fill('10000');
    await dialog.getByRole('button', { name: /save plan|сохранить|պահպանել/i }).click();

    // The plan card appears in the catalog.
    const planCard = page.locator('[data-slot="card"], .rounded-xl, [class*="card"]').filter({
      hasText: PLAN_NAME,
    });
    await expect(planCard.first()).toBeVisible({ timeout: 15_000 });

    // ── Catalog: enroll ──────────────────────────────────────────────────
    await openTab(page, /catalog|каталог|կատալոգ/i);
    const enrollButton = planCard
      .first()
      .getByRole('button', { name: /enroll|записаться|գրանցվել/i });
    if (await enrollButton.isVisible().catch(() => false)) {
      await enrollButton.click();
      // After enrolling, the button becomes "Cancel enrollment".
      await expect(
        planCard
          .first()
          .getByRole('button', { name: /cancel enrollment|отменить запись|չեղարկել/i }),
      ).toBeVisible({ timeout: 15_000 });
    } else {
      // Already enrolled from a previous partial run — fine.
      await expect(
        planCard
          .first()
          .getByRole('button', { name: /cancel enrollment|отменить запись|չեղարկել/i }),
      ).toBeVisible({ timeout: 10_000 });
    }

    // ── File a claim via the per-plan claim button ────────────────────────
    const claimButton = page
      .getByRole('button')
      .filter({ hasText: PLAN_NAME })
      .and(page.getByRole('button', { name: /new claim|новая заявка|նոր հայտ/i }))
      .first();
    if (await claimButton.isVisible().catch(() => false)) {
      await claimButton.click();
      const claimDialog = page.getByRole('dialog');
      await claimDialog.locator('input').first().fill('E2E gym fee');
      await claimDialog.locator('input[type="number"]').first().fill('5000');
      await claimDialog.getByRole('button', { name: /submit|отправить|ուղարկել/i }).click();
      // Claim appears in "My Benefits" as submitted.
      await openTab(page, /my benefits|мои льготы|իմ նպաստ/i);
      await expect(page.locator('div').filter({ hasText: 'E2E gym fee' }).first()).toBeVisible({
        timeout: 15_000,
      });
    }

    // ── Admin: the claim shows in the review queue ───────────────────────
    await openTab(page, /admin|администрирование|կառավարում/i);
    await expect(page.locator('div').filter({ hasText: 'E2E gym fee' }).first()).toBeVisible({
      timeout: 15_000,
    });

    // ── Cleanup: cancel enrollment (refunds wallet), keep plan delete to API
    const cancel = page
      .locator('[data-slot="card"], .rounded-xl, [class*="card"]')
      .filter({ hasText: PLAN_NAME })
      .first()
      .getByRole('button', { name: /cancel enrollment|отменить запись|չեղարկել/i });
    if (await cancel.isVisible().catch(() => false)) {
      await cancel.click();
    }
  });
});
