'use client';

import { useState, useRef, useEffect } from 'react';
import { Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ShieldLoader } from '@/components/ui/ShieldLoader';

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

export default function NewsletterSection() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const { ref, visible } = useReveal();
  const inputId = 'newsletter-email';
  const errorId = 'newsletter-email-error';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setHasError(true);
      toast.error(t('newsletter.invalidEmail'));
      return;
    }
    setHasError(false);
    setIsLoading(true);
    setTimeout(() => {
      setIsSubmitted(true);
      setIsLoading(false);
      toast.success(t('newsletter.successMessage'));
      setEmail('');
    }, 1000);
  };

  return (
    <section className="relative z-10 px-6 md:px-12 py-20">
      <div
        ref={ref}
        className="relative max-w-3xl mx-auto"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(40px) scale(0.96)',
          transition:
            'opacity 0.8s cubic-bezier(0.22,1,0.36,1), transform 0.8s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {/* Background glow */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-blue-500/15 via-blue-600/15 to-slate-400/10 rounded-3xl blur-3xl"
          aria-hidden="true"
        />

        <div
          className="relative rounded-3xl border backdrop-blur-xl p-8 md:p-12 text-center overflow-hidden"
          style={{
            borderColor: 'var(--landing-card-border)',
            backgroundColor: 'var(--landing-card-bg)',
          }}
        >
          {/* Static orb — CSS pulse instead of JS animate */}
          <div
            className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-gradient-to-br from-blue-500/25 to-blue-600/20 blur-3xl orb-pulse-1"
            aria-hidden="true"
          />

          {/* Icon — CSS float */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 mb-6 animate-float">
            <Mail size={28} style={{ color: '#ffffff' }} />
          </div>

          <h3
            className="text-2xl md:text-4xl font-black mb-4"
            style={{ color: 'var(--landing-text-primary)' }}
          >
            {t('newsletter.title')}
          </h3>
          <p
            className="text-lg mb-8 max-w-xl mx-auto"
            style={{ color: 'var(--landing-text-secondary)', opacity: 0.85 }}
          >
            {t('newsletter.subtitle')}
          </p>

          {!isSubmitted ? (
            <form
              onSubmit={handleSubmit}
              className="flex items-center flex-col sm:flex-row gap-3 max-w-md mx-auto"
            >
              <input
                id={inputId}
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setHasError(false); }}
                placeholder={t('newsletter.emailPlaceholder')}
                className="flex-1 px-5 py-4 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                style={{
                  backgroundColor: 'var(--input)',
                  borderColor: 'var(--input-border)',
                  color: 'var(--landing-text-primary)',
                }}
                disabled={isLoading}
                aria-label={t('ariaLabels.emailAddress')}
                aria-invalid={hasError ? 'true' : 'false'}
                aria-describedby={hasError ? errorId : undefined}
              />
              {hasError && (
                <span id={errorId} className="text-sm text-red-500 sr-only" role="alert">
                  {t('newsletter.invalidEmail')}
                </span>
              )}
              <Button
                type="submit"
                variant="cta"
                size="lg"
                className="gap-2 h-14"
                disabled={isLoading}
              >
                {isLoading ? (
                  <ShieldLoader size="xs" variant="inline" />
                ) : (
                  <>
                    <span>{t('newsletter.subscribe')}</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </Button>
            </form>
          ) : (
            /* CSS fade-in on success */
            <div
              className="flex items-center justify-center gap-3 font-semibold success-reveal"
              style={{ color: 'var(--primary)' }}
            >
              <CheckCircle2 size={24} />
              <span>{t('newsletter.subscribed')}</span>
            </div>
          )}

          <p
            className="text-xs mt-6"
            style={{ color: 'var(--landing-text-secondary)', opacity: 0.85 }}
          >
            {t('newsletter.privacyNote')}
          </p>
        </div>
      </div>
    </section>
  );
}
