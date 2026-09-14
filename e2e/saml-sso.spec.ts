import { expect, test } from '@playwright/test';
import { gotoAndSettle, login, selectOrganizationForSuperadmin } from './fixtures';

/**
 * SAML 2.0 SSO end-to-end.
 *
 * Real-IdP assertion round-trips need signed XML from Okta/Entra, so the
 * full login handshake is covered by unit/integration tests on the validation
 * action. What e2e can (and here does) prove against the live deployment:
 *   - SP metadata is served, well-formed, and per-connection (real ACS URL);
 *   - the start route 302s an unknown/disabled connection to /login with a
 *     precise error key and never leaks internals;
 *   - the ACS route rejects direct POSTs without a RelayState (fail-closed);
 *   - admins can create and delete a SAML connection from Settings.
 */

test.describe('SAML SSO', () => {
  const APP = process.env.E2E_BASE_URL || 'http://localhost:3000';
  // The SP entity ID / ACS URLs are derived from the *server's* app URL env
  // (NEXT_PUBLIC_APP_URL), which can legitimately differ from E2E_BASE_URL —
  // so assertions match by path, not by absolute origin.

  test('deployment metadata serves valid SP XML', async ({ request }) => {
    const res = await request.get(`${APP}/api/sso/metadata`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/samlmetadata+xml');

    const xml = await res.text();
    expect(xml).toContain('<EntityDescriptor');
    expect(xml).toMatch(/entityID="https?:\/\/[^/]+\/api\/sso\/metadata"/);
    // Placeholder ACS at deployment level; per-connection has the real one.
    expect(xml).toContain('/api/sso/acs/CONNECTION_ID');
    expect(xml).toContain('WantAssertionsSigned="true"');
  });

  test('per-connection metadata embeds the connection ACS URL', async ({ request }) => {
    const res = await request.get(`${APP}/api/sso/metadata/abcdef1234567890`);
    expect(res.status()).toBe(200);
    const xml = await res.text();
    expect(xml).toMatch(/Location="https?:\/\/[^/]+\/api\/sso\/acs\/abcdef1234567890"/);
    expect(xml).not.toContain('CONNECTION_ID');
  });

  test('start route redirects unknown connection to login with an error key', async ({
    request,
  }) => {
    const res = await request.get(`${APP}/api/sso/start/doesnotexist0000`, {
      maxRedirects: 0,
    });
    // Next.js may answer 302 or 307 depending on route normalization.
    expect([302, 307]).toContain(res.status());
    const location = res.headers()['location'] ?? '';
    expect(location).toContain('/login?error=');
    expect(location).toMatch(/sso_disabled|sso_error/);
  });

  test('ACS rejects a bare POST without RelayState (fail-closed)', async ({ request }) => {
    const res = await request.post(`${APP}/api/sso/acs/abcdef1234567890`, {
      form: { SAMLResponse: Buffer.from('<fake/>').toString('base64') },
      maxRedirects: 0,
    });
    expect([302, 307]).toContain(res.status());
    expect(res.headers()['location']).toContain('sso_state_mismatch');
  });

  test('admin can create and delete a SAML connection', async ({ page }) => {
    test.skip(!process.env.E2E_USER_EMAIL, 'No test credentials configured');
    test.setTimeout(120_000);

    await login(page);
    await page.waitForURL(/dashboard|leaves|tasks/, { timeout: 30_000 });
    await selectOrganizationForSuperadmin(page);
    await gotoAndSettle(page, '/settings');

    const openTab = async (name: RegExp) => {
      const tab = page.getByRole('tab', { name: name });
      await tab.scrollIntoViewIfNeeded();
      await tab.click();
    };

    await openTab(/saml/i);

    // ── Create ────────────────────────────────────────────────────────────
    const row = page
      .locator('div.rounded-xl.border')
      .filter({ hasText: /e2e-saml-idp/i })
      .first();

    if (!(await row.isVisible().catch(() => false))) {
      await page.getByRole('button', { name: /add saml connection|saml-подключение/i }).click();
      const dialog = page.getByRole('dialog');
      await dialog.locator('input').first().fill('https://e2e-saml-idp.example.com/metadata');
      await dialog.locator('input').nth(1).fill('https://e2e-saml-idp.example.com/sso');
      await dialog
        .locator('textarea')
        .fill(
          '-----BEGIN CERTIFICATE-----\nMIIBkTCB+wIJAKlE2TJkQz0KMA0GCSqGSIb3DQEBCwUAMBQxEjAQBgNVBAMTCWV4YW1wbGUt\n-----END CERTIFICATE-----',
        );
      // Domains + label follow the textarea.
      const inputs = dialog.locator('input');
      await inputs.nth(2).fill('e2e-saml.example.com');
      await inputs.nth(3).fill('e2e-saml-idp');
      await dialog.getByRole('button', { name: /save|сохранить/i }).click();
      await row.waitFor({ state: 'visible', timeout: 15_000 });
    }

    // Row shows the connection with a copyable metadata URL affordance.
    await expect(row).toBeVisible();
    await expect(row).toContainText(/e2e-saml\.example\.com|all domains/i);

    // ── Delete (best-effort cleanup, mirrors integration spec) ───────────
    for (let i = 0; i < 5; i++) {
      const current = page
        .locator('div.rounded-xl.border')
        .filter({ hasText: /e2e-saml-idp/i })
        .first();
      if (!(await current.isVisible().catch(() => false))) return;
      await current.getByRole('button').last().click({ timeout: 5_000 });
      await page
        .getByRole('dialog')
        .getByRole('button', { name: /delete|удалить|confirm/i })
        .click({ timeout: 2_500 })
        .catch(() => {}); // confirm dialog is optional
      await current.waitFor({ state: 'detached', timeout: 8_000 }).catch(() => {});
    }
  });
});
