import { expect, test } from './fixtures';
import { gotoAndSettle, login, selectOrganizationForSuperadmin } from './fixtures';

/**
 * /shifts week-switching & sheet popups.
 *
 * The regression being pinned: switching weeks must NOT unmount the page
 * blocks (header buttons, template card, roster card). Previously the Convex
 * query returned `undefined` for the new week's args, `canManage` fell back to
 * false, the manager buttons + template card unmounted, and the roster card
 * collapsed into a "Loading…" placeholder on every arrow click. The roster
 * content should also crossfade (slide) rather than pop.
 *
 * Also covers the new slide-over popups: "Add shift" and "Apply template"
 * open as sheets (side panels), not centred dialogs.
 */

test.describe('/shifts week switching', () => {
  // Same guard as the other real-login specs: without seeded credentials the
  // login cannot succeed, so skip instead of hard-failing (e.g. in CI).
  test.skip(!process.env.E2E_USER_EMAIL, 'No test credentials configured');

  test.beforeEach(async ({ page }) => {
    await login(page);
    // login() only submits the form — the session cookie is set after the
    // redirect. Wait for it before navigating, or /shifts bounces to /login.
    await page.waitForURL(/dashboard|leaves|tasks/, { timeout: 30_000 });
    await selectOrganizationForSuperadmin(page);
    await gotoAndSettle(page, '/shifts');
  });

  test('week arrows keep blocks mounted and crossfade content', async ({ page }) => {
    // Manager UI is what used to unmount; require it up front.
    const addShiftBtn = page.getByRole('button', { name: /add shift|добавить смену/i });
    await expect(addShiftBtn).toBeVisible({ timeout: 15_000 });

    const templateCardHeading = page.getByText(/shift templates|шаблоны смен/i).first();
    await expect(templateCardHeading).toBeVisible();

    // The roster card title carries the week range: "Roster · YYYY-MM-DD → YYYY-MM-DD".
    const rosterTitle = page.getByText(/roster ·|график ·/i).first();
    await expect(rosterTitle).toBeVisible();

    const rangeBefore = (await rosterTitle.textContent()) ?? '';

    // Tag the existing DOM nodes so we can prove they are never unmounted.
    await page.evaluate(() => {
      document.querySelectorAll('main [data-slot="card"], main .card').forEach((el, i) => {
        el.setAttribute('data-keep-check', `node-${i}`);
      });
    });

    // Next week.
    await page.getByTestId('shifts-next-week').click();

    // The range in the title changes…
    await expect(rosterTitle).not.toHaveText(rangeBefore, { timeout: 10_000 });

    // …while the tagged nodes are all still in the DOM (nothing remounted).
    const kept = await page.evaluate(() => document.querySelectorAll('[data-keep-check]').length);
    expect(kept).toBeGreaterThan(0);

    await expect(addShiftBtn).toBeVisible();
    await expect(templateCardHeading).toBeVisible();

    // Previous week returns to the original range, still without remounting.
    await page.getByTestId('shifts-prev-week').click();
    await expect(rosterTitle).toHaveText(rangeBefore, { timeout: 10_000 });
    await expect(addShiftBtn).toBeVisible();

    // No loader placeholder may appear in the roster card during switches.
    await expect(page.getByText(/loading…|загрузка/i)).toHaveCount(0);
  });

  test('add shift opens a right-side sheet, not a centred dialog', async ({ page }) => {
    await page.getByRole('button', { name: /add shift|добавить смену/i }).click();

    const sheet = page.locator('[data-side="right"].spark-sheet');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    // The sheet carries the form…
    await expect(sheet.getByText(/employee|сотрудник/i).first()).toBeVisible();
    // …and the old centred dialog must NOT be present.
    await expect(page.locator('[role="alert-dialog"], [data-slot="dialog-content"]')).toHaveCount(
      0,
    );

    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden({ timeout: 5_000 });
  });

  test('apply template opens a right-side sheet', async ({ page }) => {
    await page.getByRole('button', { name: /apply template|применить шаблон/i }).click();

    const sheet = page.locator('[data-side="right"].spark-sheet');
    await expect(sheet).toBeVisible({ timeout: 5_000 });
    await expect(sheet.getByText(/template|шаблон/i).first()).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden({ timeout: 5_000 });
  });
});
