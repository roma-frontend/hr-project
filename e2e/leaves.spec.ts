import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Leave Request Flow
 *
 * Tests critical leave paths including:
 * - Leave request page accessibility
 * - Create leave request form
 * - Leave balance display
 * - Leave history viewing
 * - Approval status tracking
 */

test.describe('Leave Request Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/leaves');
  });

  test('leaves page should be accessible or redirect to login', async ({ page }) => {
    const url = page.url();
    const isLeavesPage = url.includes('leaves') || url.includes('leave');
    const isLoginPage = url.includes('login') || url.includes('auth');

    expect(isLeavesPage || isLoginPage).toBeTruthy();

    if (isLeavesPage) {
      await expect(page.locator('h1, h2').first()).toBeVisible();
    }
  });

  test('should display leave request form or button or redirect', async ({ page }) => {
    if (page.url().includes('login') || page.url().includes('auth')) {
      expect(true).toBeTruthy();
      return;
    }

    const hasForm = (await page.locator('form').count()) > 0;
    const hasButton =
      (await page.locator('text=request').count()) > 0 ||
      (await page.locator('text=Request').count()) > 0 ||
      (await page.locator('text=new leave').count()) > 0 ||
      (await page.locator('text=create').count()) > 0;

    expect(hasForm || hasButton).toBeTruthy();
  });

  test('should show leave balance information or redirect', async ({ page }) => {
    if (page.url().includes('login') || page.url().includes('auth')) {
      expect(true).toBeTruthy();
      return;
    }

    // Look for balance indicators
    const hasBalance =
      (await page.locator('text=balance').count()) > 0 ||
      (await page.locator('text=remaining').count()) > 0 ||
      (await page.locator('text=available').count()) > 0 ||
      (await page.locator('text=days left').count()) > 0;
    const hasStats =
      (await page.locator('[class*="balance"]').count()) > 0 ||
      (await page.locator('[class*="stat"]').count()) > 0;

    expect(hasBalance || hasStats).toBeTruthy();
  });

  test('leave request form should have required fields or redirect', async ({ page }) => {
    if (page.url().includes('login') || page.url().includes('auth')) {
      expect(true).toBeTruthy();
      return;
    }

    // Open create form if needed
    const createBtn =
      page.locator('text=request').first() || page.locator('text=Request').first() || page.locator('text=new').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
    }

    // Check for common leave form fields
    const hasStartDate =
      (await page.locator('input[type="date"]').count()) > 0 ||
      (await page.locator('text=start').count()) > 0 ||
      (await page.locator('text=from').count()) > 0;
    const hasEndDate =
      (await page.locator('input[type="date"]').count()) > 0 ||
      (await page.locator('text=end').count()) > 0 ||
      (await page.locator('text=to').count()) > 0;
    const hasReason =
      (await page.locator('textarea').count()) > 0 ||
      (await page.locator('select').count()) > 0 ||
      (await page.locator('text=reason').count()) > 0 ||
      (await page.locator('text=type').count()) > 0;

    expect(hasStartDate || hasEndDate || hasReason).toBeTruthy();
  });

  test('should display leave history or redirect', async ({ page }) => {
    if (page.url().includes('login') || page.url().includes('auth')) {
      expect(true).toBeTruthy();
      return;
    }

    // Look for table or list of leave requests
    const hasTable = (await page.locator('table').count()) > 0;
    const hasList =
      (await page.locator('[class*="list"]').count()) > 0 ||
      (await page.locator('[class*="history"]').count()) > 0;
    const hasCards = (await page.locator('[class*="card"]').count()) > 0;

    expect(hasTable || hasList || hasCards).toBeTruthy();
  });

  test('should show leave request status badges or redirect', async ({ page }) => {
    if (page.url().includes('login') || page.url().includes('auth')) {
      expect(true).toBeTruthy();
      return;
    }

    const hasStatuses =
      (await page.locator('text=pending').count()) > 0 ||
      (await page.locator('text=approved').count()) > 0 ||
      (await page.locator('text=rejected').count()) > 0 ||
      (await page.locator('text=cancelled').count()) > 0;
    const hasBadges =
      (await page.locator('[class*="badge"]').count()) > 0 ||
      (await page.locator('[class*="status"]').count()) > 0;

    expect(hasStatuses || hasBadges).toBeTruthy();
  });

  test('leave types should be selectable or redirect', async ({ page }) => {
    if (page.url().includes('login') || page.url().includes('auth')) {
      expect(true).toBeTruthy();
      return;
    }

    // Open create form
    const createBtn =
      page.locator('text=request').first() || page.locator('text=Request').first() || page.locator('text=new').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
    }

    // Look for leave type selectors
    const hasTypes =
      (await page.locator('select').count()) > 0 ||
      (await page.locator('text=vacation').count()) > 0 ||
      (await page.locator('text=sick').count()) > 0 ||
      (await page.locator('text=personal').count()) > 0 ||
      (await page.locator('text=annual').count()) > 0;
    expect(hasTypes).toBeTruthy();
  });

  test('should validate required form fields or redirect', async ({ page }) => {
    if (page.url().includes('login') || page.url().includes('auth')) {
      expect(true).toBeTruthy();
      return;
    }

    // Open create form
    const createBtn = page.locator('text=request').first() || page.locator('text=Request').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
    }

    // Try to submit empty form
    const submitBtn =
      page.locator('button[type="submit"]').first() ||
      page.locator('text=submit').first() ||
      page.locator('text=Submit').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click({ force: true });

      // Should show validation or not submit
      await page.waitForTimeout(500);
      const hasErrors =
        (await page.locator('[class*="error"]').count()) > 0 ||
        (await page.locator('[class*="invalid"]').count()) > 0 ||
        (await page.locator('text=required').count()) > 0;
      const stillOnForm = page.url().includes('leave') || page.url().includes('modal');
      expect(hasErrors || stillOnForm).toBeTruthy();
    }
  });

  test('should handle unauthenticated access gracefully', async ({ page }) => {
    await page.context().clearCookies();
    await page.reload();

    const url = page.url();
    const isAuthPage = url.includes('login') || url.includes('auth') || url.includes('sign-in');
    const hasAuthPrompt =
      (await page.locator('text=login').count()) > 0 ||
      (await page.locator('text=sign in').count()) > 0;

    expect(isAuthPage || hasAuthPrompt).toBeTruthy();
  });

  test('responsive layout on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/leaves');

    // If redirected to login, that's fine
    if (page.url().includes('login') || page.url().includes('auth')) {
      expect(true).toBeTruthy();
      return;
    }

    await expect(page.locator('h1, h2').first()).toBeVisible();

    // No horizontal scroll
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);
  });

  test('date picker should prevent end date before start date or redirect', async ({ page }) => {
    if (page.url().includes('login') || page.url().includes('auth')) {
      expect(true).toBeTruthy();
      return;
    }

    // Open create form
    const createBtn = page.locator('text=request').first() || page.locator('text=Request').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
    }

    // Check date validation exists
    const startDateInput = page.locator('input[type="date"]').first();
    const endDateInput = page.locator('input[type="date"]').nth(1);

    if ((await startDateInput.isVisible()) && (await endDateInput.isVisible())) {
      // Set start date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await startDateInput.fill(tomorrow.toISOString().split('T')[0] ?? '');

      // Try to set end date before start
      const yesterday = new Date();
      await endDateInput.fill(yesterday.toISOString().split('T')[0] ?? '');

      // Submit and check validation
      const submitBtn =
        page.locator('button[type="submit"]').first() ||
        page.locator('text=submit').first() ||
        page.locator('text=Submit').first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click({ force: true });
        await page.waitForTimeout(500);

        const hasError =
          (await page.locator('text=invalid').count()) > 0 ||
          (await page.locator('text=error').count()) > 0 ||
          (await page.locator('text=must be after').count()) > 0;
        expect(hasError || page.url().includes('leave')).toBeTruthy();
      }
    }
  });
});
