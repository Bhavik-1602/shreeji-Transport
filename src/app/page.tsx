import { redirect } from 'next/navigation';

// Root page redirects to the dashboard.
// When Supabase auth is connected, this will check the session first
// and redirect to /login if not authenticated.
export default function Home() {
  redirect('/dashboard');
}
