/**
 * Button Component Tests
 *
 * Tests for the shadcn/ui Button component — variants, sizes,
 * asChild prop, accessibility, and user interactions.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, buttonVariants } from '@/components/ui/button';

describe('Button', () => {
  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should render with children text', () => {
      render(<Button>Submit</Button>);
      expect(screen.getByText('Submit')).toBeInTheDocument();
    });

    it('should render as a native button element', () => {
      render(<Button>Test</Button>);
      expect(screen.getByRole('button', { name: /test/i })).toBeInTheDocument();
    });

    it('should render with SVG icon children', () => {
      render(
        <Button>
          <svg data-testid="icon" />
          Icon Button
        </Button>,
      );
      expect(screen.getByTestId('icon')).toBeInTheDocument();
      expect(screen.getByText('Icon Button')).toBeInTheDocument();
    });
  });

  describe('Variant prop', () => {
    const variants = [
      'default',
      'destructive',
      'outline',
      'secondary',
      'ghost',
      'link',
      'cta',
      'ctaSecondary',
      'glass',
      'success',
      'warning',
      'info',
    ] as const;

    variants.forEach((variant) => {
      it(`should render with variant "${variant}"`, () => {
        render(<Button variant={variant}>Test</Button>);
        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute('data-variant', variant);
      });
    });

    it('should default to "default" variant', () => {
      render(<Button>Test</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'default');
    });

    it('should apply primary classes for default variant', () => {
      render(<Button>Test</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-primary');
    });

    it('should apply destructive classes for destructive variant', () => {
      render(<Button variant="destructive">Delete</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-destructive');
    });
  });

  describe('Size prop', () => {
    const sizes = [
      'default',
      'xs',
      'sm',
      'lg',
      'xl',
      '2xl',
      'icon',
      'icon-xs',
      'icon-sm',
      'icon-lg',
    ] as const;

    sizes.forEach((size) => {
      it(`should render with size "${size}"`, () => {
        render(<Button size={size}>Test</Button>);
        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute('data-size', size);
      });
    });

    it('should default to "default" size', () => {
      render(<Button>Test</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('data-size', 'default');
    });

    it('should apply h-9 height for default size', () => {
      render(<Button>Test</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('h-9');
    });

    it('should apply h-10 height for lg size', () => {
      render(<Button size="lg">Test</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('h-10');
    });
  });

  describe('asChild prop', () => {
    it('should render as a custom element when asChild is true', () => {
      render(
        <Button asChild>
          <a href="/link">Link Button</a>
        </Button>,
      );
      expect(screen.getByRole('link', { name: /link button/i })).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should merge slot attributes when asChild is true', () => {
      render(
        <Button asChild data-testid="custom-button">
          <span>As Child</span>
        </Button>,
      );
      const element = screen.getByTestId('custom-button');
      expect(element).toHaveAttribute('data-slot', 'button');
      expect(element).toHaveTextContent('As Child');
    });

    it('should not render as button when asChild is true with anchor', () => {
      render(
        <Button asChild>
          <a href="/">Home</a>
        </Button>,
      );
      const link = screen.getByRole('link');
      expect(link.tagName).toBe('A');
    });
  });

  describe('Accessibility', () => {
    it('should have data-slot="button" attribute', () => {
      render(<Button>Test</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('data-slot', 'button');
    });

    it('should be disabled and have opacity when disabled prop is set', () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('disabled');
    });

    it('should support aria-label', () => {
      render(<Button aria-label="Custom label">Test</Button>);
      expect(screen.getByLabelText('Custom label')).toBeInTheDocument();
    });

    it('should support aria-describedby', () => {
      render(
        <>
          <span id="desc">Description text</span>
          <Button aria-describedby="desc">Test</Button>
        </>,
      );
      expect(screen.getByRole('button')).toHaveAttribute('aria-describedby', 'desc');
    });

    it('should render as a button element by default', () => {
      render(<Button>Test</Button>);
      const button = screen.getByRole('button');
      expect(button.tagName).toBe('BUTTON');
    });

    it('should support custom type attribute', () => {
      render(<Button type="submit">Submit</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
    });
  });

  describe('User interactions', () => {
    it('should handle click events', async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();
      render(
        <Button onClick={handleClick}>
          Click me
        </Button>,
      );
      await user.click(screen.getByRole('button', { name: /click me/i }));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple clicks', async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();
      render(
        <Button onClick={handleClick}>
          Click me
        </Button>,
      );
      const button = screen.getByRole('button', { name: /click me/i });
      await user.click(button);
      await user.click(button);
      await user.click(button);
      expect(handleClick).toHaveBeenCalledTimes(3);
    });

    it('should not fire click when disabled', async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();
      render(
        <Button onClick={handleClick} disabled>
          Disabled
        </Button>,
      );
      const button = screen.getByRole('button', { name: /disabled/i });
      await user.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should handle mouse down events', async () => {
      const user = userEvent.setup();
      const handleMouseDown = jest.fn();
      render(
        <Button onMouseDown={handleMouseDown}>
          Test
        </Button>,
      );
      await user.pointer({ keys: '[MouseLeft>]', target: screen.getByRole('button') });
      expect(handleMouseDown).toHaveBeenCalled();
    });
  });

  describe('buttonVariants helper', () => {
    it('should export buttonVariants function', () => {
      expect(buttonVariants).toBeDefined();
      expect(typeof buttonVariants).toBe('function');
    });

    it('should return class string for default variant', () => {
      const result = buttonVariants();
      expect(typeof result).toBe('string');
      expect(result).toContain('bg-primary');
    });

    it('should combine variant and size classes', () => {
      const result = buttonVariants({ variant: 'destructive', size: 'lg' });
      expect(result).toContain('bg-destructive');
      expect(result).toContain('h-10');
    });

    it('should append custom className', () => {
      const result = buttonVariants({ className: 'my-custom-class' });
      expect(result).toContain('my-custom-class');
    });
  });
});
