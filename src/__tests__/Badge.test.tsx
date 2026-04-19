/**
 * Badge Component Tests
 *
 * Tests for the Badge component — variants, accessibility,
 * and rendering behavior.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Badge, badgeVariants } from '@/components/ui/badge';

describe('Badge', () => {
  describe('Rendering', () => {
    it('should render without crashing', () => {
      const { container } = render(<Badge>New</Badge>);
      expect(container).toBeInTheDocument();
    });

    it('should render with children text', () => {
      render(<Badge>Active</Badge>);
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should render as a div element', () => {
      render(<Badge>Test</Badge>);
      const badge = screen.getByText('Test');
      expect(badge.tagName).toBe('DIV');
    });

    it('should have rounded-full border classes', () => {
      const { container } = render(<Badge>Test</Badge>);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('rounded-full');
      expect(badge.className).toContain('border');
    });

    it('should have text-xs font-semibold classes', () => {
      const { container } = render(<Badge>Test</Badge>);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('text-xs');
      expect(badge.className).toContain('font-semibold');
    });
  });

  describe('Variant prop', () => {
    const variants = [
      'default',
      'secondary',
      'destructive',
      'outline',
      'success',
      'warning',
      'info',
      'purple',
      'pink',
    ] as const;

    variants.forEach((variant) => {
      it(`should render with variant "${variant}"`, () => {
        render(<Badge variant={variant}>{variant}</Badge>);
        expect(screen.getByText(variant)).toBeInTheDocument();
      });
    });

    it('should apply bg-primary for default variant', () => {
      const { container } = render(<Badge variant="default">Test</Badge>);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('bg-(--primary)');
    });

    it('should apply bg-success for success variant', () => {
      const { container } = render(<Badge variant="success">Success</Badge>);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('bg-[var(--success)]');
    });

    it('should apply bg-destructive for destructive variant', () => {
      const { container } = render(<Badge variant="destructive">Danger</Badge>);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('bg-[var(--destructive)]');
    });

    it('should apply bg-warning for warning variant', () => {
      const { container } = render(<Badge variant="warning">Warning</Badge>);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('bg-[var(--warning)]');
    });

    it('should apply bg-info for info variant', () => {
      const { container } = render(<Badge variant="info">Info</Badge>);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('bg-[var(--info)]');
    });

    it('should have border-transparent for default variant', () => {
      const { container } = render(<Badge variant="default">Test</Badge>);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('border-transparent');
    });

    it('should NOT have border-transparent for outline variant', () => {
      const { container } = render(<Badge variant="outline">Test</Badge>);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).not.toContain('border-transparent');
    });
  });

  describe('Accessibility', () => {
    it('should support aria-label', () => {
      render(
        <Badge aria-label="Status: active">Active</Badge>,
      );
      expect(screen.getByLabelText('Status: active')).toBeInTheDocument();
    });

    it('should support role attribute', () => {
      render(
        <Badge role="status">Loading</Badge>,
      );
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should support aria-hidden', () => {
      render(
        <Badge aria-hidden="true">Hidden</Badge>,
      );
      const badge = screen.getByText('Hidden');
      expect(badge).toHaveAttribute('aria-hidden', 'true');
    });

    it('should support custom data attributes', () => {
      render(
        <Badge data-testid="custom-badge">Test</Badge>,
      );
      expect(screen.getByTestId('custom-badge')).toBeInTheDocument();
    });

    it('should support custom className', () => {
      const { container } = render(<Badge className="my-badge">Test</Badge>);
      expect(container.firstChild).toHaveClass('my-badge');
    });

    it('should focus outline with focus:ring-2', () => {
      const { container } = render(<Badge tabIndex={0}>Focusable</Badge>);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('focus:ring-2');
    });
  });

  describe('User interactions', () => {
    it('should handle click events', () => {
      const handleClick = jest.fn();
      render(
        <Badge onClick={handleClick} role="button" tabIndex={0}>
          Clickable
        </Badge>,
      );
      screen.getByText('Clickable').click();
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should handle mouse enter events', () => {
      const handleMouseEnter = jest.fn();
      render(
        <Badge onMouseEnter={handleMouseEnter}>Hover me</Badge>,
      );
      const badge = screen.getByText('Hover me');
      // fireEvent.mouseEnter properly triggers React's synthetic event
      const { fireEvent } = require('@testing-library/react');
      fireEvent.mouseEnter(badge);
      expect(handleMouseEnter).toHaveBeenCalled();
    });
  });

  describe('badgeVariants helper', () => {
    it('should export badgeVariants function', () => {
      expect(badgeVariants).toBeDefined();
      expect(typeof badgeVariants).toBe('function');
    });

    it('should return class string for default variant', () => {
      const result = badgeVariants();
      expect(typeof result).toBe('string');
      expect(result).toContain('rounded-full');
    });

    it('should apply variant classes', () => {
      const result = badgeVariants({ variant: 'success' });
      expect(result).toContain('bg-[var(--success)]');
    });

    it('should append custom className', () => {
      const result = badgeVariants({ className: 'my-custom-class' });
      expect(result).toContain('my-custom-class');
    });
  });

  describe('Common use cases', () => {
    it('should render as a status indicator', () => {
      render(<Badge variant="success">Approved</Badge>);
      const badge = screen.getByText('Approved');
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('bg-[var(--success)]');
    });

    it('should render as a count badge', () => {
      render(<Badge variant="default">5</Badge>);
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should render as a tag/label', () => {
      render(<Badge variant="purple">React</Badge>);
      const badge = screen.getByText('React');
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('bg-[var(--purple)]');
    });

    it('should combine with inline-flex for proper layout', () => {
      const { container } = render(<Badge>Test</Badge>);
      expect(container.firstChild).toHaveClass('inline-flex');
    });
  });
});
