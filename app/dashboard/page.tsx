'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase/hooks/useAuth';
import { useUsers } from '@/lib/firebase/hooks/useUsers';

export default function DashboardPage() {
  const router = useRouter();
  const { user: currentUser, loading: authLoading } = useAuth();
  const { users, loading: usersLoading } = useUsers();

  useEffect(() => {
    if (!authLoading && !usersLoading) {
      if (!currentUser) {
        router.push('/login');
        return;
      }

      const userRecord = users.find(u => u.email === currentUser.email);

      if (!userRecord) {
        // User not found in database
        return;
      }

      // Route based on role
      switch (userRecord.role) {
        case 'admin':
          router.push('/admin');
          break;
        case 'team-leader':
          router.push('/team-leader/scoring');
          break;
        case 'member':
          router.push('/display');
          break;
        default:
          router.push('/');
      }
    }
  }, [currentUser, users, authLoading, usersLoading, router]);

  if (authLoading || usersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}