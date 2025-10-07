'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase/hooks/useAuth';
import { useUsers } from '@/lib/firebase/hooks/useUsers';
import { LogOut, User, Home } from 'lucide-react';
import Image from 'next/image';

export function Header() {
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

  if (!currentUser || !userRecord) return null;

  const getRoleBadgeColor = () => {
    switch (userRecord.role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'team-leader':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = () => {
    switch (userRecord.role) {
      case 'admin':
        return 'Admin';
      case 'team-leader':
        return 'Team Leader';
      default:
        return 'Member';
    }
  };

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side - Logo and navigation */}
          <div className="flex items-center gap-6">
            <Image
              src="/bni-game-logo.png"
              alt="BNI Competition Tracker"
              width={120}
              height={40}
              className="object-contain"
              priority
            />

            {/* Role-based navigation links */}
            <nav className="flex items-center gap-4">
              {userRecord.role === 'admin' && (
                <>
                  <button
                    onClick={() => router.push('/admin')}
                    className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => router.push('/admin/scoring')}
                    className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                  >
                    Scoring
                  </button>
                  <button
                    onClick={() => router.push('/admin/review')}
                    className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                  >
                    Review & Publish
                  </button>
                  <button
                    onClick={() => router.push('/display')}
                    className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                  >
                    Live Display
                  </button>
                </>
              )}
              {userRecord.role === 'team-leader' && (
                <>
                  <button
                    onClick={() => router.push('/team-leader/scoring')}
                    className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                  >
                    Team Scoring
                  </button>
                  <button
                    onClick={() => router.push('/display')}
                    className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                  >
                    Live Display
                  </button>
                </>
              )}
            </nav>
          </div>

          {/* Right side - User info and logout */}
          <div className="flex items-center gap-4">
            {/* User info */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  {userRecord.firstName} {userRecord.lastName}
                </div>
                <div className="text-xs text-gray-500">{userRecord.email}</div>
              </div>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor()}`}>
                {getRoleLabel()}
              </span>
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-gray-600" />
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              title="Logout"
            >
              <LogOut size={18} />
              {loggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}