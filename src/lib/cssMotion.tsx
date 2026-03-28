/**
 * CSS-based Animation Components
 * Replacement for Framer Motion
 */

import React, { useState, useEffect, useRef } from 'react';

interface MotionProps {
  children: React.ReactNode;
  className?: string;
  initial?: {
    opacity?: number;
    x?: number | string;
    y?: number | string;
    scale?: number;
  };
  animate?: {
    opacity?: number;
    x?: number | string;
    y?: number | string;
    scale?: number;
  };
  exit?: {
    opacity?: number;
    x?: number | string;
    y?: number | string;
    scale?: number;
  };
  transition?: {
    duration?: number;
    delay?: number;
    ease?: 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';
  };
  whileHover?: {
    scale?: number;
    x?: number;
    y?: number;
  };
  whileTap?: {
    scale?: number;
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

  // Build inline styles for initial state
  const getInitialStyle = () => {
    if (!initial || exiting) return {};
    
    const style: React.CSSProperties = {};
    if (initial.opacity !== undefined) style.opacity = initial.opacity;
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
        className={`${className} ${animationClass}`}
        style={{
          ...getInitialStyle(),
          transition: `all ${transition.duration || 0.3}s ${transition.ease || 'ease-in-out'}`,
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      ref={elementRef}
      className={`${className} ${animationClass} ${interactiveClass} transition-all`}
      style={{
        ...getInitialStyle(),
        transitionDuration: `${(transition.duration || 0.3) * 1000}ms`,
        transitionDelay: `${(transition.delay || 0) * 1000}ms`,
      }}
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
};
