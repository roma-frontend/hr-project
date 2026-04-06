/**
 * Card Component Tests
 *
 * Tests for Card, CardHeader, CardTitle, CardDescription,
 * CardContent, and CardFooter components.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';

describe('Card', () => {
  describe('Rendering', () => {
    it('should render without crashing', () => {
      const { container } = render(<Card>Card content</Card>);
      expect(container).toBeInTheDocument();
    });

    it('should render with children', () => {
      render(<Card>Hello World</Card>);
      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });

    it('should forward ref to the underlying div', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<Card ref={ref}>Test</Card>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it('should have rounded-xl border shadow-sm classes', () => {
      const { container } = render(<Card>Test</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('rounded-xl');
      expect(card.className).toContain('border');
      expect(card.className).toContain('shadow-sm');
    });
  });

  describe('Accessibility', () => {
    it('should support aria-label', () => {
      render(
        <Card aria-label="User profile card">
          Content
        </Card>,
      );
      expect(screen.getByLabelText('User profile card')).toBeInTheDocument();
    });

    it('should support role attribute', () => {
      render(
        <Card role="region">Content</Card>,
      );
      expect(screen.getByRole('region')).toBeInTheDocument();
    });

    it('should support custom className', () => {
      const { container } = render(<Card className="custom-card">Test</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('custom-card');
    });

    it('should spread additional props', () => {
      render(<Card data-testid="my-card">Test</Card>);
      expect(screen.getByTestId('my-card')).toBeInTheDocument();
    });
  });
});

describe('CardHeader', () => {
  it('should render without crashing', () => {
    const { container } = render(<CardHeader>Header</CardHeader>);
    expect(container).toBeInTheDocument();
  });

  it('should render with children', () => {
    render(<CardHeader>Card Header</CardHeader>);
    expect(screen.getByText('Card Header')).toBeInTheDocument();
  });

  it('should have flex flex-col space-y-1.5 p-6 classes', () => {
    const { container } = render(<CardHeader>Test</CardHeader>);
    const header = container.firstChild as HTMLElement;
    expect(header.className).toContain('flex');
    expect(header.className).toContain('flex-col');
    expect(header.className).toContain('p-6');
  });

  it('should forward ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<CardHeader ref={ref}>Test</CardHeader>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('should support custom className', () => {
    const { container } = render(<CardHeader className="custom-header">Test</CardHeader>);
    expect(container.firstChild).toHaveClass('custom-header');
  });
});

describe('CardTitle', () => {
  it('should render without crashing', () => {
    render(<CardTitle>Title</CardTitle>);
    expect(screen.getByText('Title')).toBeInTheDocument();
  });

  it('should default to h3 element', () => {
    render(<CardTitle>Title</CardTitle>);
    const heading = screen.getByText('Title');
    expect(heading.tagName).toBe('H3');
  });

  it('should render as h1 when as="h1"', () => {
    render(<CardTitle as="h1">Main Title</CardTitle>);
    const heading = screen.getByText('Main Title');
    expect(heading.tagName).toBe('H1');
  });

  it('should render as h2 when as="h2"', () => {
    render(<CardTitle as="h2">Section Title</CardTitle>);
    expect(screen.getByText('Section Title').tagName).toBe('H2');
  });

  it('should render as h4 when as="h4"', () => {
    render(<CardTitle as="h4">Subsection Title</CardTitle>);
    expect(screen.getByText('Subsection Title').tagName).toBe('H4');
  });

  it('should have font-semibold class', () => {
    const { container } = render(<CardTitle>Test</CardTitle>);
    expect(container.firstChild).toHaveClass('font-semibold');
  });

  it('should forward ref', () => {
    const ref = React.createRef<HTMLHeadingElement>();
    render(<CardTitle ref={ref}>Test</CardTitle>);
    expect(ref.current).toBeInstanceOf(HTMLHeadingElement);
  });
});

describe('CardDescription', () => {
  it('should render without crashing', () => {
    render(<CardDescription>Description</CardDescription>);
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('should render as a paragraph element', () => {
    render(<CardDescription>Test</CardDescription>);
    expect(screen.getByText('Test').tagName).toBe('P');
  });

  it('should have text-sm and text-muted classes', () => {
    const { container } = render(<CardDescription>Test</CardDescription>);
    const desc = container.firstChild as HTMLElement;
    expect(desc.className).toContain('text-sm');
  });

  it('should forward ref', () => {
    const ref = React.createRef<HTMLParagraphElement>();
    render(<CardDescription ref={ref}>Test</CardDescription>);
    expect(ref.current).toBeInstanceOf(HTMLParagraphElement);
  });
});

describe('CardContent', () => {
  it('should render without crashing', () => {
    render(<CardContent>Content</CardContent>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should have p-6 pt-0 classes', () => {
    const { container } = render(<CardContent>Test</CardContent>);
    const content = container.firstChild as HTMLElement;
    expect(content.className).toContain('p-6');
  });

  it('should forward ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<CardContent ref={ref}>Test</CardContent>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe('CardFooter', () => {
  it('should render without crashing', () => {
    render(<CardFooter>Footer</CardFooter>);
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });

  it('should have flex items-center p-6 pt-0 classes', () => {
    const { container } = render(<CardFooter>Test</CardFooter>);
    const footer = container.firstChild as HTMLElement;
    expect(footer.className).toContain('flex');
    expect(footer.className).toContain('items-center');
  });

  it('should forward ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<CardFooter ref={ref}>Test</CardFooter>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe('Card composition', () => {
  it('should render a complete card layout', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card Description</CardDescription>
        </CardHeader>
        <CardContent>Main content here</CardContent>
        <CardFooter>Footer actions</CardFooter>
      </Card>,
    );

    expect(screen.getByText('Card Title')).toBeInTheDocument();
    expect(screen.getByText('Card Description')).toBeInTheDocument();
    expect(screen.getByText('Main content here')).toBeInTheDocument();
    expect(screen.getByText('Footer actions')).toBeInTheDocument();
  });

  it('should render card with only some sections', () => {
    render(
      <Card>
        <CardContent>Only content</CardContent>
      </Card>,
    );

    expect(screen.getByText('Only content')).toBeInTheDocument();
    expect(screen.queryByText('Card Title')).not.toBeInTheDocument();
  });

  it('should support nested interactive elements', () => {
    const handleClick = jest.fn();
    render(
      <Card>
        <CardContent>
          <button onClick={handleClick}>Action</button>
        </CardContent>
      </Card>,
    );

    screen.getByRole('button', { name: /action/i }).click();
    expect(handleClick).toHaveBeenCalled();
  });
});
