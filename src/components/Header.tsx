'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';

interface HeaderProps {
  title: string;
  onMenuToggle: () => void;
  actions?: React.ReactNode;
}

export default function Header({ title, onMenuToggle, actions }: HeaderProps) {
  const { user, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getInitials = () => {
    if (!user?.email) return 'ST';
    const namePart = user.email.split('@')[0];
    return namePart.slice(0, 2).toUpperCase();
  };

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <header className="h-[60px] bg-panel border-b border-line flex items-center justify-between px-3 sm:px-4 lg:px-6 flex-shrink-0 relative z-30">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuToggle}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-paper text-muted lg:hidden flex-shrink-0"
          aria-label="Open menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        </button>

        <h1 className="text-base sm:text-lg font-bold text-ink truncate">{title}</h1>
      </div>

      {/* Right side actions & User Menu */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {actions}

        {/* User avatar with dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-primary/20 transition-all focus:outline-none"
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            <div
              className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-[13px] font-bold select-none shadow-xs"
              title={user?.email ? `Logged in as ${user.email}` : 'Shreeji Transport'}
            >
              {getInitials()}
            </div>
            <svg
              className={`w-3.5 h-3.5 text-muted transition-transform duration-150 hidden sm:block ${dropdownOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-[min(16rem,calc(100vw-1.25rem))] rounded-xl border border-line bg-panel p-2 shadow-lg animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2 border-b border-line mb-1">
                <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">Signed in as</p>
                <p className="text-[13px] font-bold text-ink truncate mt-0.5" title={user?.email || ''}>
                  {user?.email || 'Shreeji Transport Admin'}
                </p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                  Administrator
                </span>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false);
                    signOut();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-semibold text-negative hover:bg-negative/10 rounded-lg transition-colors text-left"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
