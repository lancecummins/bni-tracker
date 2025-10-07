'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase/hooks/useAuth';
import { useStaticUsers } from '@/lib/firebase/hooks/useStaticData';
import { LogOut, Monitor, ClipboardCheck, Menu, X, User } from 'lucide-react';
import Link from 'next/link';

export default function TeamLeaderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user: currentUser, loading: authLoading, logout } = useAuth();
  const { users, loading: usersLoading } = useStaticUsers();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    const result = await logout();
    if (result.success) {
      router.push('/login');
    } else {
      console.error('Logout failed:', result.error);
      setLoggingOut(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !usersLoading) {
      if (!currentUser) {
        router.push('/login');
        return;
      }

      const userRecord = users.find(u => u.email === currentUser.email);
      if (userRecord?.role !== 'team-leader' && userRecord?.role !== 'admin') {
        router.push('/');
      }
    }
  }, [currentUser, users, authLoading, usersLoading, router]);

  if (authLoading || usersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const userRecord = users.find(u => u.email === currentUser?.email);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with navigation */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left side - App name and desktop navigation */}
            <div className="flex items-center gap-6">
              <h1 className="text-xl font-bold text-gray-900">BNI Team Leader</h1>

              {/* Desktop navigation */}
              <nav className="hidden md:flex items-center gap-4">
                <Link
                  href="/team-leader/scoring"
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium"
                >
                  <ClipboardCheck size={18} />
                  Team Scoring
                </Link>
                <Link
                  href="/display"
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium"
                >
                  <Monitor size={18} />
                  Live Display
                </Link>
              </nav>
            </div>

            {/* Desktop right side - User info and logout */}
            <div className="hidden md:flex items-center gap-4">
              {userRecord && (
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {userRecord.firstName} {userRecord.lastName}
                  </div>
                  <div className="text-xs text-gray-500">{userRecord.email}</div>
                </div>
              )}

              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              >
                <LogOut size={18} />
                {loggingOut ? 'Logging out...' : 'Logout'}
              </button>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-white">
            <div className="px-4 py-3 space-y-1">
              <Link
                href="/team-leader/scoring"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                <ClipboardCheck size={20} />
                <span className="font-medium">Team Scoring</span>
              </Link>

              <Link
                href="/display"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                <Monitor size={20} />
                <span className="font-medium">Live Display</span>
              </Link>

              {userRecord && (
                <div className="px-3 py-3 border-t mt-2">
                  <div className="flex items-center gap-3 mb-3">
                    <User size={20} className="text-gray-600" />
                    <div>
                      <div className="font-medium text-gray-900">
                        {userRecord.firstName} {userRecord.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{userRecord.email}</div>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-red-600 hover:bg-red-50 border-t"
              >
                <LogOut size={20} />
                <span className="font-medium">{loggingOut ? 'Logging out...' : 'Logout'}</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main content */}
      <main>{children}</main>
    </div>
  );
}