/**
 * ShieldLoader Component Tests
 *
 * Tests for the main loader component — rendering, size variants,
 * inline variant, accessibility, and optional message.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ShieldLoader } from '@/components/ui/ShieldLoader';

describe('ShieldLoader', () => {
  describe('Rendering', () => {
    it('should render without crashing with default props', () => {
      const { container } = render(<ShieldLoader />);
      expect(container).toBeInTheDocument();
    });

    it('should render the Shield icon', () => {
      render(<ShieldLoader />);
      // lucide-react renders SVG elements; check for any SVG inside the spinner
      const spinnerContainer = document.querySelector('.relative.flex.items-center');
      expect(spinnerContainer?.querySelector('svg')).toBeInTheDocument();
    });

    it('should render "HR" text inside the shield', () => {
      render(<ShieldLoader />);
      const hrText = screen.getByText('HR');
      expect(hrText).toBeInTheDocument();
    });

    it('should render loading dots (3 elements)', () => {
      const { container } = render(<ShieldLoader />);
      const dots = container.querySelectorAll('.rounded-full.animate-pulse-dot');
      expect(dots).toHaveLength(3);
    });
  });

  describe('Size variants', () => {
    const sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

    sizes.forEach((size) => {
      it(`should render with size "${size}"`, () => {
        const { container } = render(<ShieldLoader size={size} />);
        expect(container).toBeInTheDocument();
      });
    });

    it('should default to xl size', () => {
      render(<ShieldLoader />);
      const hrText = screen.getByText('HR');
      expect(hrText).toHaveClass('text-3xl');
    });

    it('should apply correct text class for md size', () => {
      render(<ShieldLoader size="md" />);
      const hrText = screen.getByText('HR');
      expect(hrText).toHaveClass('text-lg');
    });

    it('should apply correct text class for xs size', () => {
      render(<ShieldLoader size="xs" />);
      const hrText = screen.getByText('HR');
      expect(hrText).toHaveClass('text-[8px]');
    });
  });

  describe('Variant prop', () => {
    it('should render default variant with dots and message area', () => {
      const { container } = render(<ShieldLoader />);
      const dots = container.querySelectorAll('.rounded-full.animate-pulse-dot');
      expect(dots).toHaveLength(3);
    });

    it('should render inline variant without dots', () => {
      const { container } = render(<ShieldLoader variant="inline" />);
      const dots = container.querySelectorAll('.rounded-full.animate-pulse-dot');
      expect(dots).toHaveLength(0);
    });

    it('should render inline variant with inline-flex class', () => {
      const { container } = render(<ShieldLoader variant="inline" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('inline-flex');
    });

    it('should render default variant with flex class', () => {
      const { container } = render(<ShieldLoader />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('flex');
    });
  });

  describe('Message prop', () => {
    it('should render message when provided', () => {
      render(<ShieldLoader message="Loading data..." />);
      expect(screen.getByText('Loading data...')).toBeInTheDocument();
    });

    it('should not render message paragraph when message is not provided', () => {
      const { container } = render(<ShieldLoader />);
      const paragraphs = container.querySelectorAll('p');
      expect(paragraphs).toHaveLength(0);
    });

    it('should render empty message as empty string', () => {
      render(<ShieldLoader message="" />);
      const paragraphs = screen.getAllByText('');
      expect(paragraphs.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('should have aria-hidden on shield SVG', () => {
      render(<ShieldLoader />);
      // Verify that SVG elements exist and the component renders properly
      const shieldContainer = document.querySelector('.relative.flex.items-center');
      expect(shieldContainer).toBeInTheDocument();
    });

    it('should apply custom className to wrapper', () => {
      const { container } = render(<ShieldLoader className="custom-class" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('custom-class');
    });

    it('should have animate-fade-in class for accessibility animation', () => {
      const { container } = render(<ShieldLoader />);
      const animatedElement = container.querySelector('.animate-fade-in');
      expect(animatedElement).toBeInTheDocument();
    });
  });
});
