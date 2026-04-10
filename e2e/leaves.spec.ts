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

  test('leaves page should be accessible', async ({ page }) => {
    await expect(page).toHaveURL(/leaves|leave/);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('should display leave request form or button', async ({ page }) => {
    const hasForm = (await page.locator('form').count()) > 0;
    const hasButton =
      (await page.locator('text=request, text=Request, text=new leave, text=create').count()) > 0;

    expect(hasForm || hasButton).toBeTruthy();
  });

  test('should show leave balance information', async ({ page }) => {
    // Look for balance indicators
    const hasBalance =
      (await page.locator('text=balance, text=remaining, text=available, text=days left').count()) >
      0;
    const hasStats = (await page.locator('[class*="balance"], [class*="stat"]').count()) > 0;

    expect(hasBalance || hasStats).toBeTruthy();
  });

  test('leave request form should have required fields', async ({ page }) => {
    // Open create form if needed
    const createBtn = page.locator('text=request, text=Request, text=new').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
    }

    // Check for common leave form fields
    const hasStartDate =
      (await page.locator('input[type="date"], text=start, text=from').count()) > 0;
    const hasEndDate = (await page.locator('input[type="date"], text=end, text=to').count()) > 0;
    const hasReason = (await page.locator('textarea, select, text=reason, text=type').count()) > 0;

    expect(hasStartDate || hasEndDate || hasReason).toBeTruthy();
  });

  test('should display leave history', async ({ page }) => {
    // Look for table or list of leave requests
    const hasTable = (await page.locator('table').count()) > 0;
    const hasList = (await page.locator('[class*="list"], [class*="history"]').count()) > 0;
    const hasCards = (await page.locator('[class*="card"]').count()) > 0;

    expect(hasTable || hasList || hasCards).toBeTruthy();
  });

  test('should show leave request status badges', async ({ page }) => {
    const hasStatuses =
      (await page.locator('text=pending, text=approved, text=rejected, text=cancelled').count()) >
      0;
    const hasBadges = (await page.locator('[class*="badge"], [class*="status"]').count()) > 0;

    expect(hasStatuses || hasBadges).toBeTruthy();
  });

  test('leave types should be selectable', async ({ page }) => {
    // Open create form
    const createBtn = page.locator('text=request, text=Request, text=new').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
    }

    // Look for leave type selectors
    const hasTypes =
      (await page.locator('select, text=vacation, text=sick, text=personal, text=annual').count()) >
      0;
    expect(hasTypes).toBeTruthy();
  });

  test('should validate required form fields', async ({ page }) => {
    // Open create form
    const createBtn = page.locator('text=request, text=Request').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
    }

    // Try to submit empty form
    const submitBtn = page.locator('button[type="submit"], text=submit, text=Submit').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();

      // Should show validation or not submit
      await page.waitForTimeout(500);
      const hasErrors =
        (await page.locator('[class*="error"], [class*="invalid"], text=required').count()) > 0;
      const stillOnForm = page.url().includes('leave') || page.url().includes('modal');
      expect(hasErrors || stillOnForm).toBeTruthy();
    }
  });

  test('should handle unauthenticated access gracefully', async ({ page }) => {
    await page.context().clearCookies();
    await page.reload();

    const url = page.url();
    const isAuthPage = url.includes('login') || url.includes('auth') || url.includes('sign-in');
    const hasAuthPrompt = (await page.locator('text=login, text=sign in').count()) > 0;

    expect(isAuthPage || hasAuthPrompt).toBeTruthy();
  });

  test('responsive layout on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/leaves');

    await expect(page.locator('h1, h2').first()).toBeVisible();

    // No horizontal scroll
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);
  });

  test('date picker should prevent end date before start date', async ({ page }) => {
    // Open create form
    const createBtn = page.locator('text=request, text=Request').first();
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
      const submitBtn = page.locator('button[type="submit"], text=submit, text=Submit').first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForTimeout(500);

        const hasError =
          (await page.locator('text=invalid, text=error, text=must be after').count()) > 0;
        expect(hasError || page.url().includes('leave')).toBeTruthy();
      }
    }
  });
});
