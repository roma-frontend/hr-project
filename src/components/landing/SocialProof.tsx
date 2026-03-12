'use client';

import { Users, Award, TrendingUp, Globe } from 'lucide-react';
import { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const metricKeys = [
  { icon: Users,      value: '10,000+', labelKey: 'socialProof.activeUsers',    color: '#2563eb' },
  { icon: Award,      value: '4.9/5',   labelKey: 'socialProof.customerRating', color: '#60a5fa' },
  { icon: TrendingUp, value: '99.9%',   labelKey: 'socialProof.uptime',         color: '#60a5fa' },
  { icon: Globe,      value: '50+',     labelKey: 'socialProof.countries',      color: '#2563eb' },
];

function MetricItem({ icon: Icon, value, labelKey, color, delay }: typeof metricKeys[0] & { delay: number }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="flex flex-col items-center text-center gap-3"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.88)',
        transition: `opacity 0.55s cubic-bezier(0.22,1,0.36,1) ${delay}s, transform 0.55s cubic-bezier(0.22,1,0.36,1) ${delay}s`,
      }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: `${color}20` }}
      >
        <Icon size={24} style={{ color }} />
      </div>
      <div>
        <div className="text-2xl md:text-3xl font-bold mb-1" style={{ color: 'var(--landing-text-primary)' }}>{value}</div>
        <div className="text-sm" style={{ color: 'var(--landing-text-muted)', opacity: 1 }}>{t(labelKey)}</div>
      </div>
    </div>
  );
}

export default function SocialProof() {
  return (
    <section className="relative z-10 py-12 border-y" style={{ borderColor: 'var(--landing-card-border)' }}>
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {metricKeys.map((m, i) => (
            <MetricItem key={m.labelKey} {...m} delay={i * 0.1} />
          ))}
        </div>
      </div>
    </section>
  );
}
