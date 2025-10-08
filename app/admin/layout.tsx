'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useState } from 'react';
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
} from 'lucide-react';
import { useAuth } from '@/lib/firebase/hooks/useAuth';
import { useUsers } from '@/lib/firebase/hooks/useUsers';

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/scoring', label: 'Live Scoring', icon: BarChart },
  { href: '/admin/review', label: 'Review & Publish', icon: CheckSquare },
  { href: '/admin/sessions', label: 'Sessions', icon: Calendar },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/teams', label: 'Teams', icon: Trophy },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
  { href: '/admin/setup', label: 'BNI Setup', icon: Upload },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user: currentUser, logout } = useAuth();
  const { users } = useUsers();
  const [loggingOut, setLoggingOut] = useState(false);

  const userRecord = users.find(u => u.email === currentUser?.email);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <nav className="w-64 bg-white shadow-lg min-h-screen flex flex-col">
          <div className="p-6 border-b">
            <h1 className="text-xl font-bold text-gray-800">BNI Admin</h1>
            {userRecord && (
              <div className="mt-2">
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