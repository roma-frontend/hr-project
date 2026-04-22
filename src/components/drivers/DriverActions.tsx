/**
 * Driver Actions - Helper components for driver interactions
 */

'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Navigation2, ExternalLink, Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

const NAVIGATORS = [
  {
    nameKey: 'driver.navigator.google',
    name: 'Google Maps',
    icon: '🗺️',
    url: (lat: number, lng: number) =>
      `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
  },
  {
    nameKey: 'driver.navigator.yandex',
    name: 'Yandex Maps',
    icon: '🟡',
    url: (lat: number, lng: number) => `https://yandex.ru/maps/?pt=${lng},${lat}&z=16&l=map`,
  },
  {
    nameKey: 'driver.navigator.2gis',
    name: '2GIS',
    icon: '🟢',
    url: (lat: number, lng: number) => `https://2gis.ru/geo/${lng},${lat}`,
  },
  {
    nameKey: 'driver.navigator.waze',
    name: 'Waze',
    icon: '🔵',
    url: (lat: number, lng: number) => `https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`,
  },
];

interface NavigatorDropdownProps {
  label: string;
  coords: { lat: number; lng: number };
}

export function NavigatorDropdown({ label, coords }: NavigatorDropdownProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyCoords = () => {
    navigator.clipboard.writeText(`${coords.lat}, ${coords.lng}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 h-7 px-2 text-xs">
          <Navigation2 className="w-3 h-3" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {NAVIGATORS.map((nav) => (
          <DropdownMenuItem key={nav.nameKey} asChild>
            <a
              href={nav.url(coords.lat, coords.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <span>{nav.icon}</span>
              <span className="flex-1">{t(nav.nameKey, nav.name)}</span>
              <ExternalLink className="w-3 h-3 opacity-50" />
            </a>
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onClick={handleCopyCoords} className="gap-2">
          {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
          {copied
            ? t('driverActions.navigator.copied', 'Copied!')
            : t('driverActions.navigator.copyCoords', 'Copy Coords')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
