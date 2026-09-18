'use client';

import Navbar from './Navbar';

export default function NavbarWrapper({
  embedded = false,
  initialLanguage = 'en',
}: {
  embedded?: boolean;
  initialLanguage?: string;
}) {
  return <Navbar embedded={embedded} initialLanguage={initialLanguage} />;
}
