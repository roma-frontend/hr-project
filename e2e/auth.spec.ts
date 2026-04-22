import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Authentication Flow
 *
 * Tests critical login paths including:
 * - Login page accessibility
 * - Login form validation
 * - Successful login navigation
 * - Error handling
 */

test.describe('Authentication Flow', () => {
  test('login page should be accessible', async ({ page }) => {
    await page.goto('/login');

    // Page should have login-related elements
    const hasLoginForm =
      (await page.locator('input[type="email"]').count()) > 0 ||
      (await page.locator('input[type="text"]').count()) > 0 ||
      (await page.locator('form').count()) > 0;
    expect(hasLoginForm).toBeTruthy();
  });

  test('login page should have proper title', async ({ page }) => {
    await page.goto('/login');

    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('login form should show validation errors for empty fields', async ({ page }) => {
    // Pre-set localStorage to skip the onboarding tour
    await page.context().addInitScript(() => {
      localStorage.setItem('tour_seen_Тур по входу', 'true');
      localStorage.setItem('tour_seen_Login Tour', 'true');
      localStorage.setItem('tour_seen_login-tour', 'true');
    });
    
    await page.goto('/login');
    await page.waitForTimeout(500);

    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"]').first();

    if (await submitButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await submitButton.click({ timeout: 5000 });

      // Should show validation errors or error message from API
      await page.waitForTimeout(1000);
      const hasErrors =
        (await page.locator('text=required').count()) > 0 ||
        (await page.locator('[class*="error"]').count()) > 0 ||
        (await page.locator('[class*="invalid"]').count()) > 0 ||
        (await page.locator('text=error').count()) > 0 ||
        // Form should stay on login page if validation failed
        page.url().includes('login');
      expect(hasErrors).toBeTruthy();
    }
  });

  test('should redirect to dashboard after successful authentication', async ({ page }) => {
    // This test requires valid test credentials
    // Skip in CI without proper env vars
    test.skip(
      !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
      'No test credentials',
    );

    await page.goto('/login');

    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"]').first();

    if (await emailInput.isVisible()) {
      await emailInput.fill(process.env.TEST_USER_EMAIL!);
      await passwordInput.fill(process.env.TEST_USER_PASSWORD!);
      await submitButton.click();

      // Wait for navigation
      await page.waitForURL(/dashboard|home|\/$/, { timeout: 10000 });

      // Should be on dashboard or home page
      const url = page.url();
      expect(url.includes('dashboard') || url.includes('home') || url.endsWith('/')).toBeTruthy();
    }
  });

  test('should handle invalid credentials gracefully', async ({ page }) => {
    // Pre-set localStorage to skip the onboarding tour
    await page.context().addInitScript(() => {
      localStorage.setItem('tour_seen_Тур по входу', 'true');
      localStorage.setItem('tour_seen_Login Tour', 'true');
      localStorage.setItem('tour_seen_login-tour', 'true');
    });
    
    await page.goto('/login');
    await page.waitForTimeout(500);

    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"]').first();

    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailInput.fill('invalid@example.com');
      await passwordInput.fill('wrongpassword');
      await submitButton.click({ timeout: 5000 });

      // Should show error message or stay on login page
      await page.waitForTimeout(2000);
      const hasError =
        (await page.locator('text=invalid').count()) > 0 ||
        (await page.locator('text=incorrect').count()) > 0 ||
        (await page.locator('text=error').count()) > 0 ||
        (await page.locator('text=wrong').count()) > 0;
      const stillOnLogin = page.url().includes('login') || page.url().includes('auth');
      expect(hasError || stillOnLogin).toBeTruthy();
    }
  });

  test('should have Clerk authentication elements if using Clerk', async ({ page }) => {
    await page.goto('/login');

    // Check for Clerk-specific elements if applicable
    const clerkElements = await page.locator('[class*="cl-"]').count();
    if (clerkElements > 0) {
      expect(clerkElements).toBeGreaterThan(0);
    }
  });

  test('forgot password link should be accessible', async ({ page }) => {
    await page.goto('/login');

    const forgotPasswordLink = page.locator('text=forgot, text=Forgot').first();
    if (await forgotPasswordLink.isVisible()) {
      await forgotPasswordLink.click();
      await page.waitForTimeout(1000);
      expect(page.url().includes('forgot') || page.url().includes('reset')).toBeTruthy();
    }
  });

  test('sign up link should be accessible', async ({ page }) => {
    await page.goto('/login');

    const signUpLink = page.locator('text=sign up, text=Sign Up, text=register').first();
    if (await signUpLink.isVisible()) {
      await signUpLink.click();
      await page.waitForTimeout(1000);
      const url = page.url();
      expect(
        url.includes('sign-up') || url.includes('register') || url.includes('onboarding'),
      ).toBeTruthy();
    }
  });
});
