'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase/hooks/useAuth';
import Link from 'next/link';
import Image from 'next/image';

export default function MetricsLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user: currentUser, loading: authLoading } = useAuth();

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Logo */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <Link href="/admin/dashboard">
            <Image
              src="/bni-game-logo.png"
              alt="BNI Game"
              width={150}
              height={50}
              className="object-contain cursor-pointer hover:opacity-80 transition-opacity"
              priority
            />
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}
