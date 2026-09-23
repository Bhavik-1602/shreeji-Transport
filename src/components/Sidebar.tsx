'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { useAuth } from '@/context/auth-context';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const navItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="7" height="7" rx="1.5" />
        <rect x="11" y="2" width="7" height="4" rx="1.5" />
        <rect x="11" y="8" width="7" height="10" rx="1.5" />
        <rect x="2" y="11" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    label: 'Trips',
    href: '/trips',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10h14" />
        <path d="M13 6l4 4-4 4" />
        <circle cx="5" cy="4" r="2" />
        <circle cx="15" cy="16" r="2" />
      </svg>
    ),
  },
  { type: 'divider' as const, label: 'Operations' },
  {
    label: 'Maintenance',
    href: '/maintenance',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15.5 4.5a3.5 3.5 0 00-4.9 4.9L4 16a1.41 1.41 0 002 2l6.6-6.6a3.5 3.5 0 004.9-4.9" />
        <circle cx="5.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: 'Fastag',
    href: '/fastag',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="16" height="10" rx="2" />
        <path d="M6 10h3M13 8v4" />
        <circle cx="13" cy="10" r="0.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: 'Diesel',
    href: '/diesel',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18" />
        <path d="M15 10h2a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2 2 2 0 0 0 2-2V9.5a1.5 1.5 0 0 0-.44-1.06L20 6" />
        <path d="M6 12h6" />
        <rect x="6" y="5" width="6" height="4" rx="1" />
      </svg>
    ),
  },
  {
    label: 'Payment',
    href: '/payment',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="16" height="12" rx="2" />
        <path d="M2 8h16" />
        <circle cx="6" cy="13" r="1.5" />
        <path d="M10 12h5M10 14h3" />
      </svg>
    ),
  },
  { type: 'divider' as const, label: 'Reports' },
  {
    label: 'Maintenance Summary',
    href: '/reports/maintenance-summary',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="16" height="16" rx="2" />
        <path d="M6 10l2.5 2.5L14 7" />
      </svg>
    ),
  },
  {
    label: 'Driver Summary',
    href: '/reports/driver-summary',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="6" r="3" />
        <path d="M2 17c0-2.761 2.686-5 6-5" />
        <path d="M14 12v6M11 15h6" />
      </svg>
    ),
  },
  {
    label: 'Investment',
    href: '/investment',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="2,14 7,9 11,12 18,5" />
        <path d="M14 5h4v4" />
      </svg>
    ),
  },
  { type: 'divider' as const, label: 'Masters' },
  {
    label: 'Vehicles',
    href: '/masters/vehicles',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="6" width="18" height="8" rx="2" />
        <circle cx="5" cy="14" r="2" />
        <circle cx="15" cy="14" r="2" />
        <path d="M1 10h18" />
      </svg>
    ),
  },
  {
    label: 'Drivers',
    href: '/masters/drivers',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="6" r="4" />
        <path d="M2 18c0-3.314 3.582-6 8-6s8 2.686 8 6" />
      </svg>
    ),
  },
  {
    label: 'Parties',
    href: '/masters/parties',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="2" width="14" height="16" rx="2" />
        <path d="M7 6h6M7 10h6M7 14h3" />
      </svg>
    ),
  },
];

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia('(min-width: 1024px)');
    if (desktop.matches) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-ink/30 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={clsx(
          'fixed top-0 left-0 z-50 h-full w-[min(16rem,88vw)] lg:w-64 bg-panel border-r border-line flex flex-col',
          'transition-transform duration-200 ease-out',
          'lg:translate-x-0 lg:static lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-[60px] border-b border-line flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#F97316] flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">श्री</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold text-ink truncate">Shreeji Transport</h1>
          </div>
          {/* Mobile close */}
          <button
            onClick={onClose}
            className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg hover:bg-paper text-muted lg:hidden"
            aria-label="Close sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {navItems.map((item, i) => {
            if ('type' in item && item.type === 'divider') {
              return (
                <div key={i} className="mt-5 mb-2 px-3">
                  <span className="text-[11px] font-semibold text-muted/70 uppercase tracking-wider">
                    {item.label}
                  </span>
                </div>
              );
            }

            if (!('href' in item)) return null;

            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={clsx(
                  'flex items-center gap-3 px-3 py-3 lg:py-2.5 rounded-lg text-[14px] font-medium transition-colors duration-150 mb-0.5',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted hover:bg-paper hover:text-ink',
                )}
              >
                <span className={clsx('flex-shrink-0', isActive ? 'text-primary' : 'text-muted')}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-line px-3 py-3 flex-shrink-0 space-y-2">
          {user?.email && (
            <div className="px-3 py-1 rounded-md bg-paper border border-line/60">
              <span className="text-[11px] text-muted block leading-none">Logged in as</span>
              <span className="text-[12px] font-medium text-ink truncate block mt-0.5" title={user.email}>
                {user.email}
              </span>
            </div>
          )}
          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] font-medium text-muted hover:bg-paper hover:text-negative transition-colors duration-150 w-full"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17H4a2 2 0 01-2-2V5a2 2 0 012-2h3" />
              <path d="M14 14l4-4-4-4" />
              <path d="M18 10H8" />
            </svg>
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
