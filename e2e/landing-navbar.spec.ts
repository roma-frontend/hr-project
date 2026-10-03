import { test, expect } from '@playwright/test';

test('landing header animates as one surface and keeps its progress inside the morphing card', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const styleWarnings: string[] = [];
  page.on('console', (message) => {
    if (/conflicting property|Removing a style property/.test(message.text())) {
      styleWarnings.push(message.text());
    }
  });
  await page.goto('/');
  const nav = page.locator('nav[aria-label="Main navigation"]');
  const card = page.getByTestId('landing-navbar-card');
  const progress = page.getByTestId('landing-navbar-progress');
  await expect(nav).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollHeight))
    .toBeGreaterThan(1500);
  // Move away from the header so hover menus cannot lock the page during scroll.
  await page.mouse.move(1300, 800);
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, 500);
  });
  await expect(nav).toHaveAttribute('aria-hidden', 'true');
  const departing = await nav.evaluate(async (el) => {
    let box = el.getBoundingClientRect();
    for (let i = 0; i < 120 && box.bottom >= box.height; i++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      box = el.getBoundingClientRect();
    }
    return {
      bottom: box.bottom,
      height: box.height,
      transition: getComputedStyle(el).transitionProperty,
      transform: getComputedStyle(el).transform,
      animation: getComputedStyle(el).animation,
      inline: (el as HTMLElement).style.transform,
      y: window.scrollY,
    };
  });
  expect(departing.transition).toContain('transform');
  expect(departing.bottom).toBeGreaterThan(-20);
  expect(departing.bottom).toBeLessThan(departing.height);
  await expect
    .poll(async () => (await nav.boundingBox())!.y + (await nav.boundingBox())!.height)
    .toBeLessThan(0);

  await page.evaluate(() => window.scrollTo(0, 400));
  await expect(nav).toHaveAttribute('data-mode', 'island');
  await expect(nav).not.toHaveAttribute('aria-hidden');
  await expect
    .poll(() => card.evaluate((el) => Math.round(el.getBoundingClientRect().width)))
    .toBe(1140);
  await expect
    .poll(() => progress.evaluate((el) => getComputedStyle(el).borderRadius))
    .toBe('20px');
  expect(await progress.evaluate((el) => getComputedStyle(el).overflow)).toBe('hidden');
  const boxes = await card.evaluate((el) => {
    const card = el.getBoundingClientRect();
    const progress = el
      .querySelector('[data-testid="landing-navbar-progress"]')!
      .getBoundingClientRect();
    return {
      card: { left: card.left, right: card.right, top: card.top, bottom: card.bottom },
      progress: {
        left: progress.left,
        right: progress.right,
        top: progress.top,
        bottom: progress.bottom,
      },
    };
  });
  expect(boxes.progress.left).toBeGreaterThanOrEqual(boxes.card.left);
  expect(boxes.progress.right).toBeLessThanOrEqual(boxes.card.right);
  expect(boxes.progress.bottom).toBeLessThanOrEqual(boxes.card.bottom);

  // A new downward gesture must hide the same island, not expand it mid-flight.
  await page.evaluate(() => window.scrollTo(0, 500));
  await expect(nav).toHaveAttribute('aria-hidden', 'true');
  await expect(nav).toHaveAttribute('data-mode', 'island');
  await page.waitForTimeout(550);
  await page.evaluate(() => window.scrollTo(0, 400));
  await expect(nav).not.toHaveAttribute('aria-hidden');
  await page.waitForTimeout(550);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(nav).toHaveAttribute('data-mode', 'full');
  const expandingWidth = await card.evaluate(async (el) => {
    let width = el.getBoundingClientRect().width;
    for (let i = 0; i < 120 && width <= 1140; i++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      width = el.getBoundingClientRect().width;
    }
    return width;
  });
  expect(expandingWidth).toBeGreaterThan(1140);
  expect(expandingWidth).toBeLessThan(1440);
  await expect
    .poll(() => card.evaluate((el) => Math.round(el.getBoundingClientRect().width)))
    .toBe(1440);
  expect(styleWarnings).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 500));
  await expect(nav).not.toHaveAttribute('aria-hidden');
  await expect(nav).toHaveAttribute('data-mode', 'full');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await nav.evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration)),
  ).toBeLessThan(0.01);
});
