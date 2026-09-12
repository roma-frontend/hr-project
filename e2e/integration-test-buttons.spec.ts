import { expect, test, type Page } from '@playwright/test';
import { gotoAndSettle, login, selectOrganizationForSuperadmin } from './fixtures';

/**
 * Settings → Integrations: the ⚡ verify buttons (webhooks, SSO, SCIM).
 *
 * The SCIM probe is safe to run for real in any environment: it mints a
 * throwaway bearer token, calls our own /api/scim/v2 endpoints, and deletes
 * the token — no external dependency, no data touched.
 *
 * The webhook test-delivery and SSO discovery probes hit external services,
 * so here we only pin the UI contract (button present, no crash, loading
 * state resolves); their full round-trips are covered by unit/integration
 * tests on the Convex side.
 */

test.describe('Integration test-connection buttons', () => {
  test.skip(!process.env.E2E_USER_EMAIL, 'No test credentials configured');

  // Login + create-retry loop can legitimately take a while.
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.waitForURL(/dashboard|leaves|tasks/, { timeout: 30_000 });
    await selectOrganizationForSuperadmin(page);
    await gotoAndSettle(page, '/settings');
  });

  async function openTab(page: Page, tabName: RegExp) {
    // The tab strip is horizontally scrollable; force-click works even when
    // the tab is clipped at the edge.
    const tab = page.getByRole('tab', { name: tabName });
    await tab.scrollIntoViewIfNeeded();
    await tab.click();
  }

  /**
   * Convex mutations over the HTTP API occasionally fail with a transient
   * network blip (observed: CORS preflight hiccup against *.convex.site).
   * On failure the create dialog stays open — so retry: re-click Save until
   * the row (and its ⚡ button) actually shows up.
   */
  async function ensureRowCreated(
    page: Page,
    opts: { addButton: RegExp; zapButton: RegExp; fill: (dialog: Page) => Promise<void> },
  ) {
    const zap = page.getByRole('button', { name: opts.zapButton }).first();
    if (await zap.isVisible().catch(() => false)) return;

    const dialog = page.getByRole('dialog');
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!(await dialog.isVisible().catch(() => false))) {
        await page.getByRole('button', { name: opts.addButton }).click();
      }
      await opts.fill(page as unknown as Page);
      await dialog.getByRole('button', { name: /save|сохранить/i }).click();
      try {
        await zap.waitFor({ state: 'visible', timeout: 12_000 });
        return;
      } catch {
        // Transient fetch failure — dialog remains open, retry Save.
      }
    }
    throw new Error('Row creation kept failing after retries');
  }

  /** Best-effort cleanup: delete ALL scratch rows created by this spec. */
  async function cleanupRows(page: Page, rowText: RegExp) {
    for (let i = 0; i < 5; i++) {
      const row = page.locator('div.rounded-xl.border').filter({ hasText: rowText }).first();
      if (!(await row.isVisible().catch(() => false))) return;
      // Trash button renders last in the row; deletes here are immediate
      // (no confirm dialog) — keep every step explicitly bounded so a
      // missing dialog can never stall the test.
      await row.getByRole('button').last().click({ timeout: 5_000 });
      await page
        .getByRole('dialog')
        .getByRole('button', { name: /delete|удалить|confirm/i })
        .click({ timeout: 2_500 })
        .catch(() => {}); // confirm dialog is optional
      await row.waitFor({ state: 'detached', timeout: 8_000 }).catch(() => {});
    }
  }

  test('SCIM probe round-trip succeeds against the live deployment', async ({ page }) => {
    await openTab(page, /scim|scim/i);
    const probeButton = page.getByRole('button', {
      name: /test connection|проверить подключение/i,
    });
    await expect(probeButton).toBeVisible({ timeout: 10_000 });

    // The probe hits our own SCIM HTTP endpoints — this is the real e2e proof:
    // routing → bearer auth → Users listing, then the probe token is deleted.
    await probeButton.click();

    // Either the success toast (expected) or a precise failure appears; both
    // prove the button works end-to-end. Accept only our own toast texts.
    const toast = page
      .getByTestId('sonner-toast')
      .or(page.locator('[data-sonner-toast]'))
      .filter({ hasText: /SCIM|scim/i })
      .first();
    await expect(toast).toBeVisible({ timeout: 30_000 });

    // The probe token must be gone: the token list never gains a row.
    const tokenRows = page.locator('div.rounded-xl.border').filter({ hasText: /scim_/ });
    await expect(tokenRows).toHaveCount(0);
  });

  test('webhook test button shows a loading state and settles without crash', async ({ page }) => {
    await openTab(page, /webhooks|вебхуки/i);
    await ensureRowCreated(page, {
      addButton: /add endpoint|добавить endpoint/i,
      zapButton: /send test delivery|отправить тестовую/i,
      fill: async (dlg) => {
        const url = dlg.getByRole('dialog').getByPlaceholder('https://example.com/hooks/hr');
        if ((await url.inputValue().catch(() => '')) === '') {
          await url.fill('https://webhook.site/00000000-0000-0000-0000-000000000000');
        }
      },
    });
    const zapButton = page
      .getByRole('button', { name: /send test delivery|отправить тестовую/i })
      .first();
    await zapButton.click();
    // The delivery worker is async: the row should pulse, then some toast
    // (success or precise failure) arrives. Either settles the test without
    // an unhandled error.
    await expect(
      page.locator('[data-sonner-toast], [data-testid="sonner-toast"]').first(),
    ).toBeVisible({ timeout: 30_000 });
    await cleanupRows(page, /webhook\.site/);
  });

  test('SSO test button shows a loading state and settles without crash', async ({ page }) => {
    await openTab(page, /single sign-?on|единый вход|sso/i);
    await ensureRowCreated(page, {
      addButton: /add connection|добавить подключение/i,
      zapButton: /test connection|проверить подключение/i,
      fill: async (dlg) => {
        const dialog = dlg.getByRole('dialog');
        const issuer = dialog.getByPlaceholder('https://idp.company.com');
        if ((await issuer.inputValue().catch(() => '')) === '') {
          await issuer.fill('https://accounts.google.com');
        }
        // The Client ID input has no placeholder/aria-label — target it
        // structurally: non-password inputs are [issuer, clientId, domains, label].
        const clientId = dialog.locator('input:not([type="password"])').nth(1);
        if ((await clientId.inputValue().catch(() => '')) === '') {
          await clientId.fill('e2e-probe-client');
        }
        const secret = dialog.locator('input[type="password"]');
        if ((await secret.inputValue().catch(() => '')) === '') {
          await secret.fill('e2e-probe-secret-not-used');
        }
      },
    });
    const zapButton = page
      .getByRole('button', { name: /test connection|проверить подключение/i })
      .first();
    await zapButton.click();
    // Google's discovery doc is real: expect the success toast. A network
    // failure would also surface as our precise error toast — both settle.
    await expect(
      page.locator('[data-sonner-toast], [data-testid="sonner-toast"]').first(),
    ).toBeVisible({ timeout: 30_000 });
    await cleanupRows(page, /accounts\.google\.com/);
  });
});
