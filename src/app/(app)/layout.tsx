'use client';

import { Suspense, useState, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useAuth } from '@/context/auth-context';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/daily-hisab': 'Trips',
  '/trips': 'Trips',
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
  '/masters/pumps': 'Pumps Master',
  '/masters/locations': 'Locations Master',
  '/masters/bank-accounts': 'Bank Accounts',
};

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="flex h-screen items-center justify-center bg-paper">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-[#F97316] flex items-center justify-center animate-pulse">
          <span className="text-white font-bold text-xl">श्री</span>
        </div>
        <p className="text-[14px] text-muted font-medium">{message}</p>
      </div>
    </div>
  );
}

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading, isConfigured } = useAuth();
  const title = pathname === '/trips/new'
    ? (searchParams.get('view') === '1' ? 'View Trip' : searchParams.get('id') ? 'Edit Trip' : 'New Trip Entry')
    : (pageTitles[pathname] || 'Shreeji Transport');

  useEffect(() => {
    if (!loading && isConfigured && !user) {
      router.replace('/login');
    }
  }, [loading, isConfigured, user, router]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (loading) {
    return <LoadingScreen message="Loading ERP..." />;
  }

  if (isConfigured && !user) {
    return <LoadingScreen message="Redirecting to login..." />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          title={title}
          onMenuToggle={() => setSidebarOpen(true)}
        />

        <main className="flex-1 min-w-0 max-w-full overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingScreen message="Loading ERP..." />}>
      <AppLayoutInner>{children}</AppLayoutInner>
    </Suspense>
  );
}
