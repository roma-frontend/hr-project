/**
 * CSS-based Animation Components
 * Replacement for Framer Motion
 */

import React, { useState, useEffect, useRef } from 'react';

interface MotionProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  layout?: boolean;
  initial?: {
    opacity?: number;
    x?: number | string;
    y?: number | string;
    scale?: number;
    width?: number | string;
    height?: number | string;
    rotate?: number;
  };
  animate?: {
    opacity?: number;
    x?: number | string;
    y?: number | string;
    scale?: number;
    width?: number | string;
    height?: number | string;
    rotate?: number;
  };
  exit?: {
    opacity?: number;
    x?: number | string;
    y?: number | string;
    scale?: number;
    width?: number | string;
    height?: number | string;
    rotate?: number;
  };
  transition?: {
    duration?: number;
    delay?: number;
    ease?: 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear' | string;
  };
  whileHover?: {
    scale?: number;
    x?: number;
    y?: number;
    rotate?: number;
    background?: string;
    opacity?: number;
  };
  whileTap?: {
    scale?: number;
    rotate?: number;
  };
  onAnimationComplete?: () => void;
}

/**
 * MotionDiv - Drop-in replacement for motion.div
 * Uses CSS animations instead of Framer Motion
 */
export function MotionDiv({
  children,
  className = '',
  initial,
  animate,
  exit,
  transition = { duration: 0.3 },
  whileHover,
  whileTap,
  onAnimationComplete,
  layout,
  onClick,
  ...restProps
}: MotionProps) {
  const [exiting, setExiting] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // Use layout effect to avoid cascading renders
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (exit && exiting && onAnimationComplete) {
      const timer = setTimeout(onAnimationComplete, (transition.duration || 0.3) * 1000);
      return () => clearTimeout(timer);
    }
  }, [exiting, exit, onAnimationComplete, transition.duration]);

  // Handle layout animation (simplified - just applies transition)
  const layoutClass = layout ? 'transition-all duration-300' : '';

  // Build animation classes
  const getAnimationClass = () => {
    if (exiting && exit) {
      if (exit.opacity === 0) return 'animate-fade-out';
      if (exit.scale && exit.scale < 1) return 'animate-scale-out';
      if (exit.y && typeof exit.y === 'string' && exit.y.includes('-')) return 'animate-slide-down';
      if (exit.y) return 'animate-slide-up';
    }
    
    if (mounted && animate) {
      if (animate.opacity === 1) return 'animate-fade-in';
      if (animate.scale && animate.scale > 1) return 'animate-scale-in';
      if (animate.y && typeof animate.y === 'string' && animate.y.includes('-')) return 'animate-slide-down';
      if (animate.y) return 'animate-slide-up';
      if (animate.x && typeof animate.x === 'string' && animate.x.includes('-')) return 'animate-slide-in-left';
      if (animate.x) return 'animate-slide-in-right';
    }

    return '';
  };

  // Build hover/tap classes
  const getInteractiveClasses = () => {
    const classes: string[] = [];
    
    if (whileHover?.scale) {
      classes.push(`hover:scale-[${whileHover.scale}]`);
    }
    if (whileHover?.x) {
      classes.push(`hover:translate-x-[${whileHover.x}px]`);
    }
    if (whileHover?.y) {
      classes.push(`hover:translate-y-[${whileHover.y}px]`);
    }
    if (whileTap?.scale) {
      classes.push(`active:scale-[${whileTap.scale}]`);
    }
    
    return classes.join(' ');
  };

  // Build inline styles for animate/exit states
  const getAnimateStyle = () => {
    const style: React.CSSProperties = {};

    if (exiting && exit) {
      if (exit.width !== undefined) {
        style.width = typeof exit.width === 'number' ? `${exit.width}px` : exit.width;
      }
      if (exit.opacity !== undefined) style.opacity = exit.opacity;
    } else if (mounted && animate) {
      if (animate.width !== undefined) {
        style.width = typeof animate.width === 'number' ? `${animate.width}px` : animate.width;
      }
      if (animate.opacity !== undefined) style.opacity = animate.opacity;
    }

    return style;
  };

  // Build inline styles for initial state
  const getInitialStyle = () => {
    if (!initial || exiting) return {};

    const style: React.CSSProperties = {};
    if (initial.opacity !== undefined) style.opacity = initial.opacity;
    if (initial.width !== undefined) {
      style.width = typeof initial.width === 'number' ? `${initial.width}px` : initial.width;
    }
    if (initial.x !== undefined) {
      style.transform = `translateX(${typeof initial.x === 'number' ? `${initial.x}px` : initial.x})`;
    }
    if (initial.y !== undefined) {
      style.transform = `${style.transform || ''} translateY(${typeof initial.y === 'number' ? `${initial.y}px` : initial.y})`.trim();
    }
    if (initial.scale !== undefined) style.transform = `${style.transform || ''} scale(${initial.scale})`.trim();

    return style;
  };

  const animationClass = getAnimationClass();
  const interactiveClass = getInteractiveClasses();

  if (exiting) {
    return (
      <div
        ref={elementRef}
        className={`${className} ${animationClass} ${layoutClass}`}
        style={{
          ...getInitialStyle(),
          ...getAnimateStyle(),
          transition: `all ${transition.duration || 0.3}s ${transition.ease || 'ease-in-out'}`,
        }}
        onClick={onClick}
        {...restProps}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      ref={elementRef}
      className={`${className} ${animationClass} ${interactiveClass} ${layoutClass}`}
      style={{
        ...getInitialStyle(),
        ...getAnimateStyle(),
        transitionDuration: `${(transition.duration || 0.3) * 1000}ms`,
        transitionDelay: `${(transition.delay || 0) * 1000}ms`,
      }}
      onClick={onClick}
      {...restProps}
    >
      {children}
    </div>
  );
}

/**
 * AnimatePresence - Replacement for Framer Motion's AnimatePresence
 * Handles exit animations for unmounting components
 */
interface AnimatePresenceProps {
  children: React.ReactNode;
  mode?: 'sync' | 'wait';
}

export function AnimatePresence({ children }: AnimatePresenceProps) {
  return <>{children}</>;
}

// Re-export common motion components as MotionDiv
export const motion = {
  div: MotionDiv,
  button: MotionDiv,
  span: MotionDiv,
  p: MotionDiv,
  aside: MotionDiv,
  header: MotionDiv,
  main: MotionDiv,
  section: MotionDiv,
  article: MotionDiv,
  nav: MotionDiv,
  footer: MotionDiv,
  form: MotionDiv,
  input: MotionDiv,
  li: MotionDiv,
  ul: MotionDiv,
  ol: MotionDiv,
  h1: MotionDiv,
  h2: MotionDiv,
  h3: MotionDiv,
  h4: MotionDiv,
  h5: MotionDiv,
  h6: MotionDiv,
  a: MotionDiv,
  img: MotionDiv,
  svg: MotionDiv,
  path: MotionDiv,
  label: MotionDiv,
  strong: MotionDiv,
  em: MotionDiv,
  small: MotionDiv,
  b: MotionDiv,
  i: MotionDiv,
  u: MotionDiv,
  hr: MotionDiv,
  br: MotionDiv,
  tr: MotionDiv,
};

// Default export for compatibility
export default motion;
