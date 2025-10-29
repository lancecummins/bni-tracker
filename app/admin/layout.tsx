'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Trophy,
  Calendar,
  Settings,
  Monitor,
  BarChart,
  LogOut,
  CheckSquare,
  Upload,
  Link as LinkIcon,
  Eye,
} from 'lucide-react';
import { useAuth } from '@/lib/firebase/hooks/useAuth';
import { useUsers } from '@/lib/firebase/hooks/useUsers';
import Image from 'next/image';

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/scoring', label: 'Live Scoring', icon: BarChart },
  { href: '/admin/sessions', label: 'Sessions', icon: Calendar },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/teams', label: 'Teams', icon: Trophy },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user: currentUser, logout, loading: authLoading } = useAuth();
  const { users } = useUsers();
  const [loggingOut, setLoggingOut] = useState(false);

  const userRecord = users.find(u => u.email === currentUser?.email);

  // Check if we're on the metrics page to hide the sidebar
  const isMetricsPage = pathname?.includes('/metrics');

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, authLoading, router]);

  // Show loading spinner while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Don't render anything if user is not authenticated (will redirect)
  if (!currentUser) {
    return null;
  }

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

  // If on metrics page, render without sidebar
  if (isMetricsPage) {
    return (
      <div className="min-h-screen bg-gray-50">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <nav className="w-64 bg-white shadow-lg min-h-screen flex flex-col">
          <div className="p-6 border-b">
            <div className="flex justify-center mb-4">
              <Image
                src="/bni-game-logo.png"
                alt="BNI Competition Tracker"
                width={180}
                height={60}
                className="object-contain"
                priority
              />
            </div>
            {userRecord && (
              <div className="mt-2 text-center">
                <p className="text-sm text-gray-600">{userRecord.firstName} {userRecord.lastName}</p>
                <p className="text-xs text-gray-500">{userRecord.email}</p>
              </div>
            )}
          </div>
          <div className="p-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
            <hr className="my-4" />
            <Link
              href="/referee"
              target="_blank"
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Eye size={20} />
              <span className="font-medium">Referee</span>
            </Link>
            <Link
              href="/display"
              target="_blank"
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Monitor size={20} />
              <span className="font-medium">TV Display</span>
            </Link>
            <Link
              href="/team-links"
              target="_blank"
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <LinkIcon size={20} />
              <span className="font-medium">Team Links</span>
            </Link>
          </div>

          {/* Logout button at bottom */}
          <div className="mt-auto p-4 border-t">
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <LogOut size={20} />
              <span className="font-medium">{loggingOut ? 'Logging out...' : 'Logout'}</span>
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}