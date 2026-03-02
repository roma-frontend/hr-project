'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp } from 'lucide-react';

export default function ScrollToTop() {
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show button when page is scrolled down
  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!mounted) return null;

  const buttonContent = (
    <>
      <button
        onClick={scrollToTop}
        className="group"
        style={{
          position: 'fixed',
          bottom: '32px',
          right: '32px',
          zIndex: 99999,
          width: '56px',
          height: '56px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #2563eb, #93c5fd)',
          boxShadow: '0 8px 32px rgba(37, 99, 235, 0.3)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isVisible ? '1' : '0',
          transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.8)',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: isVisible ? 'auto' : 'none',
        }}
        onMouseEnter={(e) => {
          if (isVisible) {
            e.currentTarget.style.transform = 'translateY(-4px) scale(1.05)';
            e.currentTarget.style.boxShadow = '0 12px 40px rgba(37, 99, 235, 0.5)';
          }
        }}
        onMouseLeave={(e) => {
          if (isVisible) {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(37, 99, 235, 0.3)';
          }
        }}
        aria-label="Scroll to top"
      >
        <ArrowUp
          size={24}
          style={{ 
            color: '#ffffff',
            transition: 'transform 0.3s ease',
          }}
          className="group-hover:animate-bounce"
        />
      </button>

    </>
  );

  return createPortal(buttonContent, document.body);
}
