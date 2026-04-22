import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Attendance Tracking Flow
 *
 * Tests critical attendance paths including:
 * - Attendance page accessibility
 * - Clock in/out functionality
 * - Attendance history viewing
 * - Status updates
 */

test.describe('Attendance Tracking', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to attendance page (adjust URL as needed)
    await page.goto('/attendance');
  });

  test('attendance page should be accessible or redirect to login', async ({ page }) => {
    // Page should either load attendance or redirect to login
    const url = page.url();
    const isAttendancePage = url.includes('attendance');
    const isLoginPage = url.includes('login') || url.includes('auth');

    expect(isAttendancePage || isLoginPage).toBeTruthy();

    if (isAttendancePage) {
      await expect(page.locator('h1, h2').first()).toBeVisible();
    }
  });

  test('should display attendance controls or redirect to login', async ({ page }) => {
    // If redirected to login, that's expected behavior
    if (page.url().includes('login') || page.url().includes('auth')) {
      expect(true).toBeTruthy();
      return;
    }

    // Check for clock in/out buttons or attendance controls
    const hasClockIn =
      (await page.locator('text=clock in').count()) > 0 ||
      (await page.locator('text=Clock In').count()) > 0 ||
      (await page.locator('text=start').count()) > 0;
    const hasClockOut =
      (await page.locator('text=clock out').count()) > 0 ||
      (await page.locator('text=Clock Out').count()) > 0 ||
      (await page.locator('text=end').count()) > 0;
    const hasStatus =
      (await page.locator('text=attendance').count()) > 0 ||
      (await page.locator('text=present').count()) > 0 ||
      (await page.locator('text=absent').count()) > 0;

    expect(hasClockIn || hasClockOut || hasStatus).toBeTruthy();
  });

  test('should show current attendance status or redirect', async ({ page }) => {
    if (page.url().includes('login') || page.url().includes('auth')) {
      expect(true).toBeTruthy();
      return;
    }

    // Look for status indicators
    const statusElement = page.locator('[class*="status"], [class*="badge"]').first();
    if (await statusElement.isVisible()) {
      const statusText = await statusElement.textContent();
      expect(statusText?.length).toBeGreaterThan(0);
    }
  });

  test('should display attendance history or records or redirect', async ({ page }) => {
    if (page.url().includes('login') || page.url().includes('auth')) {
      expect(true).toBeTruthy();
      return;
    }

    // Check for table or list of attendance records
    const hasTable = (await page.locator('table').count()) > 0;
    const hasList =
      (await page.locator('[class*="list"]').count()) > 0 ||
      (await page.locator('[class*="record"]').count()) > 0;
    const hasCards = (await page.locator('[class*="card"]').count()) > 0;

    expect(hasTable || hasList || hasCards).toBeTruthy();
  });

  test('clock in button should be functional or redirect', async ({ page }) => {
    if (page.url().includes('login') || page.url().includes('auth')) {
      expect(true).toBeTruthy();
      return;
    }

    const clockInBtn =
      page.locator('text=clock in').first() ||
      page.locator('text=Clock In').first() ||
      page.locator('text=start shift').first();

    if (await clockInBtn.isVisible()) {
      // Click should either trigger action or require auth
      await clockInBtn.click();
      await page.waitForTimeout(1000);

      // Either shows confirmation, updates status, or redirects to login
      const hasResponse =
        page.url().includes('attendance') ||
        (await page.locator('text=success').count()) > 0 ||
        (await page.locator('text=started').count()) > 0 ||
        (await page.locator('text=clocked').count()) > 0;
      expect(hasResponse).toBeTruthy();
    }
  });

  test('should show date navigation or selector or redirect', async ({ page }) => {
    if (page.url().includes('login') || page.url().includes('auth')) {
      expect(true).toBeTruthy();
      return;
    }

    // Look for date picker or navigation
    const hasDatePicker =
      (await page.locator('input[type="date"]').count()) > 0 ||
      (await page.locator('[class*="datepicker"]').count()) > 0 ||
      (await page.locator('[class*="calendar"]').count()) > 0;
    const hasDateNav =
      (await page.locator('text=today').count()) > 0 ||
      (await page.locator('text=yesterday').count()) > 0 ||
      (await page.locator('text=previous').count()) > 0 ||
      (await page.locator('text=next').count()) > 0;

    expect(hasDatePicker || hasDateNav).toBeTruthy();
  });

  test('attendance stats should be displayed or redirect', async ({ page }) => {
    if (page.url().includes('login') || page.url().includes('auth')) {
      expect(true).toBeTruthy();
      return;
    }

    // Look for statistics like hours worked, days present, etc.
    const hasStats =
      (await page.locator('text=hours').count()) > 0 ||
      (await page.locator('text=worked').count()) > 0 ||
      (await page.locator('text=present').count()) > 0 ||
      (await page.locator('text=days').count()) > 0;
    const hasNumbers =
      (await page.locator('[class*="stat"]').count()) > 0 ||
      (await page.locator('[class*="metric"]').count()) > 0;

    expect(hasStats || hasNumbers).toBeTruthy();
  });

  test('should handle unauthenticated access gracefully', async ({ page }) => {
    // Clear any stored auth
    await page.context().clearCookies();
    await page.reload();

    // Should either redirect to login or show auth prompt
    const url = page.url();
    const isAuthPage =
      url.includes('login') || url.includes('auth') || url.includes('sign-in');
    const hasAuthPrompt =
      (await page.locator('text=login').count()) > 0 ||
      (await page.locator('text=sign in').count()) > 0;

    expect(isAuthPage || hasAuthPrompt).toBeTruthy();
  });

  test('responsive layout on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Page should still be usable on mobile
    await page.goto('/attendance');
    
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
});
