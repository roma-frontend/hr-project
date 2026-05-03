'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useRouter, usePathname } from 'next/navigation';
import {
  X,
  Home,
  Sparkles,
  BarChart3,
  DollarSign,
  MessageCircle,
  LogIn,
  Rocket,
  Shield,
  ChevronRight,
  Globe,
  Sun,
  Moon,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';
import { LanguageSwitcher } from '../LanguageSwitcher';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const menuItemsConfig = [
  {
    key: 'home',
    href: '#home',
    icon: Home,
    gradient: 'from-blue-500/20 to-blue-600/10',
    iconColor: 'text-blue-500',
    accent: '#3b82f6',
  },
  {
    key: 'features',
    href: '#features',
    icon: Sparkles,
    gradient: 'from-violet-500/20 to-violet-600/10',
    iconColor: 'text-violet-500',
    accent: '#8b5cf6',
  },
  {
    key: 'analytics',
    href: '#stats',
    icon: BarChart3,
    gradient: 'from-cyan-500/20 to-cyan-600/10',
    iconColor: 'text-cyan-500',
    accent: '#06b6d4',
  },
  {
    key: 'pricing',
    href: '#pricing',
    icon: DollarSign,
    gradient: 'from-emerald-500/20 to-emerald-600/10',
    iconColor: 'text-emerald-500',
    accent: '#10b981',
  },
  {
    key: 'testimonials',
    href: '#testimonials',
    icon: MessageCircle,
    gradient: 'from-amber-500/20 to-amber-600/10',
    iconColor: 'text-amber-500',
    accent: '#f59e0b',
  },
  {
    key: 'recruitment',
    href: '/careers',
    icon: Rocket,
    gradient: 'from-rose-500/20 to-rose-600/10',
    iconColor: 'text-rose-500',
    accent: '#f43f5e',
  },
];

export default function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [visibleItems, setVisibleItems] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setVisibleItems(false);
      const timer = setTimeout(() => setVisibleItems(true), 150);
      return () => clearTimeout(timer);
    } else {
      setVisibleItems(false);
    }
  }, [isOpen]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleNavigate = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    onClose();
    if (pathname !== '/') {
      router.push(href);
      return;
    }
    if (href.startsWith('/')) {
      router.push(href);
      return;
    }
    setTimeout(() => {
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 300);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const menuContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[105] lg:hidden"
        style={{
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={menuRef}
        className="fixed top-0 right-0 z-[110] lg:hidden flex flex-col"
        style={{
          width: 'min(88vw, 360px)',
          height: '100vh',
          maxHeight: '100vh',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          backgroundColor: 'var(--background)',
          borderLeft: '1px solid var(--landing-card-border)',
          boxShadow: isOpen ? '-10px 0 40px rgba(0,0,0,0.1)' : 'none',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
      >
        {/* Header */}
        <div
          className="relative flex items-center justify-between px-6 py-5 border-b"
          style={{
            borderColor: 'var(--landing-card-border)',
            background:
              'linear-gradient(135deg, rgba(37, 99, 235, 0.06), rgba(59, 130, 246, 0.02))',
          }}
        >
          {/* Decorative elements */}
          <div
            className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(circle, #3b82f6, transparent)' }}
          />

          <Link
            href="/"
            className="relative z-10 flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #2563eb, #60a5fa)',
              }}
            >
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2
                className="font-bold text-lg leading-tight"
                style={{ color: 'var(--landing-text-primary)' }}
              >
                HR<span style={{ color: 'var(--primary)' }}>Office</span>
              </h2>
              <p className="text-[11px] font-medium" style={{ color: 'var(--landing-text-muted)' }}>
                {t('sidebar.subtitle', 'Smart HR Platform')}
              </p>
            </div>
          </Link>

          <button
            onClick={onClose}
            className="relative z-10 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none"
            style={{
              backgroundColor: 'var(--landing-card-bg)',
              border: '1px solid var(--landing-card-border)',
              color: 'var(--landing-text-primary)',
            }}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-5 py-4" style={{ minHeight: 0 }}>
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-3 px-2"
            style={{ color: 'var(--landing-text-muted)' }}
          >
            {t('mobileMenu.navigation', 'Navigation')}
          </p>

          <div className="space-y-1">
            {menuItemsConfig.map((item, index) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href.startsWith('#') && pathname === '/' && item.href === '#home');

              return (
                <a
                  key={item.key}
                  href={item.href}
                  onClick={(e) => handleNavigate(e, item.href)}
                  className="group relative flex items-center gap-3.5 px-3 py-3 rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  style={{
                    opacity: visibleItems ? 1 : 0,
                    transform: visibleItems ? 'translateX(0)' : 'translateX(20px)',
                    transitionDelay: `${index * 50}ms`,
                    transitionProperty: 'opacity, transform, background-color',
                    transitionDuration: '350ms',
                    transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-full"
                      style={{
                        height: '60%',
                        background: item.accent,
                        boxShadow: `0 0 12px ${item.accent}40`,
                      }}
                    />
                  )}

                  {/* Hover background */}
                  <div
                    className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r ${item.gradient}`}
                  />

                  {/* Icon */}
                  <div
                    className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 bg-gradient-to-br ${item.gradient}`}
                  >
                    <Icon size={18} className={item.iconColor} />
                  </div>

                  {/* Label */}
                  <span
                    className="relative flex-1 font-semibold text-sm"
                    style={{ color: 'var(--landing-text-primary)' }}
                  >
                    {t(`mobileMenu.${item.key}`)}
                  </span>

                  {/* Arrow */}
                  <ArrowRight
                    size={16}
                    className="relative opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-300"
                    style={{ color: item.accent }}
                  />
                </a>
              );
            })}
          </div>

          {/* Preferences Section */}
          <div
            className="pt-5 pb-3 border-t mt-5"
            style={{ borderColor: 'var(--landing-card-border)' }}
          >
            <p
              className="text-[10px] font-semibold uppercase tracking-widest mb-3 px-2"
              style={{ color: 'var(--landing-text-muted)' }}
            >
              {t('mobileMenu.preferences', 'Preferences')}
            </p>

            <div className="space-y-2">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="group w-full flex items-center gap-3.5 px-3 py-3 rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-95"
                style={{
                  backgroundColor: 'var(--landing-card-bg)',
                  border: '1px solid var(--landing-card-border)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                  style={{
                    background:
                      theme === 'dark'
                        ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))'
                        : 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.05))',
                  }}
                >
                  {theme === 'dark' ? (
                    <Sun size={18} className="text-amber-400" />
                  ) : (
                    <Moon size={18} className="text-blue-500" />
                  )}
                </div>
                <span
                  className="flex-1 font-semibold text-sm text-left"
                  style={{ color: 'var(--landing-text-primary)' }}
                >
                  {theme === 'dark'
                    ? t('landingExtra.switchToLight', 'Light Mode')
                    : t('landingExtra.switchToDark', 'Dark Mode')}
                </span>
                <div
                  className="w-11 h-6 rounded-full relative transition-colors duration-300"
                  style={{
                    background: theme === 'dark' ? '#3b82f6' : 'var(--border)',
                  }}
                >
                  <div
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300"
                    style={{
                      transform: theme === 'dark' ? 'translateX(20px)' : 'translateX(2px)',
                    }}
                  />
                </div>
              </button>

              {/* Language Switcher */}
              <div
                className="flex items-center gap-3.5 px-3 py-3 rounded-2xl"
                style={{
                  backgroundColor: 'var(--landing-card-bg)',
                  border: '1px solid var(--landing-card-border)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05))',
                  }}
                >
                  <Globe size={18} className="text-emerald-500" />
                </div>
                <span
                  className="flex-1 font-semibold text-sm"
                  style={{ color: 'var(--landing-text-primary)' }}
                >
                  {t('mobileMenu.language', 'Language')}
                </span>
                <div className="scale-90 origin-right">
                  <LanguageSwitcher />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer CTAs */}
        <div
          className="px-5 pb-6 pt-4 space-y-3 border-t"
          style={{
            borderColor: 'var(--landing-card-border)',
            background: 'linear-gradient(to top, var(--background) 60%, transparent)',
            flexShrink: 0,
          }}
        >
          {/* Sign In */}
          <Link href="/login" onClick={onClose} className="block">
            <button
              className="w-full px-5 py-3.5 rounded-2xl font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2.5 group"
              style={{
                color: 'var(--landing-text-primary)',
                backgroundColor: 'var(--landing-card-bg)',
                border: '1px solid var(--landing-card-border)',
              }}
            >
              <LogIn size={18} className="group-hover:translate-x-0.5 transition-transform" />
              <span>{t('landing.signIn', 'Sign In')}</span>
            </button>
          </Link>

          {/* Get Started */}
          <Link href="/register" onClick={onClose} className="block">
            <button
              className="w-full px-5 py-3.5 rounded-2xl font-bold transition-all duration-200 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2.5 group relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                color: '#ffffff',
                boxShadow: '0 4px 20px rgba(37, 99, 235, 0.3)',
              }}
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
                }}
              />
              <Rocket size={18} className="group-hover:-translate-y-0.5 transition-transform" />
              <span>{t('landing.getStartedFree', 'Get Started Free')}</span>
            </button>
          </Link>

          {/* Version */}
          <p
            className="text-center text-[10px] font-medium pt-1"
            style={{ color: 'var(--landing-text-muted)' }}
          >
            ShieldOffice v2.0 • {t('mobileMenu.secure', 'Secure & Private')}
          </p>
        </div>
      </div>
    </>
  );

  return mounted && typeof document !== 'undefined'
    ? createPortal(menuContent, document.body)
    : null;
}
