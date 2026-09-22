'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/Button';
import { useAuth } from '@/context/auth-context';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { user, loading: authLoading, signIn, isConfigured } = useAuth();
  const router = useRouter();

  // Clean any old auto-remembered email so it starts completely blank
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('shreeji_remembered_email');
      } catch {}
    }
  }, []);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your email address');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    if (!isConfigured) {
      setError('Supabase is not configured properly in .env.local.');
      return;
    }

    setLoading(true);

    try {
      const { error: authError } = await signIn(cleanEmail, password);

      if (authError) {
        if (authError.message.toLowerCase().includes('invalid login credentials')) {
          setError('Email ya Password galat hai. Kripya check karke dobara enter karein.');
        } else if (authError.message.toLowerCase().includes('email not confirmed')) {
          setError('Email confirm nahi hua hai. Kripya Supabase Auth me check karein.');
        } else {
          setError(authError.message);
        }
        setLoading(false);
        return;
      }

      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check network connection.');
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#0F6B4F] shadow-md flex items-center justify-center animate-pulse">
            <span className="text-[#F97316] font-bold text-xl">श्री</span>
          </div>
          <p className="text-[14px] text-muted font-medium">Checking session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[420px]">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0F6B4F] shadow-sm mb-3">
            <span className="text-[#F97316] font-bold text-2xl font-serif">श्री</span>
          </div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Shreeji Transport</h1>
          <p className="text-[14px] text-muted mt-1">Sign in to your ERP account</p>
        </div>

        {/* Clean Professional Login Card */}
        <div className="rounded-2xl border border-line bg-panel p-6 sm:p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            {/* Email Address */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-email" className="text-[13px] font-semibold text-ink">
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address"
                autoComplete="off"
                autoFocus
                required
                className="w-full px-3.5 py-2.5 text-[14px] rounded-lg border border-line bg-paper text-ink placeholder:text-muted/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-password" className="text-[13px] font-semibold text-ink">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                  style={{ paddingRight: '2.5rem' }}
                  className="w-full px-3.5 py-2.5 text-[14px] rounded-lg border border-line bg-paper text-ink placeholder:text-muted/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-1 rounded transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-lg bg-negative/10 border border-negative/20 px-3.5 py-2.5 flex items-start gap-2 text-negative">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-[13px] font-medium leading-snug">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                fullWidth
                loading={loading}
                size="lg"
                className="rounded-lg py-2.5 text-[15px] font-semibold"
              >
                Sign In
              </Button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[12px] text-muted mt-5">
          Shreeji Transport ERP &bull; Secured with Supabase
        </p>
      </div>
    </div>
  );
}
