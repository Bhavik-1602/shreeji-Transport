'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useAuth } from '@/context/auth-context';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/daily-hisab': 'Trips & Daily Hisab',
  '/trips': 'Trips & Daily Hisab',
  '/trips/new': 'New Trip Entry',
  '/maintenance': 'Vehicle Maintenance',
  '/fastag': 'FASTag Recharges',
  '/diesel': 'Diesel Management',
  '/payment': 'Payment & Freight Collections',
  '/investment': 'Investments & Assets',
  '/reports/maintenance-summary': 'Maintenance Summary Report',
  '/reports/driver-summary': 'Driver Summary & Silik Report',
  '/masters/vehicles': 'Vehicles Master',
  '/masters/drivers': 'Drivers Master',
  '/masters/parties': 'Parties Master',
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, isConfigured } = useAuth();
  const title = pageTitles[pathname] || 'Shreeji Transport';

  useEffect(() => {
    if (!loading && isConfigured && !user) {
      router.replace('/login');
    }
  }, [loading, isConfigured, user, router]);

  // Loading state while checking auth
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-paper">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#F97316] flex items-center justify-center animate-pulse">
            <span className="text-white font-bold text-xl">श्री</span>
          </div>
          <p className="text-[14px] text-muted font-medium">Loading ERP...</p>
        </div>
      </div>
    );
  }

  // If not logged in and configured, prevent flash before redirect
  if (isConfigured && !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-paper">
        <div className="flex flex-col items-center gap-3">
          <p className="text-[14px] text-muted">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          title={title}
          onMenuToggle={() => setSidebarOpen(true)}
        />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
