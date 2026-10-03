import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import Navbar from '@/components/landing/Navbar';

jest.mock('@/components/landing/useLandingTranslation', () => ({
  useLandingTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/components/ThemeProvider', () => ({
  useTheme: () => ({ theme: 'light', setTheme: jest.fn() }),
}));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: () => ({ user: null, logout: jest.fn(), beginSignOut: jest.fn() }),
}));
jest.mock('@/actions/auth', () => ({ logoutAction: jest.fn() }));
jest.mock('next-auth/react', () => ({ signOut: jest.fn() }));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/',
}));
jest.mock('next/dynamic', () => () => () => <button>Menu</button>);
jest.mock('@/components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <button>Language</button>,
}));
jest.mock('@/hooks/useActiveSection', () => ({ useActiveSection: () => 'home' }));
jest.mock('@/hooks/useHydrated', () => ({ useHydrated: () => true }));
jest.mock('@/store/useCommandPaletteStore', () => ({
  useCommandPaletteStore: (selector: any) => selector({ openPalette: jest.fn() }),
}));

let frame: FrameRequestCallback | null;
function flush() {
  act(() => {
    const callback = frame;
    frame = null;
    callback?.(0);
  });
}
function scroll(top: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: top });
  fireEvent.scroll(window);
  flush();
}

beforeEach(() => {
  frame = null;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    value: 5000,
  });
  document.body.style.overflow = '';
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    frame = cb;
    return 1;
  });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
    frame = null;
  });
});
afterEach(() => jest.restoreAllMocks());

it('moves all header content with an animated transform and preserves island shape while hiding', () => {
  render(<Navbar />);
  flush();
  const nav = screen.getByRole('navigation');
  const card = screen.getByTestId('landing-navbar-card');
  expect(nav.style.transition).toContain('transform 520ms');
  expect(nav.style.transform).toBe('translateY(0)');
  scroll(200);
  expect(nav).toHaveAttribute('aria-hidden', 'true');
  expect(nav).toHaveAttribute('inert');
  expect(nav.style.transform).toBe('translateY(calc(-100% - 20px))');
  scroll(175);
  expect(nav).not.toHaveAttribute('aria-hidden');
  expect(nav).toHaveAttribute('data-mode', 'island');
  expect(card.style.maxWidth).toBe('1140px');
  scroll(250);
  expect(nav).toHaveAttribute('aria-hidden', 'true');
  expect(nav).toHaveAttribute('data-mode', 'island');
  expect(card.style.maxWidth).toBe('1140px');
  expect(card.style.transition).not.toBe('none');
  scroll(225);
  scroll(0);
  expect(nav).toHaveAttribute('data-mode', 'full');
  expect(nav).not.toHaveAttribute('inert');
  expect(card.style.maxWidth).toBe('100vw');
  expect(nav.style.transition).toContain('padding 520ms');
  expect(card.style.transition).toContain('max-width 520ms');
});

it('clips progress to the full inherited rounded surface without clipping menus or border warnings', () => {
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  render(<Navbar />);
  flush();
  scroll(400);
  scroll(350);
  const card = screen.getByTestId('landing-navbar-card');
  const progress = screen.getByTestId('landing-navbar-progress');
  expect(card.style.overflow).toBe('visible');
  expect(progress.className).toContain('inset-0');
  expect(progress.className).toContain('overflow-hidden');
  expect(progress.style.borderRadius).toBe('inherit');
  expect((progress.firstElementChild as HTMLElement).style.transform).toMatch(/^scaleX\(/);
  scroll(0);
  scroll(400);
  scroll(350);
  expect(errors).not.toHaveBeenCalled();
});

it('holds through small reversals, stays visible for focused links/open menus, and resets on mobile resize', () => {
  render(<Navbar />);
  flush();
  scroll(200);
  scroll(195);
  expect(screen.getByRole('navigation', { hidden: true })).toHaveAttribute('aria-hidden', 'true');
  scroll(175);
  const nav = screen.getByRole('navigation');
  document.body.style.overflow = 'hidden';
  scroll(300);
  expect(nav).not.toHaveAttribute('aria-hidden');
  document.body.style.overflow = '';
  act(() => (nav.querySelector('a') as HTMLElement).focus());
  scroll(400);
  expect(nav).not.toHaveAttribute('aria-hidden');
  act(() => (document.activeElement as HTMLElement).blur());
  scroll(500);
  expect(nav).toHaveAttribute('aria-hidden', 'true');
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  fireEvent.resize(window);
  flush();
  expect(nav).not.toHaveAttribute('aria-hidden');
  expect(nav).toHaveAttribute('data-mode', 'full');
});

it('cancels a pending animation frame on unmount', () => {
  const { unmount } = render(<Navbar />);
  unmount();
  expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1);
  expect(frame).toBeNull();
});
