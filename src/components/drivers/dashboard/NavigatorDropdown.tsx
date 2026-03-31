"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Navigation2 } from "lucide-react";

const NAVIGATOR_LINKS = [
  { id: "google", name: "Google Maps", color: "#4285F4", icon: "🗺️", url: (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` },
  { id: "yandex", name: "Yandex Maps", color: "#FC3F1D", icon: "🧭", url: (lat: number, lng: number) => `https://yandex.ru/maps/?rtext=~${lat},${lng}&rtt=auto` },
  { id: "2gis", name: "2GIS", color: "#1DAD4E", icon: "🏢", url: (lat: number, lng: number) => `https://2gis.ru/routeSearch/rsType/car/to/${lng},${lat}` },
  { id: "waze", name: "Waze", color: "#33CCFF", icon: "🚗", url: (lat: number, lng: number) => `https://waze.com/ul?ll=${lat},${lng}&navigate=yes` },
];

interface NavigatorDropdownProps {
  label: string;
  coords: { lat: number; lng: number };
}

export function NavigatorDropdown({ label, coords }: NavigatorDropdownProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 h-7 px-2 text-xs">
          <Navigation2 className="w-3 h-3" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {NAVIGATOR_LINKS.map((nav) => (
          <DropdownMenuItem key={nav.id} asChild>
            <a
              href={nav.url(coords.lat, coords.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <span>{nav.icon}</span>
              <span>{String(t(`navigator.${nav.id}`, nav.name))}</span>
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
